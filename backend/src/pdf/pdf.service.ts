import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// pdfmake v0.3.x ships Babel-compiled CJS in js/ — use that to avoid the ESM
// resolution error thrown when Node loads the raw src/ directory.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: PdfPrinter } = require('pdfmake/js/Printer');

// Built-in PDFKit AFM fonts — no file paths or URL fetching required.
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// pdfmake v0.3.x always calls urlResolver.resolve() during createPdfKitDocument,
// even for built-in AFM fonts. Provide a no-op resolver to satisfy the interface.
const noopUrlResolver = {
  resolve: (_url: string, _headers: any) => { /* no-op — AFM fonts need no fetching */ },
  resolved: () => Promise.resolve(),
};

@Injectable()
export class PdfService {
  private printer: any;

  constructor() {
    this.printer = new PdfPrinter(fonts, undefined, noopUrlResolver);
  }

  /**
   * Generates a PDF from a document definition and saves it.
   * createPdfKitDocument is async in pdfmake v0.3.x — we must await it
   * before piping to the write stream so PDFKit receives a real document.
   */
  async generateAndSave(docDefinition: any, fileName: string): Promise<string> {
    const pdfDoc = await this.printer.createPdfKitDocument(docDefinition);

    const folderPath = path.join(process.cwd(), 'uploads', 'pdfs');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const filePath = path.join(folderPath, fileName);
    const writeStream = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
      pdfDoc.pipe(writeStream);
      pdfDoc.end();

      writeStream.on('finish', () => {
        resolve(`uploads/pdfs/${fileName}`);
      });

      writeStream.on('error', reject);
    });
  }

  /**
   * Template for Invoice PDF
   */
  createInvoiceDefinition(content: any, business: any) {
    return {
      content: [
        { text: business.name || 'BUSINESS NAME', style: 'header' },
        { text: 'INVOICE', style: 'subheader', alignment: 'right' },
        { text: `Invoice ID: ${content.invoiceNumber || 'N/A'}`, alignment: 'right' },
        { text: '\n\n' },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Bill To:', bold: true },
                { text: content.customerName || 'Customer Name' },
                { text: content.customerAddress || '' },
              ]
            },
            {
              width: '*',
              stack: [
                { text: 'Date:', bold: true },
                { text: content.date || new Date().toLocaleDateString() },
              ],
              alignment: 'right'
            }
          ]
        },
        { text: '\n\n' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 100, 100],
            body: [
              [{ text: 'Description', bold: true }, { text: 'Quantity', bold: true }, { text: 'Amount', bold: true }],
              ...(content.items || []).map((item: any) => [
                item.description || '',
                item.quantity || 1,
                (item.price || 0).toLocaleString()
              ])
            ]
          }
        },
        { text: '\n' },
        {
          stack: [
            { text: `Total: ${content.grandTotal?.toLocaleString() || 0}`, bold: true, fontSize: 14 }
          ],
          alignment: 'right'
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14, color: 'grey' }
      }
    };
  }
  /**
   * Template for Receipt PDF
   */
  createReceiptDefinition(doc: any, business: { name: string }) {
    const rows = doc?.table?.rows || [];
    const subTotal = rows.reduce((acc: number, row: any) => acc + (Number(row.D) || 0), 0);
    
    // Receipt-specific fields
    const receiptNumber = doc?.invoiceCode?.text || '—';
    const date = doc?.date || new Date().toLocaleDateString();
    const payerName = doc?.contact?.name || '—';
    const amountPaid = doc?.amountPaid || 0;
    const paymentMethod = doc?.paymentMethod || 'Transfer';
    const ref = doc?.reference || '';

    return {
      content: [
        { text: business.name.toUpperCase(), style: 'header' },
        { text: 'PAYMENT RECEIPT', style: 'subheader', margin: [0, 4, 0, 12] },
        { 
          columns: [
            { text: `Receipt #: ${receiptNumber}`, bold: true },
            { text: `Date: ${date}`, alignment: 'right' }
          ]
        },
        { text: '\n' },
        { text: `Received from: ${payerName}`, margin: [0, 8, 0, 4] },
        { text: `Amount: ₦${Number(amountPaid).toLocaleString()}`, bold: true, fontSize: 14, margin: [0, 0, 0, 12] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Description', bold: true }, { text: 'Amount', bold: true, alignment: 'right' }],
              ...rows.filter((r: any) => r.rowType === 'row').map((it: any) => [
                it.B || '',
                { text: `₦${Number(it.D || 0).toLocaleString()}`, alignment: 'right' },
              ]),
              [{ text: 'TOTAL', bold: true }, { text: `₦${Number(subTotal).toLocaleString()}`, bold: true, alignment: 'right' }],
            ],
          },
        },
        { text: '\n' },
        { 
          stack: [
            { text: `Payment Method: ${paymentMethod}`, fontSize: 9 },
            { text: `Reference: ${ref}`, fontSize: 9 },
          ]
        },
        { text: doc?.receiptMessage || '', italics: true, margin: [0, 16, 0, 0] },
      ],
      styles: {
        header: { fontSize: 20, bold: true },
        subheader: { fontSize: 12, bold: true, color: '#888' },
      },
      defaultStyle: { fontSize: 10 },
    };
  }
}
