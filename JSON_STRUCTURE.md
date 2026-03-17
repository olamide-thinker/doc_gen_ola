# Document JSON Structure

This document defines the JSON schema used for storing and rendering documents in Shan Docs.

## Overview

A document is represented as a `DocData` object, which contains contact information, a title, a date, table data (columns, rows, and summaries), footer notes, and custom positioned elements like the invoice code.

## Data Schema (`DocData`)

```typescript
interface DocData {
  contact: Contact;         // Recipient information
  title: string;           // Main title of the document
  date: string;            // Formatted date string
  table: {
    columns: TableColumn[]; // Definitions for table columns
    rows: TableRow[];      // Data for each row
    summary: SummaryItem[]; // Summary rows (Subtotal, VAT, etc.)
  };
  footer: {
    notes: string;         // HTML string for notes (Tiptap editor)
    emphasis: Array<{ key: string; value: string }>; // Key-value highlights
  };
  invoiceCode?: InvoiceCode; // Draggable invoice identifier
}
```

---

### 1. Contact
Information about the document recipient.
- `name`: Full name or company name.
- `address1`: Primary address line.
- `address2`: Secondary address line.

### 2. Table Column (`TableColumn`)
Defines the structure and behavior of a table column.
- `id`: Unique identifier (e.g., "A", "B").
- `label`: Display name in the header.
- `type`: One of `"index"`, `"text"`, `"number"`, or `"formula"`.
- `formula`: (Optional) Javascript-like expression (e.g., `C * D`).
- `width`: (Optional) CSS width (e.g., `"80px"`).

### 3. Table Row (`TableRow`)
An object where keys match column IDs.
- Example: `{ "B": "Maintenance Service", "C": 1, "D": 5000 }`

### 4. Summary Item (`SummaryItem`)
Defines rows at the bottom of the table for totals and taxes.
- `id`: Unique identifier.
- `label`: Display label.
- `type`: `"number"` or `"formula"`.
- `formula`: (Optional) Expression involving `subTotal` or previous summary IDs (e.g., `subTotal * 0.075`).

### 5. Invoice Code (`InvoiceCode`)
A draggable element typically placed in the header.
- `text`: The formatted code (e.g., `SI/024/2026`).
- `x`, `y`: Absolute pixel position relative to the document corner.
- `color`: HEX color string.

---

## Example JSON

```json
{
  "contact": {
    "name": "OLUWAKEMI ISINKAYE",
    "address1": "Prime Waters Garden II",
    "address2": "Lekki Phase 1"
  },
  "title": "Maintenance Proposal for 5 Bedroom Apartment",
  "date": "17 March 2026",
  "table": {
    "columns": [
      { "id": "A", "label": "S/N", "type": "index", "width": "60px" },
      { "id": "B", "label": "Description", "type": "text" },
      { "id": "C", "label": "Qty", "type": "number", "width": "80px" },
      { "id": "D", "label": "Price", "type": "number", "width": "140px" },
      { "id": "E", "label": "Total", "type": "formula", "formula": "C * D", "width": "140px" }
    ],
    "rows": [
      { "B": "AC Servicing", "C": 2, "D": 25000 },
      { "B": "Plumbing Repair", "C": 1, "D": 15000 }
    ],
    "summary": [
      { "id": "vat", "label": "VAT (7.5%)", "type": "formula", "formula": "subTotal * 0.075" }
    ]
  },
  "footer": {
    "notes": "<p>Thank you for your business!</p>",
    "emphasis": [
      { "key": "ACCOUNT", "value": "A/C: 1023456789 - Bank XYZ" }
    ]
  },
  "invoiceCode": {
    "text": "SI/024/2026",
    "x": 600,
    "y": 100,
    "color": "#503D36"
  }
}
```
