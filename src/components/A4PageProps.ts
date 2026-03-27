import { DocData, TableRow, Contact, TotalPrice, InvoiceCode } from "../types";

export interface A4PageProps {
  data: DocData;
  rows: TableRow[];
  pageIndex: number;
  totalPrice: TotalPrice | null;
  headerImage: string;
  headerHeight: number;
  onHeaderResize: (e: React.MouseEvent) => void;
  isFirstPage: boolean;
  isLastPage: boolean;
  startIndex: number;
  onUpdateContact: (field: keyof Contact, value: string) => void;
  onUpdateTitle: (value: string) => void;
  onUpdateCell: (
    rowIndex: number,
    colId: string,
    value: string | number | boolean,
  ) => void;
  onRemoveRow: (index: number) => void;
  onAddRowBelow: (index: number) => void;
  onAddRowAbove: (index: number) => void;
  onAddSectionBelow: (index: number, numbered: boolean, type?: TableRow["rowType"]) => void;
  onAddSectionAbove: (index: number, numbered: boolean, type?: TableRow["rowType"]) => void;
  onMoveRow: (index: number, direction: "up" | "down") => void;
  onAddStageBelow: (index: number) => void;
  onAddStageAbove: (index: number) => void;
  useStages: boolean;
  resolveFormula: (
    data: TableRow | Record<string, number>,
    formula: string | undefined,
    context?: Record<string, number>,
  ) => number;
  onUpdateInvoiceCode: (updates: Partial<InvoiceCode>) => void;
  onUpdateSummaryItem: (id: string, label: string) => void;
  onUpdateDate: (value: string) => void;
  showRows: boolean;
  showTotals: boolean;
  showFooter: boolean;
  isPreview: boolean;
  isEndOfRows: boolean;
  rowNumbering: Record<string, string>;
  resolveSectionTotal: (rows: TableRow[], fromIdx: number) => number;
  resolveStageTotal: (rows: TableRow[], fromIdx: number) => number;
  onUpdatePaymentMethod: (val: string) => void;
  onUpdateTransactionId: (val: string) => void;
  onUpdateReference: (val: string) => void;
  onUpdateSignature: (val: string) => void;
  onUpdateReceiptMessage: (val: string) => void;
  onUpdateTotalInvoiceAmount?: (val: number) => void;
  onUpdateAmountPaid?: (val: number) => void;
  onUpdateOutstandingBalance?: (val: number) => void;
  onUpdateAcknowledgement?: (val: string) => void;
  onHeaderImageUpload?: (val: string) => void;
}
