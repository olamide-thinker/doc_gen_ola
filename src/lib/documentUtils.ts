import { DocData, TableRow, SummaryItem, TotalPrice } from "../types";

export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "--";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  let suffix = "th";
  if (day % 10 === 1 && day !== 11) suffix = "st";
  else if (day % 10 === 2 && day !== 12) suffix = "nd";
  else if (day % 10 === 3 && day !== 13) suffix = "rd";

  return `${dayName}, ${monthName} ${day}${suffix}. ${year}`;
};

export const MM_TO_PX = 3.78;
export const PAGE_HEIGHT_PX = 297 * MM_TO_PX;
export const PADDING_V_PX = (14 + 24) * MM_TO_PX; // 14mm top, 24mm bottom (increased for safety)
export const USABLE_HEIGHT = PAGE_HEIGHT_PX - PADDING_V_PX - 20; // Extra 20px buffer

export function resolveFormula(
  rowData: TableRow | Record<string, number>,
  formula: string | undefined,
  context: Record<string, number> = {},
): number {
  if (!formula) return 0;
  try {
    let expression = formula.replace(/(\d*\.?\d+)\s*%/g, "($1/100)");
    Object.keys(context).forEach((key) => {
      expression = expression.replace(
        new RegExp(`\\b${key}\\b`, "g"),
        String(Number(context[key]) || 0),
      );
    });
    const matches = formula.match(/[A-Z]+/g) || [];
    matches.forEach((cid) => {
      if (context[cid] !== undefined) return;
      expression = expression.replace(
        new RegExp(`\\b${cid}\\b`, "g"),
        String(Number((rowData as any)[cid]) || 0),
      );
    });
    const idMatches = formula.match(/[a-z][a-zA-Z0-9]+/g) || [];
    idMatches.forEach((mid) => {
      if (context[mid] !== undefined) return;
      expression = expression.replace(
        new RegExp(`\\b${mid}\\b`, "g"),
        String(Number((rowData as any)[mid]) || 0),
      );
    });
    if (/[^0-9\s+\-*/().,e]/.test(expression)) return 0;
    // Allow commas in numbers by removing them before evaluation
    const cleaned = expression.replace(/(\d),(\d)/g, "$1$2");
    return new Function(`return ${cleaned}`)() || 0;
  } catch (e) {
    console.warn("[resolveFormula] Error:", e, "Expression:", formula);
    return 0;
  }
}

export const resolveSectionTotalBackward = (rows: TableRow[], fromIdx: number, docData: DocData) => {
  let total = 0;
  let startIdx = -1;
  const totalCol = [...docData.table.columns].reverse().find(
    (c) => (c.type === "formula" || c.type === "number") && !c.hidden
  );

  for (let i = fromIdx - 1; i >= 0; i--) {
    if (rows[i].rowType === "section-header" || rows[i].rowType === "sub-section-header") { 
      startIdx = i; break; 
    }
  }
  if (startIdx === -1) return 0;
  for (let i = startIdx + 1; i < fromIdx; i++) {
    const row = rows[i];
    if (row.rowType === "row" || !row.rowType) {
      const val =
        totalCol?.type === "formula"
          ? resolveFormula(row, totalCol.formula)
          : Number(row[totalCol?.id || ""]) || 0;
      total += val;
    }
  }
  return total;
};

export const resolveSectionTotal = (rows: TableRow[], fromIdx: number, docData: DocData) => {
  let total = 0;
  const totalCol = [...docData.table.columns].reverse().find(
    (c) => (c.type === "formula" || c.type === "number") && !c.hidden
  );

  for (let i = fromIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.rowType === "section-header" || row.rowType === "sub-section-header") break;
    if (row.rowType === "row" || !row.rowType) {
      const val =
        totalCol?.type === "formula"
          ? resolveFormula(row, totalCol.formula)
          : Number(row[totalCol?.id || ""]) || 0;
      total += val;
    }
  }
  return total;
};

