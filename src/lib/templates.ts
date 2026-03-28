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
  // ── DESIGN FEE ─────────────────────────────────────────────────────────────
  {
    id: "design-fee",
    name: "Design Fee",
    description: "Professional fees per stage of design completion",
    color: "blue",
    content: {
      title: "Design Fee Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N",              type: "index",   width: "50px"  },
          { id: "B", label: "Stage Description", type: "text"                   },
          { id: "C", label: "% Done",            type: "text",   width: "90px"  },
          { id: "D", label: "Total (₦)",         type: "number", width: "160px" },
        ],
        rows: [
          { id: "r1",  rowType: "section-header", sectionTitle: "Phase 1 — Concept Design" },
          { id: "r2",  rowType: "row", B: "Initial Client Brief & Site Assessment",   C: "100%", D: 75000  },
          { id: "r3",  rowType: "row", B: "Mood Board & Style Concept Presentation", C: "100%", D: 55000  },
          { id: "r4",  rowType: "row", B: "Space Planning & Furniture Layout",        C: "100%", D: 150000 },
          { id: "r5",  rowType: "row", B: "Material & Finish Schedule",               C: "75%",  D: 85000  },
          { id: "r6",  rowType: "section-header", sectionTitle: "Phase 2 — Design Development" },
          { id: "r7",  rowType: "row", B: "3D Renderings — Living & Dining Areas",   C: "50%",  D: 280000 },
          { id: "r8",  rowType: "row", B: "3D Renderings — Master Bedroom Suite",    C: "0%",   D: 180000 },
          { id: "r9",  rowType: "row", B: "Working Drawings & Technical Plans",       C: "0%",   D: 200000 },
          { id: "r10", rowType: "section-header", sectionTitle: "Phase 3 — Supervision" },
          { id: "r11", rowType: "row", B: "Site Supervision (10 weeks)",              C: "0%",   D: 350000 },
          { id: "r12", rowType: "row", B: "Snagging & Handover Report",               C: "0%",   D: 80000  },
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" },
        ],
      },
      footer: {
        notes: "<p>Fees are billed per phase upon completion of the stated percentage. A <strong>50% advance</strong> is required before commencing the next phase. All design revisions beyond 2 rounds per stage attract additional fees at ₦15,000/hr. Final drawings and files are released upon full settlement.</p>",
        emphasis: [
          { key: "Bank",    value: "Zenith Bank — Shan Interiors Ltd" },
          { key: "Account", value: "1234567890" },
        ],
      },
    },
  },

  // ── BOQ ────────────────────────────────────────────────────────────────────
  {
    id: "boq",
    name: "BOQ Invoice",
    description: "Bill of Quantities for site execution works",
    color: "green",
    content: {
      title: "Bill of Quantities (BOQ)",
      table: {
        columns: [
          { id: "A", label: "S/N",         type: "index",   width: "50px"  },
          { id: "B", label: "Description", type: "text"                    },
          { id: "C", label: "Unit",        type: "text",   width: "70px"  },
          { id: "D", label: "Qty",         type: "number", width: "70px"  },
          { id: "E", label: "Rate (₦)",    type: "number", width: "130px" },
          { id: "F", label: "Total (₦)",   type: "formula", formula: "D * E", width: "140px" },
        ],
        rows: [
          { id: "r1",  rowType: "section-header", sectionTitle: "Tiling Works"                                           },
          { id: "r2",  rowType: "row", B: "Supply & lay floor tiles 60×60 (porcelain)",      C: "sqm", D: 85,  E: 9500  },
          { id: "r3",  rowType: "row", B: "Supply & lay wall tiles 30×60 (ceramic)",         C: "sqm", D: 42,  E: 6200  },
          { id: "r4",  rowType: "row", B: "Skirting tiles",                                  C: "m",   D: 58,  E: 1500  },
          { id: "r5",  rowType: "row", B: "Tile adhesive, grout & waterproofing compound",   C: "lot", D: 1,   E: 45000 },
          { id: "r6",  rowType: "section-total", sectionTitle: "Tiling Works Total"                                      },
          { id: "r7",  rowType: "section-header", sectionTitle: "Sanitary & Plumbing Works"                               },
          { id: "r8",  rowType: "row", B: "Supply & install WC (close-coupled cistern)",     C: "pcs", D: 2,   E: 85000 },
          { id: "r9",  rowType: "row", B: "Supply & install wash basin with pedestal",       C: "pcs", D: 2,   E: 55000 },
          { id: "r10", rowType: "row", B: "Supply & install shower enclosure with mixer",    C: "pcs", D: 1,   E: 145000},
          { id: "r11", rowType: "row", B: "Concealed pipework & drainage connections",       C: "lot", D: 1,   E: 65000 },
          { id: "r12", rowType: "section-total", sectionTitle: "Sanitary Works Total"                                    },
          { id: "r13", rowType: "section-header", sectionTitle: "Electrical Works"                                       },
          { id: "r14", rowType: "row", B: "Supply & install LED downlights (12W each)",      C: "pcs", D: 18,  E: 8500  },
          { id: "r15", rowType: "row", B: "Supply & install ceiling fan with remote",        C: "pcs", D: 3,   E: 22000 },
          { id: "r16", rowType: "row", B: "Wiring & conduit for lighting circuits",          C: "lot", D: 1,   E: 85000 },
          { id: "r17", rowType: "row", B: "DB board upgrade with breakers",                  C: "lot", D: 1,   E: 55000 },
          { id: "r18", rowType: "section-total", sectionTitle: "Electrical Works Total"                                  },
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" },
        ],
      },
      footer: {
        notes: "<p>All prices are inclusive of supply and installation unless otherwise stated. Materials are sourced from approved vendors only. Any variation to this BOQ must be agreed in writing before commencement. Mobilisation of <strong>60%</strong> is required prior to site start.</p>",
        emphasis: [
          { key: "Payment Terms", value: "60% upfront, 40% on completion" },
        ],
      },
    },
  },

  // ── PROCUREMENT ────────────────────────────────────────────────────────────
  {
    id: "procurement",
    name: "Procurement",
    description: "Material sourcing, logistics and sourcing fee",
    color: "amber",
    content: {
      title: "Procurement Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N",              type: "index",   width: "50px"  },
          { id: "B", label: "Item / Vendor",    type: "text"                    },
          { id: "C", label: "Unit",             type: "text",   width: "70px"  },
          { id: "D", label: "Qty",              type: "number", width: "65px"  },
          { id: "E", label: "Unit Cost (₦)",    type: "number", width: "130px" },
          { id: "F", label: "Logistics (₦)",   type: "number", width: "110px" },
          { id: "G", label: "Fee %",            type: "number", width: "70px"  },
          { id: "H", label: "Total (₦)",        type: "formula", formula: "(D * E) + F + ((D * E) * (G/100))", width: "150px" },
        ],
        rows: [
          { id: "r1", rowType: "row", B: "Vado Gold Mono Basin Mixer (GZ Supplies)",             C: "pcs", D: 2,  E: 95000,  F: 5500,  G: 10 },
          { id: "r2", rowType: "row", B: "Grohe Euphoria Shower System (Tiles & More Ltd)",      C: "pcs", D: 1,  E: 165000, F: 8500,  G: 10 },
          { id: "r3", rowType: "row", B: "Porcelain Floor Tiles 60×60 (Alpha Tiles, Mushin)",    C: "sqm", D: 85, E: 8200,   F: 12000, G: 10 },
          { id: "r4", rowType: "row", B: "Engineered Oak Flooring 120mm (TimberCraft NG)",       C: "sqm", D: 45, E: 24000,  F: 15000, G: 10 },
          { id: "r5", rowType: "row", B: "3-Seater Fabric Sofa — Charcoal (Jiji Furniture Co.)", C: "pcs", D: 1,  E: 310000, F: 18000, G: 8  },
          { id: "r6", rowType: "row", B: "Imported Pendant Lights x6 (Lightworks Lagos)",        C: "set", D: 1,  E: 185000, F: 7000,  G: 10 },
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" },
        ],
      },
      footer: {
        notes: "<p>All items are sourced from verified vendors on behalf of the client. A <strong>10% sourcing/procurement fee</strong> applies on the cost of goods. Logistics costs are actual and based on vendor delivery quotes. Receipts and delivery notes will be provided upon delivery. Client approves each item before procurement is finalised.</p>",
        emphasis: [
          { key: "Advance Required", value: "100% of procurement total before purchase" },
        ],
      },
    },
  },

  // ── LABOUR ─────────────────────────────────────────────────────────────────
  {
    id: "labour",
    name: "Labour",
    description: "Artisan and execution labour invoice",
    color: "purple",
    content: {
      title: "Labour / Execution Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N",           type: "index",   width: "50px"  },
          { id: "B", label: "Artisan Type",  type: "text",   width: "160px" },
          { id: "C", label: "Scope of Work", type: "text"                    },
          { id: "D", label: "Unit",          type: "text",   width: "70px"  },
          { id: "E", label: "Duration",      type: "number", width: "80px"  },
          { id: "F", label: "Day Rate (₦)",  type: "number", width: "120px" },
          { id: "G", label: "Total (₦)",     type: "formula", formula: "E * F", width: "140px" },
        ],
        rows: [
          { id: "r1", rowType: "row", B: "Lead Tiler",          C: "Main bedroom & bathroom floor/wall tiling",    D: "day",  E: 6,  F: 20000 },
          { id: "r2", rowType: "row", B: "Painter",             C: "Full apartment — 2 coats sealer + topcoat",    D: "day",  E: 8,  F: 14000 },
          { id: "r3", rowType: "row", B: "Electrician",         C: "Wiring, conduit & light fitting installation", D: "day",  E: 5,  F: 22000 },
          { id: "r4", rowType: "row", B: "Carpenter",           C: "Built-in wardrobe & TV unit fabrication",      D: "day",  E: 7,  F: 28000 },
          { id: "r5", rowType: "row", B: "Plumber",             C: "Bathroom & kitchen plumbing connections",      D: "day",  E: 4,  F: 25000 },
          { id: "r6", rowType: "row", B: "Labourer (×2)",       C: "General cleaning, material movement & prep",   D: "day",  E: 10, F: 10000 },
          { id: "r7", rowType: "row", B: "Site Supervisor",     C: "Daily coordination & quality control",         D: "week", E: 3,  F: 55000 },
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" },
        ],
      },
      footer: {
        notes: "<p>All artisans are to report to site by <strong>8:00am</strong> and sign in/out daily. Materials will be provided by designer/client. Any additional scope beyond what is listed will be billed as a variation. Payment is made at the end of each work week. Artisans are responsible for their own tools.</p>",
        emphasis: [
          { key: "Site Hours", value: "8:00am — 5:00pm (Mon–Sat)" },
          { key: "Safety",     value: "PPE mandatory on site at all times" },
        ],
      },
    },
  },

  // ── MOBILIZATION ───────────────────────────────────────────────────────────
  {
    id: "mobilization",
    name: "Mobilization",
    description: "Upfront project funding to commence works",
    color: "rose",
    content: {
      title: "Mobilization Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N",         type: "index",   width: "50px"  },
          { id: "B", label: "Description", type: "text"                    },
          { id: "C", label: "Amount (₦)",  type: "number", width: "160px" },
        ],
        rows: [
          { id: "r1", rowType: "row", B: "50% Mobilisation — Phase 1 Works (Structural & Tiling)",      C: 1250000 },
          { id: "r2", rowType: "row", B: "Material Advance — Sanitary Fittings & Porcelain Tiles",      C: 450000  },
          { id: "r3", rowType: "row", B: "Site Preparation, Hoarding & Protective Works",               C: 150000  },
          { id: "r4", rowType: "row", B: "Designer Advance Fee — Phase 1 Supervision",                  C: 200000  },
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" },
        ],
      },
      footer: {
        notes: "<p>This mobilization invoice enables the commencement of Phase 1 works. All funds will be applied towards material procurement and artisan payments. A <strong>detailed expenditure report</strong> will be provided at the end of each phase. Unspent funds will be credited against the next invoice.</p>",
        emphasis: [
          { key: "Use of Funds",  value: "Materials, Labour & Site Setup" },
          { key: "Reporting",     value: "Weekly expenditure updates will be sent" },
        ],
      },
    },
  },

  // ── PROGRESS ───────────────────────────────────────────────────────────────
  {
    id: "progress",
    name: "Progress",
    description: "Phased payment claim during active works",
    color: "cyan",
    content: {
      title: "Progress Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N",             type: "index",   width: "50px"  },
          { id: "B", label: "Description",     type: "text"                    },
          { id: "C", label: "Completion %",    type: "text",   width: "110px" },
          { id: "D", label: "Contract Value (₦)", type: "number", width: "150px" },
        ],
        rows: [
          { id: "r1", rowType: "row", B: "Phase 1 — Demolition, Screeding & Structural Works", C: "100%", D: 850000  },
          { id: "r2", rowType: "row", B: "Phase 2 — Tiling, Plastering & Waterproofing",       C: "100%", D: 1200000 },
          { id: "r3", rowType: "row", B: "Phase 3 — Electrical & Plumbing Rough-in",           C: "80%",  D: 750000  },
          { id: "r4", rowType: "row", B: "Phase 4 — Carpentry, Joinery & Built-ins",           C: "30%",  D: 980000  },
          { id: "r5", rowType: "row", B: "Phase 5 — Painting, Furniture & Finishing",          C: "0%",   D: 1100000 },
        ],
        summary: [
          { id: "prev",  label: "Less: Previous Payments",   type: "number",  value: 2050000 },
          { id: "vat",   label: "VAT (7.5%)",                type: "formula", formula: "subTotal * 0.075" },
          { id: "bal",   label: "Amount Due This Invoice",   type: "formula", formula: "subTotal + (subTotal * 0.075) - 2050000" },
        ],
      },
      footer: {
        notes: "<p>This progress invoice reflects the value of works completed to date as certified by the project designer. Payment is due within <strong>7 days</strong> of invoice. Works will be paused if payment is not received within the stipulated period.</p>",
        emphasis: [
          { key: "Certifier",     value: "Shan Interiors Ltd" },
          { key: "Claim Period",  value: "Weeks 1–8 of Construction" },
        ],
      },
    },
  },

  // ── VARIATION ──────────────────────────────────────────────────────────────
  {
    id: "variation",
    name: "Variation",
    description: "Change orders and additional scope items",
    color: "indigo",
    content: {
      title: "Variation / Change Order",
      table: {
        columns: [
          { id: "A", label: "S/N",                type: "index",   width: "50px"  },
          { id: "B", label: "Change Description", type: "text"                    },
          { id: "C", label: "Unit",               type: "text",   width: "70px"  },
          { id: "D", label: "Qty",                type: "number", width: "65px"  },
          { id: "E", label: "Rate (₦)",           type: "number", width: "130px" },
          { id: "F", label: "Total (₦)",          type: "formula", formula: "D * E", width: "140px" },
          { id: "G", label: "Status",             type: "text",   width: "130px" },
        ],
        rows: [
          { id: "r1", rowType: "row", B: "Additional spotlights — Master Bedroom (×4)",              C: "pcs", D: 4,  E: 6250,   G: "Approved" },
          { id: "r2", rowType: "row", B: "Upgrade floor tile from porcelain to marble (Master Bath)", C: "sqm", D: 12, E: 22000,  G: "Approved" },
          { id: "r3", rowType: "row", B: "Feature wall — fluted panel with LED backlighting",        C: "lot", D: 1,  E: 185000, G: "Approved" },
          { id: "r4", rowType: "row", B: "Smart lighting control system (4 zones)",                  C: "lot", D: 1,  E: 320000, G: "Pending Client" },
          { id: "r5", rowType: "row", B: "Additional power sockets — Kitchen island (×6)",           C: "pcs", D: 6,  E: 8500,   G: "Pending Approval" },
          { id: "r6", rowType: "row", B: "Removal of non-structural wall — Study room",              C: "lot", D: 1,  E: 75000,  G: "Approved" },
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" },
        ],
      },
      footer: {
        notes: "<p>All variation items marked <strong>Approved</strong> have been authorised by the client in writing. Items marked <strong>Pending</strong> are subject to client sign-off before works commence. Approved variations will be incorporated into the next progress certificate. Shan Interiors reserves the right to withhold execution of pending items until formal approval is received.</p>",
        emphasis: [
          { key: "VO Reference", value: "VO-003" },
          { key: "Authorised",   value: "Items 1, 2, 3 & 6 only" },
        ],
      },
    },
  },

  // ── FINAL ──────────────────────────────────────────────────────────────────
  {
    id: "final",
    name: "Final",
    description: "Project completion and final settlement",
    color: "slate",
    content: {
      title: "Final Project Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N",              type: "index",   width: "50px"  },
          { id: "B", label: "Project Summary",  type: "text"                    },
          { id: "C", label: "Amount (₦)",       type: "number", width: "160px" },
        ],
        rows: [
          { id: "r1", rowType: "row", B: "Phase 1 — Structural, Screeding & Tiling Works",     C: 2050000 },
          { id: "r2", rowType: "row", B: "Phase 2 — Electrical, Plumbing & MEP Works",         C: 1450000 },
          { id: "r3", rowType: "row", B: "Phase 3 — Carpentry, Joinery & Built-in Furniture",  C: 1680000 },
          { id: "r4", rowType: "row", B: "Phase 4 — Painting, Finishing & Decoration",         C: 920000  },
          { id: "r5", rowType: "row", B: "Design Fees (All Phases)",                           C: 1200000 },
          { id: "r6", rowType: "row", B: "Approved Variations (VO-001 to VO-003)",             C: 585000  },
          { id: "r7", rowType: "row", B: "Reimbursable Expenses",                              C: 112500  },
        ],
        summary: [
          { id: "paid", label: "Less: Total Payments Received", type: "number",  value: 6800000 },
          { id: "vat",  label: "VAT (7.5%)",                    type: "formula", formula: "subTotal * 0.075" },
          { id: "bal",  label: "Final Balance Due",             type: "formula", formula: "subTotal + (subTotal * 0.075) - 6800000" },
        ],
      },
      footer: {
        notes: "<p>This final invoice represents the total cost of all agreed and approved works. A full <strong>Handover Report</strong>, defects schedule, warranty certificates and as-built drawings are enclosed. All defects liability works will be attended to within <strong>3 months</strong> of handover at no additional charge. Keys and access devices are released upon full settlement.</p>",
        emphasis: [
          { key: "Defects Liability", value: "3 months from handover date"    },
          { key: "Warranty",          value: "Structural works — 12 months"   },
        ],
      },
    },
  },

  // ── RETAINER ───────────────────────────────────────────────────────────────
  {
    id: "retainer",
    name: "Retainer",
    description: "Monthly maintenance and recurring services",
    color: "blue",
    content: {
      title: "Retainer / Maintenance Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N",                  type: "index",   width: "50px"  },
          { id: "B", label: "Service Description",  type: "text"                    },
          { id: "C", label: "Unit",                 type: "text",   width: "80px"  },
          { id: "D", label: "Period",               type: "number", width: "75px"  },
          { id: "E", label: "Rate (₦)",             type: "number", width: "130px" },
          { id: "F", label: "Total (₦)",            type: "formula", formula: "D * E", width: "140px" },
        ],
        rows: [
          { id: "r1", rowType: "row", B: "Preventive AC Maintenance (4 units, monthly checklist)", C: "month", D: 1, E: 45000 },
          { id: "r2", rowType: "row", B: "Electrical Routine Inspection & Safety Report",          C: "month", D: 1, E: 22000 },
          { id: "r3", rowType: "row", B: "Interior Touch-up & Cleaning Supervision",              C: "month", D: 1, E: 28000 },
          { id: "r4", rowType: "row", B: "Minor Plumbing Maintenance & Checks",                   C: "month", D: 1, E: 15000 },
          { id: "r5", rowType: "row", B: "Designer Monthly Site Visit & Condition Report",        C: "visit", D: 2, E: 25000 },
        ],
        summary: [
          { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "subTotal * 0.075" },
        ],
      },
      footer: {
        notes: "<p>This retainer invoice covers all standard maintenance services for the month as listed. Services are performed by certified technicians under the supervision of Shan Interiors. Any repair works identified during routine checks will be quoted separately. Retainer agreement is renewable on a <strong>3-month or 12-month basis</strong> at a discounted rate.</p>",
        emphasis: [
          { key: "Contract Term",  value: "Monthly — auto-renews unless cancelled" },
          { key: "Response Time",  value: "Emergency calls attended within 24hrs"   },
        ],
      },
    },
  },

  // ── REIMBURSEMENT ──────────────────────────────────────────────────────────
  {
    id: "reimbursement",
    name: "Reimbursement",
    description: "Client expenses paid on behalf and to be recovered",
    color: "green",
    content: {
      title: "Reimbursement Invoice",
      table: {
        columns: [
          { id: "A", label: "S/N",             type: "index",   width: "50px"  },
          { id: "B", label: "Item / Expense",  type: "text"                    },
          { id: "C", label: "Unit",            type: "text",   width: "70px"  },
          { id: "D", label: "Qty",             type: "number", width: "65px"  },
          { id: "E", label: "Amount (₦)",      type: "number", width: "130px" },
          { id: "F", label: "Total (₦)",       type: "formula", formula: "D * E", width: "140px" },
        ],
        rows: [
          { id: "r1", rowType: "row", B: "Delivery — 3-seater sofa & ottoman (Lekki to Ikoyi)",        C: "trip", D: 1, E: 18500 },
          { id: "r2", rowType: "row", B: "Customs duty & clearing — imported light fixtures",           C: "lot",  D: 1, E: 48000 },
          { id: "r3", rowType: "row", B: "Site visits — fuel & transport (4 trips)",                   C: "trip", D: 4, E: 6500  },
          { id: "r4", rowType: "row", B: "Printing — working drawings, presentation boards & samples", C: "lot",  D: 1, E: 9200  },
          { id: "r5", rowType: "row", B: "Site sundries — nails, adhesives, protective covers",        C: "lot",  D: 1, E: 14000 },
          { id: "r6", rowType: "row", B: "Bank transfer charges — vendor payments",                    C: "lot",  D: 1, E: 2500  },
        ],
        summary: [],
      },
      footer: {
        notes: "<p>All expenses listed have been incurred on behalf of the client and are supported by original receipts which are attached. No markup is applied to reimbursable items. Please settle within <strong>7 days</strong> of invoice date. Receipts are available for inspection upon request.</p>",
        emphasis: [
          { key: "Note", value: "All receipts attached — no markup applied" },
        ],
      },
    },
  },

  // ── RECEIPT ────────────────────────────────────────────────────────────────
  {
    id: "receipt",
    name: "Standard Receipt",
    description: "Proof of payment with signature and method",
    color: "slate",
    content: {
      title: "OFFICIAL RECEIPT",
      isReceipt: true,
      paymentMethod: "Bank Transfer",
      transactionId: "TRX-8829103-XC",
      reference: "INV/IS/0001/2026 — Design Fee",
      acknowledgement: "We hereby confirm receipt of the sum stated above from the above-named client in full/part settlement of the referenced invoice. This receipt is issued as official proof of payment.",
      totalInvoiceAmount: 2500000,
      amountPaid: 1500000,
      outstandingBalance: 1000000,
      footer: {
        notes: "<p>Thank you for your payment. This receipt serves as official proof of payment for the amount stated above. Please retain for your records. For queries, contact us at hello@shaninteriordesign.com</p>",
        emphasis: [],
      },
    },
  },
];

/**
 * MANDATORY RULE: Every template MUST have a final "Total" column.
 * This column is the single source of truth for row calculations.
 * All intermediate math (e.g. Qty * Rate) must output to this column.
 * For simple rows, this is a 'number' type; for complex ones, it's a 'formula'.
 */
