export interface Contact {
  name: string;
  address1: string;
  address2: string;
}

export interface TableColumn {
  id: string;
  label: string;
  type: "index" | "text" | "number" | "formula";
  formula?: string;
  format?: "currency" | "number";
  width?: string;
  hidden?: boolean;
}

export interface TableRow {
  id: string;
  rowType?: "row" | "section-header" | "section-total" | "stage-header";
  sectionTitle?: string;
  affectsNumbering?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface SummaryItem {
  id: string;
  label: string;
  type: "number" | "formula";
  value?: number;
  formula?: string;
  calculatedValue?: number;
}

export interface Footer {
  notes: string;
  emphasis: Array<{ key: string; value: string }>;
}

export interface InvoiceCode {
  text: string;
  prefix?: string;
  count?: string;
  year?: string;
  x: number;
  y: number;
  color: string;
}

export interface DocData {
  contact: Contact;
  title: string;
  date: string;
  table: {
    columns: TableColumn[];
    rows: TableRow[];
    summary: SummaryItem[];
  };
  footer: Footer;
  invoiceCode?: InvoiceCode;
  isReceipt?: boolean;
  paymentMethod?: string;
  signature?: string;
  receiptMessage?: string;
}

export interface TotalPrice {
  subTotal: number;
  summaries: SummaryItem[];
  grandTotal: number;
}
