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
}

export interface TableRow {
  [key: string]: string | number;
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
}

export interface TotalPrice {
  subTotal: number;
  summaries: SummaryItem[];
  grandTotal: number;
}
