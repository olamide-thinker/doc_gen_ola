export interface Contact {
  name: string;
  address1: string;
  address2: string;
  phone?: string;
  email?: string;
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
  rowType?: "row" | "section-header" | "section-total" | "sub-section-header";
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
  company?: string;
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
  useSections?: boolean;
  showBOQSummary?: boolean;
  isReceipt?: boolean;
  paymentMethod?: string;
  transactionId?: string;
  reference?: string;
  signature?: string;
  receiptMessage?: string;
  totalInvoiceAmount?: number;
  amountPaid?: number;
  outstandingBalance?: number;
  acknowledgement?: string;
  // Template metadata — stored at creation for display purposes only
  _templateColor?: string;
  _templateName?: string;
}

export interface TotalPrice {
  subTotal: number;
  summaries: SummaryItem[];
  grandTotal: number;
}
