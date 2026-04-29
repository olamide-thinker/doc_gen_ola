import {
  Controller,
  Get,
  Param,
  UseGuards,
  Inject,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import { InvoicesService } from '../invoices/invoices.service';

@Controller('api/accounting')
@UseGuards(FirebaseGuard)
export class AccountingController {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private db: any,
    private invoicesService: InvoicesService,
  ) {}

  /** Project-membership gate. Mirrors TasksController. */
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

  /** Compute an invoice's grand total via the existing service helper. */
  private invoiceTotal(invoice: any): number {
    let t = 0;
    try {
      t = this.invoicesService.calculateInvoiceTotals(invoice.draft);
    } catch {
      t = 0;
    }
    if (!t && invoice.draft) {
      const d: any = invoice.draft;
      t =
        Number(d.grandTotal) ||
        Number(d?.totalPrice?.grandTotal) ||
        Number(d?.totalInvoiceAmount) ||
        Number(d?.table?.totalPrice?.grandTotal) ||
        0;
    }
    return t;
  }

  /**
   * Project-wide transaction log.
   *
   * Each row = one finalised receipt (because that's actual spend). For
   * each receipt we resolve:
   *   - parent invoice (for its grand total, name, template type, and
   *     the metadata-stamped categoryId / counterpartyMemberId)
   *   - linked task (via invoice.metadata.taskId or receipt.metadata.taskId)
   *   - category record (from inventory_categories)
   *   - counterparty record (from project_members)
   *
   * Aggregates:
   *   - totalBudget — sum of project invoices' grand totals
   *   - totalSpent  — sum of finalised receipts' amountPaid
   *   - totalSaved  — totalBudget − totalSpent
   */
  @Get(':projectId')
  async transactionLog(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    await this.assertProjectAccess(projectId, req);

    // Pull the full project + business context once (fewer roundtrips).
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    if (!project) throw new NotFoundException('Project not found');

    // 1. All invoices in the project
    const invoices = await this.db.query.invoices.findMany({
      where: eq(schema.invoices.projectId, projectId),
    });
    const invoiceById = new Map<string, any>();
    let totalBudget = 0;
    for (const inv of invoices) {
      const t = this.invoiceTotal(inv);
      invoiceById.set(inv.id, { ...inv, _grandTotal: t });
      totalBudget += t;
    }

    // 2. All finalised receipts under those invoices
    const invoiceIds = invoices.map((i: any) => i.id);
    let receipts: any[] = [];
    if (invoiceIds.length > 0) {
      receipts = await this.db.query.receipts.findMany({
        where: and(
          eq(schema.receipts.projectId, projectId),
          eq(schema.receipts.status, 'finalised'),
        ),
        orderBy: [desc(schema.receipts.createdAt)],
      });
    }

    // 3. Lookup tables — categories (business-scoped) and members
    const categories = project.businessId
      ? await this.db.query.inventoryCategories.findMany({
          where: eq(schema.inventoryCategories.businessId, project.businessId),
        })
      : [];
    const categoryById = new Map<string, any>();
    for (const c of categories) categoryById.set(c.id, c);

    const members = await this.db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.projectId, projectId),
    });
    const memberById = new Map<string, any>();
    for (const m of members) memberById.set(m.id, m);

    // 4. Tasks (so we can render the task pill on each row)
    const tasks = await this.db.query.tasks.findMany({
      where: eq(schema.tasks.projectId, projectId),
    });
    const taskById = new Map<string, any>();
    for (const t of tasks) taskById.set(t.id, t);

    // 5. Build the transaction rows
    let totalSpent = 0;
    const transactions: any[] = [];

    for (const r of receipts) {
      const invoice = invoiceById.get(r.invoiceId);
      if (!invoice) continue; // orphan receipt — skip
      const draft: any = r.draft || {};
      const amountPaid = Number(draft.amountPaid) || 0;
      totalSpent += amountPaid;

      const invoiceMeta: any = invoice.metadata || {};
      const receiptMeta: any = r.metadata || {};

      // Task link prefers receipt-level (more specific) over invoice-level.
      const linkedTaskId = receiptMeta.taskId || invoiceMeta.taskId || null;
      const task = linkedTaskId ? taskById.get(linkedTaskId) : null;

      // Category prefers invoice-level (where the user sets it).
      const categoryId = invoiceMeta.categoryId || null;
      const category = categoryId ? categoryById.get(categoryId) : null;

      const counterpartyMemberId = invoiceMeta.counterpartyMemberId || null;
      const member = counterpartyMemberId
        ? memberById.get(counterpartyMemberId)
        : null;

      const grandTotal = invoice._grandTotal || 0;
      const percentPaid = grandTotal > 0 ? Math.min(100, Math.round((amountPaid / grandTotal) * 100)) : 0;

      // "After-Auto" flag: was the linked task's status flipped by an
      // accepted confirmation_request? We surface this so the user can
      // see auto-resolved transactions at a glance — same vibe as the
      // amber "After-Auto" pill in the design.
      let autoApplied = false;
      if (task) {
        const matchingReports = await this.db.query.fieldReports.findMany({
          where: and(
            eq(schema.fieldReports.projectId, projectId),
            eq(schema.fieldReports.kind, 'confirmation_request'),
          ),
        });
        autoApplied = matchingReports.some(
          (rep: any) =>
            rep?.request?.targetTaskId === task.id &&
            rep?.resolution?.status === 'accepted',
        );
      }

      transactions.push({
        id: r.id,
        invoiceId: invoice.id,
        invoiceCode: `#INV-${invoice.id.slice(-6).toLowerCase()}`,
        invoiceName: invoice.name,
        invoiceTemplateType: (invoice.draft as any)?.templateType || null,
        amountPaid,
        invoiceTotal: grandTotal,
        percentPaid,
        taskId: task?.id || null,
        taskCode: task?.taskCode || null,
        taskTitle: task?.title || null,
        taskStatus: task?.status || null,
        taskBudget: task?.budget || null,
        categoryId,
        categoryName: category?.name || null,
        categoryColor: category?.color || null,
        counterpartyMemberId,
        counterpartyName: member
          ? member.kind === 'company' || member.kind === 'vendor'
            ? member.displayName
            : member.displayName || member.email || member.userId
          : null,
        counterpartyKind: member?.kind || null,
        receiptUrl: receiptMeta.pdfUrl || null,
        createdAt: r.createdAt,
        autoApplied,
      });
    }

    return {
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          ownerId: project.ownerId,
        },
        totalBudget,
        totalSpent,
        totalSaved: totalBudget - totalSpent,
        transactionCount: transactions.length,
        transactions,
      },
    };
  }
}
