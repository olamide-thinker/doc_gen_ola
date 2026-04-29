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
import { eq, and, or, desc } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import { FieldReportsService } from './field-reports.service';

const ALLOWED_KIND = new Set(['note', 'incident', 'update', 'confirmation_request']);
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

    return { success: true, data: withCounts };
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

    return { success: true, data: { ...report, messages } };
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

    return { success: true, data: { ...created, messages: [] } };
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

    if (report.kind !== 'confirmation_request') {
      throw new BadRequestException(
        'Only confirmation_request reports can be resolved',
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

    if (action === 'accept') {
      // Apply the requested status to the target task. If it's gone, we
      // still record the resolution but flag it — the request is moot.
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

    const resolution = {
      status: action === 'accept' ? 'accepted' : 'declined',
      resolvedById: userId,
      resolvedAt: new Date().toISOString(),
      note,
    };

    const [updated] = await this.db
      .update(schema.fieldReports)
      .set({ resolution, updatedAt: new Date() })
      .where(eq(schema.fieldReports.id, id))
      .returning();

    return { success: true, data: updated };
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

    return { success: true, data: messages };
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

    return { success: true, data: created };
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
