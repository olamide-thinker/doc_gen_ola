import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Inject,
  Req,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, and, or, desc, inArray } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import { FieldReportsService } from './field-reports.service';

const ALLOWED_KIND = new Set([
  'note',
  'incident',
  'update',
  'confirmation_request',
  // Crew asks the supervisor for materials. Request payload carries an
  // items array; each item is a soft-link to an inventory_items row
  // (when the picker matched) plus a snapshot of name/quantity/unit so
  // the request reads cleanly even if the catalog entry later changes.
  'material_request',
]);
const ALLOWED_TASK_STATUS = new Set(['pending', 'progress', 'done', 'cancelled']);

@Controller('api/field-reports')
@UseGuards(FirebaseGuard)
export class FieldReportsController {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private db: any,
    private reports: FieldReportsService,
  ) {}

  /** Project-membership gate. Mirrors the TasksController helper. */
  private async assertProjectAccess(projectId: string, req: any): Promise<void> {
    const userId = req.user.uid;
    const email = req.user.email;

    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!proj) throw new NotFoundException('Project not found');
    if (proj.ownerId === userId) return;

    const memberConds = [eq(schema.projectMembers.userId, userId)];
    if (email) memberConds.push(eq(schema.projectMembers.email, email));

    const member = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        or(...memberConds),
      ),
    });
    if (!member) throw new ForbiddenException('Not a member of this project');
  }

  /**
   * Batched user lookup. Pulls the slim public profile (id, fullName,
   * email) for every authorId — and any `resolution.resolvedById` (jsonb
   * field) — across the given rows. Single SQL roundtrip.
   *
   * Decorates each row with an `author` object, and when the row has a
   * resolved confirmation_request, lifts `resolution.resolvedBy` (the
   * resolver's profile) onto the resolution object too.
   *
   * Keeps original *Id columns intact for backward compat — frontends
   * can read `row.author?.fullName ?? row.authorId` and ride out the
   * migration.
   */
  private async hydrateAuthors<T extends {
    authorId?: string | null;
    resolution?: any;
  }>(
    rows: T[],
  ): Promise<Array<T & { author: { id: string; fullName: string | null; email: string } | null }>> {
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.authorId) ids.add(r.authorId);
      const rid = r.resolution?.resolvedById;
      if (typeof rid === 'string' && rid) ids.add(rid);
    }
    if (ids.size === 0) {
      return rows.map(r => ({ ...r, author: null }));
    }
    const users = await this.db.query.users.findMany({
      where: inArray(schema.users.id, Array.from(ids)),
      columns: { id: true, fullName: true, email: true },
    });
    const userMap = new Map<string, any>();
    for (const u of users) userMap.set(u.id, u);

    return rows.map(r => {
      const author = r.authorId ? userMap.get(r.authorId) || null : null;
      let resolution = r.resolution;
      if (resolution && typeof resolution === 'object' && resolution.resolvedById) {
        const resolvedBy = userMap.get(resolution.resolvedById) || null;
        resolution = { ...resolution, resolvedBy };
      }
      return { ...r, author, resolution };
    });
  }

  /** Coerce attachments into a clean array shape. */
  private normalizeAttachments(input: unknown): any[] | null {
    if (!Array.isArray(input)) return null;
    const rows = input
      .filter((a): a is Record<string, any> => a && typeof a === 'object')
      .map((a) => ({
        url: typeof a.url === 'string' ? a.url : '',
        type: typeof a.type === 'string' ? a.type : 'doc',
        label: typeof a.label === 'string' ? a.label : undefined,
      }))
      .filter((a) => a.url);
    return rows.length > 0 ? rows : null;
  }

  // ── LIST ────────────────────────────────────────────────────────────
  // Filterable by taskId (so the task modal's Reports tab is just this with
  // a query param) and by kind. Returns the full thread message count so
  // dashboards can show "12 replies" without a second roundtrip.
  @Get()
  async list(
    @Query('projectId') projectId: string,
    @Query('taskId') taskId: string | undefined,
    @Query('kind') kind: string | undefined,
    @Req() req: any,
  ) {
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);

    const conds: any[] = [eq(schema.fieldReports.projectId, projectId)];
    if (taskId) conds.push(eq(schema.fieldReports.taskId, taskId));
    if (kind && ALLOWED_KIND.has(kind))
      conds.push(eq(schema.fieldReports.kind, kind));

    const rows = await this.db.query.fieldReports.findMany({
      where: conds.length === 1 ? conds[0] : and(...conds),
      orderBy: [desc(schema.fieldReports.createdAt)],
    });

    // Lightweight reply-count rollup. We do this in JS for now — it's a
    // single COUNT(*) per report which is cheap on small/medium reports
    // lists. Drop into a single GROUP BY query later if it ever shows up
    // in profiling.
    const withCounts = await Promise.all(
      rows.map(async (r: any) => {
        const msgs = await this.db.query.fieldReportMessages.findMany({
          where: eq(schema.fieldReportMessages.reportId, r.id),
          columns: { id: true },
        });
        return { ...r, replyCount: msgs.length };
      }),
    );

    const hydrated = await this.hydrateAuthors(withCounts);
    return { success: true, data: hydrated };
  }

  // ── DETAIL (with thread) ────────────────────────────────────────────
  @Get(':id')
  async detail(@Param('id') id: string, @Req() req: any) {
    const report = await this.db.query.fieldReports.findFirst({
      where: eq(schema.fieldReports.id, id),
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.projectId) await this.assertProjectAccess(report.projectId, req);

    const messages = await this.db.query.fieldReportMessages.findMany({
      where: eq(schema.fieldReportMessages.reportId, id),
      orderBy: [schema.fieldReportMessages.createdAt],
    });

    // Hydrate the report itself + every message author in one pass so
    // the modal renders names instead of raw firebase uids.
    const [hydratedReport] = await this.hydrateAuthors([report]);
    const hydratedMessages = await this.hydrateAuthors(messages);

    return { success: true, data: { ...hydratedReport, messages: hydratedMessages } };
  }

  // ── CREATE ──────────────────────────────────────────────────────────
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const projectId = body?.projectId;
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);

    const bodyText = String(body.body || '').trim();
    if (!bodyText) throw new BadRequestException('body is required');

    const kind = ALLOWED_KIND.has(body.kind) ? body.kind : 'note';

    // Confirmation requests must reference a target task + a valid status,
    // otherwise the resolve flow has nothing to apply.
    let request: any = null;
    if (kind === 'confirmation_request') {
      const targetTaskId = body?.request?.targetTaskId;
      const requestedStatus = body?.request?.requestedStatus;
      if (!targetTaskId || !ALLOWED_TASK_STATUS.has(requestedStatus)) {
        throw new BadRequestException(
          'confirmation_request needs request.targetTaskId and request.requestedStatus',
        );
      }
      // Validate target task belongs to this project (no cross-project asks).
      const t = await this.db.query.tasks.findFirst({
        where: eq(schema.tasks.id, targetTaskId),
      });
      if (!t) throw new NotFoundException('Target task not found');
      if (t.projectId !== projectId) {
        throw new ForbiddenException('Target task is not in this project');
      }
      request = {
        targetTaskId,
        requestedStatus,
        note: typeof body?.request?.note === 'string' ? body.request.note : undefined,
      };
    } else if (kind === 'material_request') {
      // Items: array of { inventoryItemId?, name, quantity, unit? }. We
      // require a non-empty name + quantity per row; everything else is
      // optional. inventoryItemId is a soft link, not validated.
      const rawItems = Array.isArray(body?.request?.items) ? body.request.items : [];
      const items = rawItems
        .filter((row: any) => row && typeof row === 'object')
        .map((row: any) => ({
          name: typeof row.name === 'string' ? row.name.trim() : '',
          quantity:
            typeof row.quantity === 'number'
              ? row.quantity
              : typeof row.quantity === 'string'
                ? row.quantity.trim()
                : '',
          unit: typeof row.unit === 'string' ? row.unit : undefined,
          inventoryItemId:
            typeof row.inventoryItemId === 'string' && row.inventoryItemId
              ? row.inventoryItemId
              : undefined,
        }))
        .filter((row: any) => row.name && row.quantity);
      if (items.length === 0) {
        throw new BadRequestException(
          'material_request needs at least one item with a name and quantity',
        );
      }
      request = {
        items,
        note: typeof body?.request?.note === 'string' ? body.request.note : undefined,
      };
    }

    // taskId on the report itself (subject of the report) — independent of
    // request.targetTaskId. The report can subject task A while requesting
    // a status change on task B (e.g. an order tied to a delivery).
    let taskId: string | null = null;
    if (body.taskId) {
      const t = await this.db.query.tasks.findFirst({
        where: eq(schema.tasks.id, body.taskId),
      });
      if (!t) throw new NotFoundException('Task not found');
      if (t.projectId !== projectId) {
        throw new ForbiddenException('Task is not in this project');
      }
      taskId = body.taskId;
    }

    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      columns: { businessId: true },
    });

    const reportCode = await this.reports.nextReportCode(projectId);

    const insert: any = {
      reportCode,
      projectId,
      businessId: proj?.businessId || null,
      taskId,
      title: typeof body.title === 'string' ? body.title.trim() || null : null,
      body: bodyText,
      kind,
      authorId: req.user?.uid || null,
      voiceUrl: typeof body.voiceUrl === 'string' ? body.voiceUrl : null,
      transcription:
        typeof body.transcription === 'string' ? body.transcription : null,
      attachments: this.normalizeAttachments(body.attachments),
      request,
      resolution: null,
      metadata:
        body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
    };

    const [created] = await this.db
      .insert(schema.fieldReports)
      .values(insert)
      .returning();

    const [hydrated] = await this.hydrateAuthors([created]);
    return { success: true, data: { ...hydrated, messages: [] } };
  }

  // ── UPDATE ──────────────────────────────────────────────────────────
  // Only the author or a project admin can edit. We keep this conservative:
  // body, attachments, voiceUrl/transcription, title. Resolution is only
  // touched via the dedicated /:id/resolve endpoint.
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const report = await this.db.query.fieldReports.findFirst({
      where: eq(schema.fieldReports.id, id),
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.projectId) await this.assertProjectAccess(report.projectId, req);

    const userId = req.user.uid;
    if (report.authorId && report.authorId !== userId) {
      // Allow project owner to edit anyone's report.
      const proj = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, report.projectId),
        columns: { ownerId: true },
      });
      if (proj?.ownerId !== userId) {
        throw new ForbiddenException('Only the author or project owner can edit');
      }
    }

    const patch: any = { updatedAt: new Date() };
    if (typeof body.body === 'string') patch.body = body.body;
    if (typeof body.title === 'string') patch.title = body.title.trim() || null;
    if (typeof body.voiceUrl === 'string') patch.voiceUrl = body.voiceUrl || null;
    if (typeof body.transcription === 'string')
      patch.transcription = body.transcription || null;
    if (body.attachments !== undefined)
      patch.attachments = this.normalizeAttachments(body.attachments);
    if (body.metadata !== undefined)
      patch.metadata =
        body.metadata && typeof body.metadata === 'object' ? body.metadata : null;

    const [updated] = await this.db
      .update(schema.fieldReports)
      .set(patch)
      .where(eq(schema.fieldReports.id, id))
      .returning();

    return { success: true, data: updated };
  }

  // ── DELETE ──────────────────────────────────────────────────────────
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const report = await this.db.query.fieldReports.findFirst({
      where: eq(schema.fieldReports.id, id),
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.projectId) await this.assertProjectAccess(report.projectId, req);

    const userId = req.user.uid;
    if (report.authorId && report.authorId !== userId) {
      const proj = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, report.projectId),
        columns: { ownerId: true },
      });
      if (proj?.ownerId !== userId) {
        throw new ForbiddenException('Only the author or project owner can delete');
      }
    }

    // Cascade handles the messages.
    await this.db.delete(schema.fieldReports).where(eq(schema.fieldReports.id, id));
    return { success: true };
  }

  // ── RESOLVE CONFIRMATION REQUEST ───────────────────────────────────
  // The supervisor (or any project member with a heart) acts on a
  // confirmation_request: accept it (which atomically updates the target
  // task's status) or decline it (which records the rejection).
  //
  // Body: { action: 'accept' | 'decline', note?: string }
  @Post(':id/resolve')
  async resolve(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const report = await this.db.query.fieldReports.findFirst({
      where: eq(schema.fieldReports.id, id),
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.projectId) await this.assertProjectAccess(report.projectId, req);

    if (
      report.kind !== 'confirmation_request' &&
      report.kind !== 'material_request'
    ) {
      throw new BadRequestException(
        'Only confirmation_request or material_request reports can be resolved',
      );
    }
    if (report.resolution) {
      throw new BadRequestException('Report already resolved');
    }

    const action = body?.action;
    if (action !== 'accept' && action !== 'decline') {
      throw new BadRequestException('action must be "accept" or "decline"');
    }

    const request: any = report.request || {};
    const note = typeof body?.note === 'string' ? body.note : undefined;
    const userId = req.user.uid;

    // Side effects only fire for confirmation_request — that's the kind
    // that has a structured "apply this change" payload. material_request
    // is just an acknowledge/deny — fulfilling the actual materials is a
    // separate workflow (typically a procurement invoice).
    if (action === 'accept' && report.kind === 'confirmation_request') {
      const target = await this.db.query.tasks.findFirst({
        where: eq(schema.tasks.id, request.targetTaskId),
      });
      if (target) {
        await this.db
          .update(schema.tasks)
          .set({ status: request.requestedStatus, updatedAt: new Date() })
          .where(eq(schema.tasks.id, request.targetTaskId));
      }
    }

    // Status word reads more naturally per kind. confirmation_request →
    // accepted/declined. material_request → fulfilled/declined.
    const acceptedStatus =
      report.kind === 'material_request' ? 'fulfilled' : 'accepted';
    const resolution = {
      status: action === 'accept' ? acceptedStatus : 'declined',
      resolvedById: userId,
      resolvedAt: new Date().toISOString(),
      note,
    };

    const [updated] = await this.db
      .update(schema.fieldReports)
      .set({ resolution, updatedAt: new Date() })
      .where(eq(schema.fieldReports.id, id))
      .returning();

    const [hydrated] = await this.hydrateAuthors([updated]);
    return { success: true, data: hydrated };
  }

  // ── THREAD: list messages ──────────────────────────────────────────
  // Detail() already returns messages, but a dedicated endpoint is handy
  // for refresh-after-post without re-fetching the whole report.
  @Get(':id/messages')
  async listMessages(@Param('id') id: string, @Req() req: any) {
    const report = await this.db.query.fieldReports.findFirst({
      where: eq(schema.fieldReports.id, id),
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.projectId) await this.assertProjectAccess(report.projectId, req);

    const messages = await this.db.query.fieldReportMessages.findMany({
      where: eq(schema.fieldReportMessages.reportId, id),
      orderBy: [schema.fieldReportMessages.createdAt],
    });

    const hydrated = await this.hydrateAuthors(messages);
    return { success: true, data: hydrated };
  }

  // ── THREAD: post message ───────────────────────────────────────────
  @Post(':id/messages')
  async postMessage(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const report = await this.db.query.fieldReports.findFirst({
      where: eq(schema.fieldReports.id, id),
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.projectId) await this.assertProjectAccess(report.projectId, req);

    const bodyText = typeof body.body === 'string' ? body.body.trim() : '';
    const voiceUrl = typeof body.voiceUrl === 'string' ? body.voiceUrl : null;
    const attachments = this.normalizeAttachments(body.attachments);

    if (!bodyText && !voiceUrl && !attachments) {
      throw new BadRequestException(
        'Message must contain body text, voice, or attachments',
      );
    }

    const insert: any = {
      reportId: id,
      authorId: req.user?.uid || null,
      body: bodyText || null,
      voiceUrl,
      transcription:
        typeof body.transcription === 'string' ? body.transcription : null,
      attachments,
      metadata:
        body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
    };

    const [created] = await this.db
      .insert(schema.fieldReportMessages)
      .values(insert)
      .returning();

    // Bump the report's updatedAt so list views can sort by recency.
    await this.db
      .update(schema.fieldReports)
      .set({ updatedAt: new Date() })
      .where(eq(schema.fieldReports.id, id));

    const [hydrated] = await this.hydrateAuthors([created]);
    return { success: true, data: hydrated };
  }

  // ── THREAD: delete message ─────────────────────────────────────────
  @Delete(':id/messages/:messageId')
  async deleteMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    const message = await this.db.query.fieldReportMessages.findFirst({
      where: eq(schema.fieldReportMessages.id, messageId),
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.reportId !== id)
      throw new BadRequestException('Message does not belong to this report');

    const report = await this.db.query.fieldReports.findFirst({
      where: eq(schema.fieldReports.id, id),
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.projectId) await this.assertProjectAccess(report.projectId, req);

    const userId = req.user.uid;
    if (message.authorId && message.authorId !== userId) {
      const proj = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, report.projectId),
        columns: { ownerId: true },
      });
      if (proj?.ownerId !== userId) {
        throw new ForbiddenException(
          'Only the author or project owner can delete this message',
        );
      }
    }

    await this.db
      .delete(schema.fieldReportMessages)
      .where(eq(schema.fieldReportMessages.id, messageId));

    return { success: true };
  }
}