export function computeTotalPrice(data: DocData): TotalPrice {
  const hasStageTotals = (data.table.rows || []).some(
    (r) => r.rowType === "section-total",
  ) || false;

  const totalCol = [...data.table.columns].reverse().find(
    (c) => (c.type === "formula" || c.type === "number") && !c.hidden
  );

  const subTotal = hasStageTotals
    ? (() => {
        let total = 0;
        let insideSection = false;
        const rows = data.table.rows || [];
        rows.forEach((row, idx) => {
          if (!row) return;
          if (row.rowType === "section-header" || row.rowType === "sub-section-header") {
            insideSection = true;
          } else if (row.rowType === "section-total") {
            insideSection = false;
            total += resolveSectionTotalBackward(rows, idx, data);
          } else if ((row.rowType === "row" || !row.rowType || row.rowType === "item") && !insideSection) {
            const val = totalCol?.type === "formula"
              ? resolveFormula(row, totalCol.formula)
              : Number(row[totalCol?.id || ""]) || 0;
            total += (isNaN(val) ? 0 : val);
          }
        });
        return total;
      })()
    : (data.table.rows || []).reduce((acc: number, row: TableRow) => {
        if (!row) return acc;
        if (row.rowType === "section-header" || row.rowType === "sub-section-header" || row.rowType === "section-total") return acc;
        const rowTotal =
          totalCol?.type === "formula"
            ? resolveFormula(row, totalCol.formula)
            : Number(row[totalCol?.id || ""]) || 0;
        return acc + (isNaN(rowTotal) ? 0 : rowTotal);
      }, 0);

  const summaries: any[] = [];
  let currentRunningTotal = subTotal;
  const prevSummaryValues: Record<string, number> = {};

  (data.table.summary || []).forEach((item: any, idx: number) => {
    const displayId = String.fromCharCode(65 + idx);
    const itemContext = {
      subTotal,
      prev: currentRunningTotal,
      ...prevSummaryValues,
    };
    const val =
      item.type === "formula"
        ? resolveFormula({}, item.formula, itemContext)
        : Number(item.value) || 0;
    
    summaries.push({ ...item, calculatedValue: val, displayId });
    prevSummaryValues[displayId] = val;
    currentRunningTotal += val;
  });

  return { subTotal, summaries, grandTotal: currentRunningTotal };
}

export const getRowNumbering = (rows: TableRow[], useSections: boolean = false): Record<string, string> => {
  const numbering: Record<string, string> = {};
  let l1 = 0;
  let l2 = 0;
  let l3 = 0;
  let inLevel1 = false;
  let inLevel2 = false;

  (rows || []).forEach((row) => {
    const type = row.rowType || "row";
    if (!useSections) {
      if (type === "row") {
        l1++;
        numbering[row.id] = `${l1}`;
      } else {
        numbering[row.id] = "";
      }
      return;
    }

    if (type === "section-header") {
      l1++;
      l2 = 0;
      l3 = 0;
      inLevel1 = true;
      inLevel2 = false;
      numbering[row.id] = `${l1}`;
    } else if (type === "sub-section-header") {
      if (inLevel1) {
        l2++;
        l3 = 0;
        inLevel2 = true;
        numbering[row.id] = `${l1}.${l2}`;
      } else {
        l1++;
        l2 = 0;
        l3 = 0;
        inLevel1 = true;
        inLevel2 = false;
        numbering[row.id] = `${l1}`;
      }
    } else if (type === "section-total") {
      inLevel1 = false;
      inLevel2 = false;
      numbering[row.id] = "";
    } else if (type === "row") {
      if (inLevel2) {
        l3++;
        numbering[row.id] = `${l1}.${l2}.${l3}`;
      } else if (inLevel1) {
        l2++;
        numbering[row.id] = `${l1}.${l2}`;
      } else {
        l1++;
        numbering[row.id] = `${l1}`;
      }
    } else {
      numbering[row.id] = "";
    }
  });
  return numbering;
};

