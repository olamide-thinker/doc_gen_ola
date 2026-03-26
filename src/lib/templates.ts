import { DocData } from "../types";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  content: Partial<DocData>;
  isPinned?: boolean;
  color?: "blue" | "green" | "purple" | "amber" | "rose" | "cyan" | "indigo" | "slate";
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "design-fee",
    name: "Design Fee",
    description: "Initial consultation and concept design stages",
    color: "blue",
    content: {
      title: "Design Fee Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Stage Description", type: "text" },
          { id: "C", label: "% Completion", type: "text", width: "120px" },
          { id: "D", label: "Total (₦)", type: "number", width: "160px" }
        ],
        rows: [
          { id: "row-1", rowType: "stage-header", sectionTitle: "Concept Design" },
          { id: "row-2", B: "Initial Consultation", C: "100%", D: 50000 },
          { id: "row-3", B: "Space Planning / Layout", C: "50%", D: 150000 },
          { id: "row-4", rowType: "stage-header", sectionTitle: "Development" },
          { id: "row-5", B: "3D Visualizations", C: "0%", D: 250000 }
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }
        ]
      }
    }
  },
  {
    id: "boq",
    name: "BOQ Invoice",
    description: "Bill of Quantities for site execution",
    color: "green",
    content: {
      title: "Bill of Quantities (BOQ)",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Description", type: "text" },
          { id: "C", label: "Unit", type: "text", width: "80px" },
          { id: "D", label: "Qty", type: "number", width: "80px" },
          { id: "E", label: "Rate (₦)", type: "number", width: "140px" },
          { id: "F", label: "Total (₦)", type: "formula", formula: "D * E", width: "140px" }
        ],
        rows: [
          { id: "row-1", rowType: "section-header", sectionTitle: "Tiling Works" },
          { id: "row-2", B: "Floor Tiles (60x60)", C: "sqm", D: 70, E: 8500 },
          { id: "row-3", B: "Skirting", C: "m", D: 45, E: 1200 },
          { id: "row-4", rowType: "section-total", sectionTitle: "Tiling Total" }
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }
        ]
      }
    }
  },
  {
    id: "procurement",
    name: "Procurement",
    description: "Material sourcing and logistics",
    color: "amber",
    content: {
      title: "Procurement Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Item / Vendor", type: "text" },
          { id: "C", label: "Unit", type: "text", width: "80px" },
          { id: "D", label: "Qty", type: "number", width: "80px" },
          { id: "E", label: "Cost (₦)", type: "number", width: "140px" },
          { id: "F", label: "Logistics (₦)", type: "number", width: "120px" },
          { id: "G", label: "Fee (%)", type: "number", width: "80px" },
          { id: "H", label: "Total (₦)", type: "formula", formula: "(D * E) + F + ((D * E) * (G/100))", width: "160px" }
        ],
        rows: [
          { id: "row-1", B: "Vado Gold Tap (GZ Supplies)", C: "pcs", D: 2, E: 85000, F: 5000, G: 10 }
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }
        ]
      }
    }
  },
  {
    id: "labour",
    name: "Labour",
    description: "Execution and artisanal work",
    color: "purple",
    content: {
      title: "Labour / Execution Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Artisan Type", type: "text" },
          { id: "C", label: "Scope of Work", type: "text" },
          { id: "D", label: "Unit", type: "text", width: "80px" },
          { id: "E", label: "Duration", type: "number", width: "80px" },
          { id: "F", label: "Rate (₦)", type: "number", width: "140px" },
          { id: "G", label: "Total (₦)", type: "formula", formula: "E * F", width: "140px" }
        ],
        rows: [
          { id: "row-1", B: "Tiler", C: "Main Bedroom Floor", D: "day", E: 3, F: 15000 }
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }
        ]
      }
    }
  },
  {
    id: "mobilization",
    name: "Mobilization",
    description: "Upfront project funding",
    color: "rose",
    content: {
      title: "Mobilization Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Description", type: "text" },
          { id: "C", label: "Total (₦)", type: "number", width: "160px" }
        ],
        rows: [
          { id: "row-1", B: "70% Mobilization for Project Start", C: 1500000 }
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }
        ]
      }
    }
  },
  {
    id: "progress",
    name: "Progress",
    description: "Phased payments during work",
    color: "cyan",
    content: {
      title: "Progress Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Description", type: "text" },
          { id: "C", label: "Completion %", type: "text", width: "120px" },
          { id: "D", label: "Total (₦)", type: "number", width: "160px" }
        ],
        rows: [
          { id: "row-1", B: "Second Tranche (Tiling & Electrical)", C: "65%", D: 850000 }
        ],
        summary: [
          { id: "sub", label: "Previous Payments", type: "formula", formula: "0" },
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" },
          { id: "bal", label: "Balance Remaining", type: "formula", formula: "grandTotal - 0" }
        ]
      }
    }
  },
  {
    id: "variation",
    name: "Variation",
    description: "Change orders and new additions",
    color: "indigo",
    content: {
      title: "Variation / Change Order",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Change Description", type: "text" },
          { id: "C", label: "Unit", type: "text", width: "80px" },
          { id: "D", label: "Qty", type: "number", width: "80px" },
          { id: "E", label: "Rate (₦)", type: "number", width: "140px" },
          { id: "F", label: "Total (₦)", type: "formula", formula: "D * E", width: "140px" },
          { id: "G", label: "Status", type: "text", width: "120px" }
        ],
        rows: [
          { id: "row-1", B: "Addition of Spotlight in Master Bedroom", C: "pcs", D: 4, E: 6250, G: "Pending Approval" }
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }
        ]
      }
    }
  },
  {
    id: "final",
    name: "Final",
    description: "Completion and handover",
    color: "slate",
    content: {
      title: "Final Project Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Project Summary", type: "text" },
          { id: "C", label: "Total (₦)", type: "number", width: "160px" }
        ],
        rows: [
          { id: "row-1", B: "Total Project Execution Cost", C: 4500000 }
        ],
        summary: [
          { id: "paid", label: "Total Amount Paid", type: "number", value: 4000000 },
          { id: "bal", label: "Final Balance Due", type: "formula", formula: "subTotal - paid" }
        ]
      }
    }
  },
  {
    id: "retainer",
    name: "Retainer",
    description: "Maintenance and recurring services",
    color: "blue",
    content: {
      title: "Retainer / Maintenance Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Service Description", type: "text" },
          { id: "C", label: "Unit", type: "text", width: "80px" },
          { id: "D", label: "Period", type: "number", width: "80px" },
          { id: "E", label: "Rate (₦)", type: "number", width: "140px" },
          { id: "F", label: "Total (₦)", type: "formula", formula: "D * E", width: "140px" }
        ],
        rows: [
          { id: "row-1", B: "Monthly AC Maintenance & Checklist", C: "month", D: 1, E: 35000 }
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" }
        ]
      }
    }
  },
  {
    id: "reimbursement",
    name: "Reimbursement",
    description: "Expenses paid for client",
    color: "green",
    content: {
      title: "Reimbursement Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Item / Expense", type: "text" },
          { id: "C", label: "Unit", type: "text", width: "80px" },
          { id: "D", label: "Qty", type: "number", width: "80px" },
          { id: "E", label: "Amount (₦)", type: "number", width: "140px" },
          { id: "F", label: "Total (₦)", type: "formula", formula: "D * E", width: "140px" }
        ],
        rows: [
          { id: "row-1", B: "Delivery costs for Lounge furniture", C: "trip", D: 1, E: 12500 }
        ],
        summary: []
      }
    }
  },
  {
    id: "receipt",
    name: "Standard Receipt",
    description: "Proof of payment with signature and method",
    color: "slate",
    content: {
      title: "OFFICIAL RECEIPT",
      isReceipt: true,
      paymentMethod: "Transfer",
      receiptMessage: "Thank you for your patronage!",
      table: {
        columns: [
          { id: "A", label: "S/N", type: "index", width: "60px" },
          { id: "B", label: "Description of Items/Services Paid For", type: "text" },
          { id: "C", label: "Amount (₦)", type: "number", width: "160px" }
        ],
        rows: [
          { id: "row-1", B: "Partial payment for Furniture Procurement", C: 500000 }
        ],
        summary: []
      },
      footer: {
        notes: "<p>Thank you for your patronage! This receipt serves as proof of payment for the items/services listed above.</p>",
        emphasis: []
      }
    }
  }
];

/**
 * MANDATORY RULE: Every template MUST have a final "Total" column.
 * This column is the single source of truth for row calculations.
 * All intermediate math (e.g. Qty * Rate) must output to this column.
 * For simple rows, this is a 'number' type; for complex ones, it's a 'formula'.
 */
