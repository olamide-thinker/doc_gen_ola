import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Inject,
  Req,
  NotFoundException,
  ForbiddenException,
  Delete
} from '@nestjs/common';
import { DRIZZLE_PROVIDER } from '../database/database.provider';
import * as schema from '../db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import { FirebaseGuard } from '../auth/firebase.guard';
import { InvoicesService } from './invoices.service';
import { PdfService } from '../pdf/pdf.service';

@Controller('api/invoices')
@UseGuards(FirebaseGuard)
export class InvoicesController {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private db: any,
    private invoicesService: InvoicesService,
    private pdfService: PdfService
  ) {}

  @Get(':id')
  async getInvoice(@Param('id') id: string, @Req() req: any) {
    // Fetch invoice first
    const invoice = await this.db.query.invoices.findFirst({
      where: eq(schema.invoices.id, id),
      with: { receipts: true }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Verify access: owner of invoice OR member of project (if linked to project)
    const userId = req.user.uid;
    const userEmail = req.user.email;

    if (invoice.userId !== userId) {
      // If linked to a project, check project membership
      if (invoice.projectId) {
        const project = await this.db.query.projects.findFirst({
          where: eq(schema.projects.id, invoice.projectId),
        });

        if (!project) {
          throw new NotFoundException('Parent project not found');
        }

        // Check if user is owner or member
        if (project.ownerId !== userId) {
          const member = await this.db.query.projectMembers.findFirst({
            where: and(
              eq(schema.projectMembers.projectId, invoice.projectId),
              or(
                eq(schema.projectMembers.userId, userId),
                userEmail ? eq(schema.projectMembers.email, userEmail) : undefined
              ).filter(Boolean),
            ),
          });

          if (!member) {
            throw new ForbiddenException('Not authorized to view this invoice');
          }
        }
      } else {
        // Invoice not linked to project and user is not the creator
        throw new ForbiddenException('Not authorized to view this invoice');
      }
    }

    const data = await this.invoicesService.computeInvoiceTotals(id);
    return {
      success: true,
      data: {
        ...data,
        name: invoice.name,
        draft: invoice.draft,
        receipts: invoice.receipts
      }
    };
  }

  // Endpoints for version management have been removed.

  /**
   * Creates a brand-new draft receipt attached to the given invoice.
   *
   * Bridge note: we insert a row into BOTH `receipts` (for the new versioned
   * model) AND `documents` (so the existing ReceiptEditor — which loads from
   * the documents table — can open and edit it). The two rows share the same
   * id so the editor URL `/receipt-editor/:id` resolves both sides.
   */
  @Post(':id/receipts')
  @UseGuards(FirebaseGuard)
  async createReceipt(@Param('id') invoiceId: string, @Body() body: any, @Req() req: any) {
    const invoice = await this.db.query.invoices.findFirst({
      where: eq(schema.invoices.id, invoiceId),
    });
    if (!invoice) throw new NotFoundException('Parent invoice not found');

    // 1. Calculate current financial state of the invoice
    const totals = await this.invoicesService.computeInvoiceTotals(invoiceId);
    const parentDraft: any = (invoice.draft as any) || {};
    
    const id = `rec_${Date.now()}`;
    
    // Robust prefill logic: Check multiple fields in case schema varies across migrations
    const project = parentDraft.title || invoice.name || 'Untitled Project';
    const locationStr = [parentDraft.contact?.address1, parentDraft.contact?.address2].filter(Boolean).join(', ') || parentDraft.location || '';

    const name = body.name || `Receipt ${new Date().toISOString().slice(0, 10)}`;

    // Seed a fully-shaped DocData template. We now map invoice data to receipt fields:
    // - Invoice Title -> Receipt Project (address1)
    // - Invoice Address -> Receipt Location (address2)
    // - Outstanding Balance -> Receipt Total Invoice Amount
    const defaultTemplate = {
      contact: {
        name: parentDraft.contact?.name || 'Client Name',
        address1: project,
        address2: locationStr,
        phone: parentDraft.contact?.phone || '',
        email: parentDraft.contact?.email || '',
      },
      title: `Payment for ${project}`,
      date: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      table: {
        columns: [
          { id: 'A', label: 'S/N', type: 'index', width: '60px' },
          { id: 'B', label: 'Description', type: 'text' },
          { id: 'C', label: 'Qty', type: 'number', width: '80px' },
          { id: 'D', label: 'Price (₦)', type: 'number', width: '140px' },
          { id: 'E', label: 'Total (₦)', type: 'formula', formula: 'C * D', width: '140px' },
        ],
        rows: [
          {
            id: `r-${Date.now()}`,
            rowType: 'row',
            B: 'Payment',
            C: 1,
            D: 0,
          },
        ],
        summary: [
          { id: 'subTotal', label: 'Sub Total', type: 'formula', formula: 'sum(E)' },
        ],
      },
      footer: { notes: '', emphasis: [] },
      isReceipt: true,
      useSections: false,
      showBOQSummary: false,
      totalInvoiceAmount: totals.outstanding,
      amountPaid: 0,
      invoiceCode: {
        text: `REC/IP/${String(Date.now()).slice(-4)}/${new Date().getFullYear()}`,
        prefix: 'REC',
        count: String(Date.now()).slice(-4),
        year: String(new Date().getFullYear()),
        x: 600,
        y: 100,
        color: '#503D36',
      },
    };
    const initialDraft = body.draft || body.content || defaultTemplate;

    // 1. Insert into receipts table (new versioned model)
    await this.db.insert(schema.receipts).values({
      id,
      invoiceId,
      draft: initialDraft,
      status: 'draft',
      projectId: invoice.projectId,
      businessId: invoice.businessId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Insert sibling row into documents table so ReceiptEditor can open it
    //    via /receipt-editor/:id without changes. The receipt id and document
    //    id are intentionally the same.
    await this.db.insert(schema.documents).values({
      id,
      userId: req.user?.uid || invoice.userId,
      name,
      url: '',
      mimetype: null,
      projectId: invoice.projectId,
      businessId: invoice.businessId,
      members: invoice.members || [req.user?.email],
      metadata: {
        content: initialDraft,
        invoiceId,
        isReceipt: true,
        receiptId: id,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { success: true, id };
  }

  @Post('receipts/:rid/finalise')
  @UseGuards(FirebaseGuard)
  async finaliseReceipt(@Param('rid') rid: string, @Req() req: any) {
    const receipt = await this.db.query.receipts.findFirst({
      where: eq(schema.receipts.id, rid),
    });

    if (!receipt) throw new NotFoundException('Receipt not found');

    // Bridge: ReceiptEditor saves to the documents table via the legacy
    // workspace endpoint, not directly to receipts.draft. If receipt.draft is
    // empty, fall back to the sibling document's stored content.
    let draftContent: any = receipt.draft;
    if (!draftContent || Object.keys(draftContent).length === 0) {
      const siblingDoc = await this.db.query.documents.findFirst({
        where: eq(schema.documents.id, rid),
      });
      const fromDoc = (siblingDoc?.metadata as any)?.content;
      if (fromDoc && Object.keys(fromDoc).length > 0) {
        draftContent = fromDoc;
        // Stamp it onto receipts.draft so future reads see the snapshot
        await this.db.update(schema.receipts)
          .set({ draft: draftContent, updatedAt: new Date() })
          .where(eq(schema.receipts.id, rid));
      } else {
        throw new NotFoundException('Receipt draft is empty');
      }
    }

    // Resolve real business via the parent invoice's businessId
    const parentInvoice = await this.db.query.invoices.findFirst({
      where: eq(schema.invoices.id, receipt.invoiceId),
    });
    const business = parentInvoice?.businessId
      ? await this.db.query.businesses.findFirst({
          where: eq(schema.businesses.id, parentInvoice.businessId),
        })
      : null;

    // 1. Generate PDF (Dedicated receipt template)
    const pdfFileName = `receipt_${rid}_finalised_${Date.now()}.pdf`;
    const docDef = this.pdfService.createReceiptDefinition(draftContent, {
      name: business?.name || 'Business',
    });
    const pdfUrl = await this.pdfService.generateAndSave(docDef, pdfFileName);
    
    // Update receipt status to finalised
    await this.db.update(schema.receipts)
      .set({ 
        status: 'finalised',
        updatedAt: new Date()
      })
      .where(eq(schema.receipts.id, rid));

    // Update parent invoice status to locked
    await this.db.update(schema.invoices)
      .set({
        status: 'locked',
        updatedAt: new Date()
      })
      .where(eq(schema.invoices.id, receipt.invoiceId));

    return { success: true, pdfUrl };
  }

  @Post('receipts/:rid/void')
  @UseGuards(FirebaseGuard)
  async voidReceipt(@Param('rid') rid: string, @Req() req: any) {
    const receipt = await this.db.query.receipts.findFirst({
      where: eq(schema.receipts.id, rid),
    });

    if (!receipt) throw new NotFoundException('Receipt not found');

    // Update receipt status to voided
    await this.db.update(schema.receipts)
      .set({ 
        status: 'voided',
        updatedAt: new Date()
      })
      .where(eq(schema.receipts.id, rid));

    // Check if there are any remaining finalised receipts
    const remainingReceipts = await this.db.query.receipts.findMany({
      where: eq(schema.receipts.invoiceId, receipt.invoiceId),
    });
    
    const hasFinalised = remainingReceipts.some((r: any) => r.status === 'finalised');

    // If no finalised receipts exist, unlock the invoice
    if (!hasFinalised) {
      await this.db.update(schema.invoices)
        .set({
          status: 'draft',
          updatedAt: new Date()
        })
        .where(eq(schema.invoices.id, receipt.invoiceId));
    }

    return { success: true };
  }

  @Delete('receipts/:rid')
  @UseGuards(FirebaseGuard)
  async deleteReceipt(@Param('rid') rid: string, @Req() req: any) {
    const receipt = await this.db.query.receipts.findFirst({
      where: eq(schema.receipts.id, rid),
    });

    if (!receipt) throw new NotFoundException('Receipt not found');
    
    // Only allow deleting drafts
    if (receipt.status !== 'draft') {
      throw new Error('Only draft receipts can be deleted');
    }

    // 1. Delete from receipts table
    await this.db.delete(schema.receipts).where(eq(schema.receipts.id, rid));
    
    // 2. Delete from documents table (sibling row)
    await this.db.delete(schema.documents).where(eq(schema.documents.id, rid));

    return { success: true };
  }

  @Post()
  @UseGuards(FirebaseGuard)
  async createInvoice(@Body() body: any, @Req() req: any) {
    try {
      const id = body.id || `inv_${Date.now()}`;
      // Always trust the authenticated Firebase UID over the body value
      const firebaseUid = req.user?.uid;
      const userId = firebaseUid || body.userId || 'dev-user';
      const projectId = body.projectId || null;

      // ── Ensure the user row exists ────────────────────────────────────────
      // The invoices table FK requires users.id to exist.  Firebase auth does
      // not automatically create a user row, so we upsert it here.
      if (firebaseUid) {
        await this.db.insert(schema.users)
          .values({
            id: firebaseUid,
            email: req.user?.email || 'unknown@system.com',
            fullName: req.user?.name || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.users.id,
            set: { updatedAt: new Date() },
          });
      }

      // ── Resolve project (FK guard) ─────────────────────────────────────────
      let resolvedProjectId: string | null = null;
      let businessId: string | null = null;

      if (projectId) {
        const proj = await this.db.query.projects.findFirst({
          where: eq(schema.projects.id, projectId)
        });
        if (proj) {
          resolvedProjectId = proj.id;
          businessId = proj.businessId || null;
        } else {
          console.warn(`[InvoicesController] ⚠️  Project ${projectId} not found in DB — creating invoice without project FK.`);
        }
      }

      const payload: any = {
        id,
        userId,
        projectId: resolvedProjectId,
        businessId,
        draft: body.payload || body.content || {},
        name: body.name || 'Untitled Invoice',
        updatedAt: new Date()
      };
      
      console.log('[InvoicesController] 📝 Creating/Updating invoice:', id, '| project:', resolvedProjectId);

      await this.db.insert(schema.invoices)
        .values(payload)
        .onConflictDoUpdate({
          target: schema.invoices.id,
          set: payload
        });
        
      return { success: true, id };
    } catch (error: any) {
      console.error('[InvoicesController] ❌ Error creating invoice:', error.message, error.code);
      return { success: false, message: error.message };
    }
  }
}
