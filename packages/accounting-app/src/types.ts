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

export interface AnnotationReply {
  id: string;
  text: string;
  userName: string;
  userPhoto?: string;
  createdAt: string;
}

// A single pin, highlight, or drawing placed on a file by a team member
export interface Annotation {
  id: string;
  x: number;          // position as percentage (0-100)
  y: number;
  text: string;
  userName: string;
  userPhoto?: string; // avatar URL — stored at creation time
  createdAt: string;  // ISO-8601 for sorting
  type: 'pin' | 'highlight' | 'draw';
  path?: {x: number, y: number}[]; // array of points for freehand drawing
  replies?: AnnotationReply[];     // nested replies
  timestamp?: number; // video-only: seconds into the video
  pageNumber?: number; // pdf-only: page number (1-indexed)
  color?: string;      // custom color for the annotation
  strokeWidth?: number; // thickness for highlight/draw strokes
  pinSize?: number;     // diameter in px for pin circles
}

export interface Task {
  id: string;
  description: string;
  assignee: string;
  priority: 'low' | 'med' | 'high';
  dueDate?: string;
  status: 'pending' | 'progress' | 'done';
  x?: number; // Pin position (0-100) relative to page
  y?: number;
  pageNumber: number;
}

export interface Zone {
  id: string;
  name: string;
  color: string; // Shade color
  borderColor?: string;
  points: { x: number, y: number }[]; // Polygon vertices (0-100)
  tasks: Task[];
  pageNumber: number;
  strokeWidth?: number;
  opacity?: number;
}

export interface PlanData {
  pdfUrl: string;
  zones: Zone[];
}

export type MemberRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface DocumentMember {
  email: string;
  role: MemberRole;
}

/** True if the role is allowed to mutate document content. Mirrors backend canWrite(). */
export const canWrite = (role: MemberRole | undefined | null): boolean =>
  role === 'owner' || role === 'editor';

/** Normalises legacy 'member' values to 'editor'. Mirrors backend normalizeRole(). */
export const normalizeMemberRole = (raw: any): MemberRole => {
  if (raw === 'owner') return 'owner';
  if (raw === 'editor' || raw === 'member') return 'editor';
  if (raw === 'commenter') return 'commenter';
  if (raw === 'viewer') return 'viewer';
  return 'viewer';
};

export interface FileAttachment {
  id: string;
  name: string;
  type: "pdf" | "image" | "video";
  url: string; // Base64 or Blob URL
  size?: number;
  createdAt: string;
  annotations?: Annotation[];
  ownerName?: string;
  ownerPhoto?: string;
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
  /** When true (and the invoice is at least partially paid), this BOQ shows
   *  up in the Tasks page's "Generate from BOQ" picker. */
  boqTaskSource?: boolean;
  isReceipt?: boolean;
  paymentMethod?: string;
  transactionId?: string;
  reference?: string;
  signature?: string;
  receiptMessage?: string;
  amountPaid?: number;
  outstandingBalance?: number;
  acknowledgement?: string;
  // File management
  totalInvoiceAmount?: number;
  files?: FileAttachment[];
  // Branding assets — stored at creation for persistence
  businessLogoUrl?: string;
  businessLetterheadUrl1?: string;
  businessLetterheadUrl2?: string;
  businessLetterheadUrl3?: string;
  // User assets
  userSignatureUrl?: string;
  // Plan metadata
  isPlan?: boolean;
  planData?: PlanData;
  // Template metadata — stored at creation for display purposes only
  _templateColor?: string;
  _templateName?: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  email: string;
  role: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOwner {
  id: string;
  email: string | null;
  fullName: string | null;
  photo: string | null;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  createdAt: string;
  members?: DocumentMember[]; // stores email + role locally
  ownerId?: string;
  owner?: ProjectOwner;
  isOwner?: boolean;
  businessId?: string;
  archived?: boolean;
  metadata?: any;
  /** Caller's role within this project — populated by GET /api/workspace/projects */
  myRole?: MemberRole;
  /** Map of email → role for every member of the project */
  memberRoles?: Record<string, MemberRole>;
}

export interface TotalPrice {
  subTotal: number;
  summaries: SummaryItem[];
  grandTotal: number;
}
