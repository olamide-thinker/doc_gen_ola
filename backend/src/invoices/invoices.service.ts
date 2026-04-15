import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import * as schema from '../db/schema';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { DRIZZLE_PROVIDER } from '../database/database.provider';

@Injectable()
export class InvoicesService {
  constructor(@Inject(DRIZZLE_PROVIDER) private db: any) {}



  /**
   * Helper to calculate grand total from raw content.
   * Reproduces the frontend logic to ensure consistency.
   */
  calculateInvoiceTotals(content: any): number {
    if (!content || !content.table) return 0;
    
    try {
       const rows = content.table.rows || [];
       const columns = content.table.columns || [];
       const summaries = content.table.summary || [];

       // Find the last numeric/formula column (the "Total" column)
       const totalCol = [...columns].reverse().find(
         (c) => (c.type === 'formula' || c.type === 'number') && !c.hidden
       );

       if (!totalCol) return 0;

        // 1. Calculate Subtotal
        let subTotal = 0;
        for (const row of rows) {
          if (row.rowType && row.rowType !== 'row') continue;
          
          let rowVal = 0;
          if (totalCol.type === 'formula' && totalCol.formula) {
            let expr = totalCol.formula;
            // Match both uppercase (C, D) and camelCase/lowercase (qty, price) IDs
            const matches = expr.match(/[a-zA-Z]+/g) || [];
            matches.forEach(cid => {
              // Sanitize value: remove commas and parse as number
              const rawVal = String(row[cid] || '0').replace(/,/g, '');
              expr = expr.replace(new RegExp(`\\b${cid}\\b`, 'g'), String(Number(rawVal) || 0));
            });
            try {
              if (/^[0-9.()+\-*/\s]+$/.test(expr)) {
                rowVal = eval(expr);
              }
            } catch(e) {}
          } else {
            const rawVal = String(row[totalCol.id] || '0').replace(/,/g, '');
            rowVal = Number(rawVal) || 0;
          }
          subTotal += rowVal;
        }

       // 2. Apply Summary Items
       let currentRunningTotal = subTotal;
       const prevSummaryValues = {};

       for (let i = 0; i < summaries.length; i++) {
         const item = summaries[i];
         const displayId = String.fromCharCode(65 + i);
         
         let val = 0;
         if (item.type === 'formula' && item.formula) {
           let expression = item.formula
             .replace(/subTotal/g, String(subTotal))
             .replace(/prev/g, String(currentRunningTotal))
             .replace(/(\d*\.?\d+)\s*%/g, '($1/100)');
           
           Object.keys(prevSummaryValues).forEach(key => {
             expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), String(prevSummaryValues[key]));
           });

           try {
             if (/^[0-9.()+\-*/\s]+$/.test(expression)) {
               val = eval(expression);
             }
           } catch (e) {}
         } else {
           val = Number(item.value) || 0;
         }

         prevSummaryValues[displayId] = val;
         currentRunningTotal += val;
       }

       return currentRunningTotal;
    } catch (e) {
       console.error('[InvoicesService] calculation failed:', (e as any).message);
       return 0;
    }
  }

  /**
   * Recomputes totals for an invoice based on its current draft content and finalised receipts.
   * This is the "Source of Truth" for financial state.
   */
  async computeInvoiceTotals(invoiceId: string) {
    // 1. Fetch current invoice record
    let invoice = await this.db.query.invoices.findFirst({
      where: eq(schema.invoices.id, invoiceId),
    });

    // FALLBACK: If not in invoices table, check legacy documents table
    if (!invoice) {
      console.log(`[InvoicesService] 🔍 Invoice ${invoiceId} not found in invoices table. Checking legacy documents...`);
      const legacyDoc = await this.db.query.documents.findFirst({
        where: eq(schema.documents.id, invoiceId),
      });

      if (legacyDoc) {
        console.log(`[InvoicesService] 🚀 Found legacy document ${invoiceId}. Auto-migrating to invoices table...`);
        // Promote to invoice table
        const migrated = {
          id: legacyDoc.id,
          userId: legacyDoc.userId,
          projectId: legacyDoc.projectId,
          businessId: legacyDoc.businessId,
          name: legacyDoc.name,
          draft: legacyDoc.content || {},
          metadata: legacyDoc.metadata || {},
          members: legacyDoc.members || [],
          status: 'draft',
          updatedAt: new Date()
        };

        await this.db.insert(schema.invoices).values(migrated).onConflictDoUpdate({
          target: schema.invoices.id,
          set: migrated
        });

        invoice = await this.db.query.invoices.findFirst({
          where: eq(schema.invoices.id, invoiceId),
        });
      }
    }

    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found in any storage`);

    // 2. Fetch all finalised receipts for this invoice
    const activeReceipts = await this.db.query.receipts.findMany({
      where: and(
        eq(schema.receipts.invoiceId, invoiceId),
        eq(schema.receipts.status, 'finalised')
      ),
      orderBy: [asc(schema.receipts.createdAt)],
    });

    // 3. Aggregate
    let grandTotal = this.calculateInvoiceTotals(invoice.draft);
    
    // FALLBACK: If calculated total is 0, check for pre-calculated values in common frontend locations
    if (grandTotal === 0 && invoice.draft) {
      const d: any = invoice.draft;
      grandTotal = d.grandTotal || 
                  d.totalPrice?.grandTotal || 
                  d.totalInvoiceAmount || 
                  d.table?.totalPrice?.grandTotal || 0;
    }

    let totalPaid = 0;
    const chain: any[] = [];

    let remainingBefore = grandTotal;

    for (const r of activeReceipts) {
      const amountPaid = (r.draft as any)?.amountPaid || 0;
      const remainingAfter = remainingBefore - amountPaid;
      
      totalPaid += amountPaid;

      chain.push({
        receiptId: r.id,
        amountPaid,
        remainingBefore,
        remainingAfter,
        publishedAt: r.updatedAt,
        publisherName: "User", // Simplified for now
        sequence: chain.length + 1
      });

      remainingBefore = remainingAfter;
    }

    const outstanding = grandTotal - totalPaid;

    return {
      invoiceId,
      status: invoice.status,
      grandTotal,
      totalPaid,
      outstanding,
      chain,
    };
  }
}
