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
import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import { TasksService } from './tasks.service';
import { InvoicesService } from '../invoices/invoices.service';

const ALLOWED_STATUS = new Set(['pending', 'progress', 'done', 'cancelled']);
const ALLOWED_PRIORITY = new Set(['low', 'med', 'high']);
const ALLOWED_LOCATION_TYPE = new Set(['zone', 'text']);

interface MaterialRow {
  name?: string;
  quantity?: number | string;
  unit?: string;
  note?: string;
}

@Controller('api/tasks')
@UseGuards(FirebaseGuard)
export class TasksController {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private db: any,
    private tasks: TasksService,
    private invoicesService: InvoicesService,
  ) {}

  /** Project-membership gate. Mirrors the WorkspacesController helper. */
  private async assertProjectAccess(
    projectId: string,
    req: any,
  ): Promise<void> {
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
   * Batched user lookup for the three FK columns on tasks (createdById,
   * supervisorId, assigneeId). Single SQL roundtrip regardless of how
   * many rows we hand it. Decorates each row with `createdBy`,
   * `supervisor`, `assignee` objects (slim public profiles).
   *
   * Original ID columns stay intact for backward compat — frontends can
   * read `task.assignee?.fullName ?? task.assigneeId` and ride out the
   * migration without breaking on rows that haven't been hydrated yet.
   */
  private async hydrateUsers<T extends {
    createdById?: string | null;
    supervisorId?: string | null;
    assigneeId?: string | null;
  }>(rows: T[]): Promise<Array<T & {
    createdBy: { id: string; fullName: string | null; email: string } | null;
    supervisor: { id: string; fullName: string | null; email: string } | null;
    assignee: { id: string; fullName: string | null; email: string } | null;
  }>> {
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.createdById) ids.add(r.createdById);
      if (r.supervisorId) ids.add(r.supervisorId);
      if (r.assigneeId) ids.add(r.assigneeId);
    }
    if (ids.size === 0) {
      return rows.map(r => ({ ...r, createdBy: null, supervisor: null, assignee: null }));
    }
    const users = await this.db.query.users.findMany({
      where: inArray(schema.users.id, Array.from(ids)),
      columns: { id: true, fullName: true, email: true },
    });
    const userMap = new Map<string, any>();
    for (const u of users) userMap.set(u.id, u);
    return rows.map(r => ({
      ...r,
      createdBy: r.createdById ? userMap.get(r.createdById) || null : null,
      supervisor: r.supervisorId ? userMap.get(r.supervisorId) || null : null,
      assignee: r.assigneeId ? userMap.get(r.assigneeId) || null : null,
    }));
  }

  /** Coerce/validate the materials field. Returns null when empty/invalid. */
  private normalizeMaterials(input: unknown): MaterialRow[] | null {
    if (!Array.isArray(input)) return null;
    const rows = input
      .filter((row): row is Record<string, any> => row && typeof row === 'object')
      .map((row): MaterialRow => ({
        name: typeof row.name === 'string' ? row.name : '',
        quantity:
          typeof row.quantity === 'number'
            ? row.quantity
            : typeof row.quantity === 'string'
              ? row.quantity
              : undefined,
        unit: typeof row.unit === 'string' ? row.unit : undefined,
        note: typeof row.note === 'string' ? row.note : undefined,
      }))
      .filter(r => r.name && r.name.trim().length > 0);
    return rows.length > 0 ? rows : null;
  }

  /** ─── LIST ──────────────────────────────────────────────────────── */
  @Get()
  async list(
    @Query('projectId') projectId: string,
    @Query('status') status: string | undefined,
    @Query('assigneeId') assigneeId: string | undefined,
    @Query('priority') priority: string | undefined,
    @Req() req: any,
  ) {
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);

    const conds: any[] = [eq(schema.tasks.projectId, projectId)];
    if (status && ALLOWED_STATUS.has(status))
      conds.push(eq(schema.tasks.status, status));
    if (priority && ALLOWED_PRIORITY.has(priority))
      conds.push(eq(schema.tasks.priority, priority));
    if (assigneeId) conds.push(eq(schema.tasks.assigneeId, assigneeId));

    const rows = await this.db.query.tasks.findMany({
      where: conds.length === 1 ? conds[0] : and(...conds),
      orderBy: [desc(schema.tasks.createdAt)],
    });

    const hydrated = await this.hydrateUsers(rows);
    return { success: true, data: hydrated };
  }

  /** ─── CREATE ────────────────────────────────────────────────────── */
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const projectId = body?.projectId;
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertProjectAccess(projectId, req);

    const title = String(body.title || '').trim();
    if (!title) throw new BadRequestException('title is required');

    // Resolve project's businessId so we can stamp the task with it
    const proj = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      columns: { businessId: true },
    });

    const taskCode = await this.tasks.nextTaskCode(projectId);

    // Normalise + validate
    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'pending';
    const priority = ALLOWED_PRIORITY.has(body.priority) ? body.priority : 'med';
    const locationType = ALLOWED_LOCATION_TYPE.has(body.locationType)
      ? body.locationType
      : null;

    const insert: any = {
      taskCode,
      projectId,
      businessId: proj?.businessId || null,

      title,
      details: typeof body.details === 'string' ? body.details : null,
      status,
      priority,

      deadline: body.deadline ? new Date(body.deadline) : null,

      createdById: req.user?.uid || null,
      supervisorId: body.supervisorId || null,
      assigneeId: body.assigneeId || null,
      crewIds: Array.isArray(body.crewIds)
        ? body.crewIds.filter((c: any) => typeof c === 'string')
        : null,

      materials: this.normalizeMaterials(body.materials),
      budget:
        typeof body.budget === 'number' && Number.isFinite(body.budget)
          ? Math.round(body.budget)
          : null,

      locationType,
      locationDocId:
        locationType === 'zone' ? body.locationDocId || null : null,
      locationZoneId:
        locationType === 'zone' ? body.locationZoneId || null : null,
      locationText:
        locationType === 'text' ? body.locationText || null : null,

      stageId: body.stageId || null,
      milestoneId: body.milestoneId || null,

      metadata: body.metadata && typeof body.metadata === 'object'
        ? body.metadata
        : null,
    };

    const [created] = await this.db
      .insert(schema.tasks)
      .values(insert)
      .returning();

    const [hydrated] = await this.hydrateUsers([created]);
    return { success: true, data: hydrated };
  }

  /** ─── DETAIL ────────────────────────────────────────────────────── */
  @Get(':id')
  async detail(@Param('id') id: string, @Req() req: any) {
    const row = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.id, id),
    });
    if (!row) throw new NotFoundException('Task not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);
    const [hydrated] = await this.hydrateUsers([row]);
    return { success: true, data: hydrated };
  }

  /** ─── FINANCIALS (rollup of linked invoices/receipts) ─────────────
   * Read-time aggregation. Invoices and receipts are stamped with
   * `metadata.taskId` when linked, so we filter by that JSONB key and
   * sum amounts. No bookkeeping table — the totals are always live.
   *
   * Returns:
   *   - task: { id, taskCode, title, budget }
   *   - totalCost: budget if set, else sum of linked-invoice grand totals
   *   - totalPaid: sum of finalised receipts' amountPaid
   *   - balance:  totalCost - totalPaid
   *   - invoices[]: { id, name, status, total, totalPaid }
   *   - receipts[]: { id, invoiceId, status, amountPaid, createdAt }
   */
  @Get(':id/financials')
  async financials(@Param('id') id: string, @Req() req: any) {
    const task = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.id, id),
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.projectId) await this.assertProjectAccess(task.projectId, req);

    // ── Linked invoices ──────────────────────────────────────────────
    // Filter by both projectId (cheap) and metadata->>'taskId' so we
    // never cross-leak across projects even if metadata gets duplicated.
    const linkedInvoices = await this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.projectId, task.projectId),
          sql`${schema.invoices.metadata}->>'taskId' = ${id}`,
        ),
      );

    const invoiceRows: any[] = [];
    const receiptRows: any[] = [];
    const seenReceiptIds = new Set<string>(); // de-dupe across cascade + direct link
    let totalLinkedInvoiceAmount = 0;
    let totalPaidRollup = 0;

    for (const inv of linkedInvoices) {
      let total = 0;
      try {
        total = this.invoicesService.calculateInvoiceTotals(inv.draft);
      } catch {
        total = 0;
      }
      // Fallback: pre-calculated values frontends sometimes stash on draft.
      if (!total && inv.draft) {
        const d: any = inv.draft;
        total =
          Number(d.grandTotal) ||
          Number(d?.totalPrice?.grandTotal) ||
          Number(d?.totalInvoiceAmount) ||
          Number(d?.table?.totalPrice?.grandTotal) ||
          0;
      }
      totalLinkedInvoiceAmount += total;

      // Cascade: any finalised receipt on a linked invoice counts toward
      // the task's paid total. Linking an invoice carries its payments
      // along — this matches the user's mental model that "the money
      // that flowed through this invoice was for this task".
      const recs = await this.db.query.receipts.findMany({
        where: and(
          eq(schema.receipts.invoiceId, inv.id),
          eq(schema.receipts.status, 'finalised'),
        ),
      });
      let invPaid = 0;
      for (const r of recs) {
        const d: any = r.draft || {};
        const amt = Number(d.amountPaid) || 0;
        invPaid += amt;
        if (!seenReceiptIds.has(r.id)) {
          seenReceiptIds.add(r.id);
          totalPaidRollup += amt;
          receiptRows.push({
            id: r.id,
            invoiceId: r.invoiceId,
            status: r.status,
            amountPaid: amt,
            createdAt: r.createdAt,
            linkedVia: 'invoice', // surfaced via parent invoice's task link
          });
        }
      }

      invoiceRows.push({
        id: inv.id,
        name: inv.name,
        status: inv.status,
        templateType: (inv.draft as any)?.templateType || null,
        total,
        totalPaid: invPaid,
        createdAt: inv.createdAt,
      });
    }

    // ── Directly-linked receipts (parent invoice not linked) ─────────
    // A receipt can be earmarked to a task even if its parent invoice
    // isn't — useful when one big invoice covers multiple tasks, or
    // when spend came in via a receipt-first flow.
    const linkedReceipts = await this.db
      .select()
      .from(schema.receipts)
      .where(
        and(
          eq(schema.receipts.projectId, task.projectId),
          sql`${schema.receipts.metadata}->>'taskId' = ${id}`,
        ),
      );

    for (const r of linkedReceipts) {
      if (seenReceiptIds.has(r.id)) continue; // already counted via cascade
      const d: any = r.draft || {};
      const amt = Number(d.amountPaid) || 0;
      // Only finalised receipts contribute to totalPaid; drafts still
      // surface in the list but flagged so the user sees them.
      if (r.status === 'finalised') totalPaidRollup += amt;
      seenReceiptIds.add(r.id);
      receiptRows.push({
        id: r.id,
        invoiceId: r.invoiceId,
        status: r.status,
        amountPaid: amt,
        createdAt: r.createdAt,
        linkedVia: 'direct',
      });
    }

    // ── Roll up ──────────────────────────────────────────────────────
    // totalCost preference: explicit task.budget if set, else the sum
    // of the linked invoices (so even unbudgeted tasks show a number).
    const totalCost =
      typeof task.budget === 'number' && Number.isFinite(task.budget)
        ? task.budget
        : totalLinkedInvoiceAmount;
    const totalPaid = totalPaidRollup;
    const balance = totalCost - totalPaid;

    return {
      success: true,
      data: {
        task: {
          id: task.id,
          taskCode: task.taskCode,
          title: task.title,
          budget: task.budget,
        },
        totalCost,
        totalPaid,
        balance,
        linkedInvoiceTotal: totalLinkedInvoiceAmount,
        invoices: invoiceRows,
        receipts: receiptRows,
      },
    };
  }

  /** ─── UPDATE ────────────────────────────────────────────────────── */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const row = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.id, id),
    });
    if (!row) throw new NotFoundException('Task not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);

    const patch: any = { updatedAt: new Date() };

    if (typeof body.title === 'string') patch.title = body.title.trim();
    if (typeof body.details === 'string') patch.details = body.details;
    if (typeof body.status === 'string' && ALLOWED_STATUS.has(body.status))
      patch.status = body.status;
    if (typeof body.priority === 'string' && ALLOWED_PRIORITY.has(body.priority))
      patch.priority = body.priority;
    if (body.deadline !== undefined)
      patch.deadline = body.deadline ? new Date(body.deadline) : null;

    if (body.supervisorId !== undefined)
      patch.supervisorId = body.supervisorId || null;
    if (body.assigneeId !== undefined)
      patch.assigneeId = body.assigneeId || null;
    if (body.crewIds !== undefined)
      patch.crewIds = Array.isArray(body.crewIds)
        ? body.crewIds.filter((c: any) => typeof c === 'string')
        : null;

    if (body.materials !== undefined)
      patch.materials = this.normalizeMaterials(body.materials);
    if (body.budget !== undefined)
      patch.budget =
        typeof body.budget === 'number' && Number.isFinite(body.budget)
          ? Math.round(body.budget)
          : null;

    if (body.locationType !== undefined) {
      const lt = ALLOWED_LOCATION_TYPE.has(body.locationType)
        ? body.locationType
        : null;
      patch.locationType = lt;
      patch.locationDocId = lt === 'zone' ? body.locationDocId || null : null;
      patch.locationZoneId = lt === 'zone' ? body.locationZoneId || null : null;
      patch.locationText = lt === 'text' ? body.locationText || null : null;
    }

    if (body.stageId !== undefined) patch.stageId = body.stageId || null;
    if (body.milestoneId !== undefined)
      patch.milestoneId = body.milestoneId || null;

    if (body.metadata !== undefined)
      patch.metadata =
        body.metadata && typeof body.metadata === 'object' ? body.metadata : null;

    const [updated] = await this.db
      .update(schema.tasks)
      .set(patch)
      .where(eq(schema.tasks.id, id))
      .returning();

    const [hydrated] = await this.hydrateUsers([updated]);
    return { success: true, data: hydrated };
  }

  /** ─── DELETE ────────────────────────────────────────────────────── */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const row = await this.db.query.tasks.findFirst({
      where: eq(schema.tasks.id, id),
    });
    if (!row) throw new NotFoundException('Task not found');
    if (row.projectId) await this.assertProjectAccess(row.projectId, req);

    await this.db.delete(schema.tasks).where(eq(schema.tasks.id, id));
    return { success: true };
  }
}