export const calculateChunks = (
  docData: DocData,
  headerHeight: number,
  useSections: boolean
) => {
  const THEAD_HEIGHT = 44; // Fixed header height
  const TOTAL_ROW_HEIGHT = 50; // Refined height for summary rows
  const GRAND_TOTAL_HEIGHT = 80; // Higher estimate for the grand total bar
  const FOOTER_HEADER_HEIGHT = 40;
  const ADD_ROW_BUTTON_HEIGHT = 85; 
  const EMPHASIS_SECTION_HEIGHT =
    (docData.footer.emphasis?.length || 0) * 32 + 40;
  
  const estimateNotesHeight = (html: string) => {
    if (!html) return 0;
    const text = html.replace(/<[^>]*>/g, "");
    const charCount = text.length;
    const paragraphs = (html.match(/<p>/g) || []).length || 1;
    const lineCount = Math.ceil(charCount / 75);
    return lineCount * 22 + paragraphs * 24 + 60;
  };

  const NOTES_ESTIMATE = estimateNotesHeight(docData.footer.notes);
  const FOOTER_PADDING_TOP = 40;

  const estimateRowHeight = (row: TableRow) => {
    const text = String(row.B || "");
    const lines = Math.ceil(text.length / 45);
    return Math.max(48, lines * 22);
  };

  const allRows = (docData.table.rows || []).filter(r => 
    useSections || 
    (r.rowType !== "section-header" && r.rowType !== "sub-section-header" && r.rowType !== "section-total")
  );
  
  const hasFooterContent = !!(
    docData.footer.notes || docData.footer.emphasis?.length
  );
  let currentRowsProcessed = 0;
  const pages: any[] = [];

  const page1HeaderHeight = headerHeight + 50 + 180 + 120;
  
  const estimateBOQSummaryHeight = (docData: DocData) => {
    if (!docData.showBOQSummary) return 0;
    const sections = (docData.table.rows || []).filter(r => r.rowType === "section-header" || r.rowType === "sub-section-header");
    if (sections.length === 0) return 0;
    // Title (60px) + Header (50px) + Rows (50px each) + Totals (approx 200px) + Spacing (40px)
    return 60 + 50 + (sections.length * 50) + 200 + 40;
  };

  const BOQ_SUMMARY_HEIGHT = estimateBOQSummaryHeight(docData);

  let iterations = 0;
  while (
    (currentRowsProcessed < allRows.length || pages.length === 0) &&
    iterations < 50
  ) {
    iterations++;
    const isFirstPage = pages.length === 0;
    let h = isFirstPage ? page1HeaderHeight + BOQ_SUMMARY_HEIGHT : 40;
    h += THEAD_HEIGHT;

    const rowsForThisPage: TableRow[] = [];
    const startIdxOfPage = currentRowsProcessed;
    while (currentRowsProcessed < allRows.length) {
      const rHeight = estimateRowHeight(allRows[currentRowsProcessed]);
      if (h + rHeight <= USABLE_HEIGHT - 10) {
        rowsForThisPage.push(allRows[currentRowsProcessed]);
        h += rHeight;
        currentRowsProcessed++;
      } else {
        break;
      }
    }

    let showRows = rowsForThisPage.length > 0;
    
    // Orphan Header Prevention:
    // If we have fewer than 2 rows (but more exist) and we just started this table block
    // (or on the first page where BOQ Summary might have taken space), 
    // push the table to the next page for better flow.
    if (rowsForThisPage.length > 0 && rowsForThisPage.length < 2 && currentRowsProcessed < allRows.length) {
      rowsForThisPage.length = 0;
      currentRowsProcessed = startIdxOfPage;
      showRows = false;
    }

    // For the first page, we used to always set showRows to true (header only).
    // Now we only do it if we actually have enough rows or if it's the only page.
    if (isFirstPage && !showRows && currentRowsProcessed === allRows.length) {
        showRows = true; // Keep it if there really are no rows at all
    }

    let showTotals = false;
    let showFooter = false;

    if (currentRowsProcessed === allRows.length) {
      const totalsHeight = (docData.table.summary.length + 1) * TOTAL_ROW_HEIGHT + GRAND_TOTAL_HEIGHT + FOOTER_PADDING_TOP + 20;
      
      const RECEIPT_FOOTER_HEIGHT = 200;
      const footerHeight = docData.isReceipt 
        ? RECEIPT_FOOTER_HEIGHT 
        : (docData.footer.notes ? NOTES_ESTIMATE : 0) +
          (docData.footer.emphasis?.length ? EMPHASIS_SECTION_HEIGHT : 0);

      // Account for 'Add New Row' button that appears if we end the rows here
      if (h + ADD_ROW_BUTTON_HEIGHT + totalsHeight <= USABLE_HEIGHT) {
        showTotals = true;
        h += ADD_ROW_BUTTON_HEIGHT + totalsHeight;

        if (h + footerHeight <= USABLE_HEIGHT) {
          showFooter = true;
        }
      }
    }

    pages.push({
      rows: rowsForThisPage,
      showRows: showRows || (isFirstPage && allRows.length === 0),
      showTotals,
      showFooter,
      isEndOfRows:
        currentRowsProcessed === allRows.length &&
        (rowsForThisPage.length > 0 || isFirstPage),
      startIndex:
        pages.length === 0
          ? 0
          : pages[pages.length - 1].startIndex +
            pages[pages.length - 1].rows.length,
    });

    if (
      currentRowsProcessed === allRows.length &&
      (!showTotals || !showFooter)
    ) {
      if (!showTotals) {
        pages.push({
          rows: [],
          showRows: false,
          showTotals: true,
          showFooter: hasFooterContent
            ? TOTAL_ROW_HEIGHT * (docData.table.summary.length + 1) +
                GRAND_TOTAL_HEIGHT +
                NOTES_ESTIMATE +
                EMPHASIS_SECTION_HEIGHT <=
              USABLE_HEIGHT
            : true,
          isEndOfRows: false,
          startIndex: currentRowsProcessed,
        });
        if (hasFooterContent && !pages[pages.length - 1].showFooter) {
          pages.push({
            rows: [],
            showRows: false,
            showTotals: false,
            showFooter: true,
            startIndex: currentRowsProcessed,
          });
        }
      } else if (hasFooterContent && !showFooter) {
        pages.push({
          rows: [],
          showRows: false,
          showTotals: false,
          showFooter: true,
          startIndex: currentRowsProcessed,
        });
      }
      break;
    }

    if (currentRowsProcessed === allRows.length) break;
  }

  return pages;
};
