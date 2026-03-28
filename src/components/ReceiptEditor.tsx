import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Printer,
  ArrowLeft,
  RefreshCw,
  Check,
} from "../lib/icons/lucide";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { arrayMove } from "@dnd-kit/sortable";
import { DocData, TableRow, InvoiceCode } from "../types";
import { api } from "../lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReceiptPage } from "./ReceiptPage";

const ReceiptEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [docData, setDocData] = useState<DocData | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(
    () => Number(localStorage.getItem("headerHeight")) || 128,
  );
  const [headerImage, setHeaderImage] = useState<string>(
    () => localStorage.getItem("receiptHeaderImage") || "/Shan-PaymentReceipt.png",
  );
  const [isPreview, setIsPreview] = useState(false);
  const [useStages] = useState(false);

  useEffect(() => {
    localStorage.setItem("receiptHeaderImage", headerImage);
  }, [headerImage]);

  useEffect(() => {
    if (docData) {
      const receiptNo = docData.invoiceCode?.text || "Receipt";
      const clientName = docData.contact?.name || "Client";
      document.title = `${receiptNo} - ${clientName}`;
    }
  }, [docData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data: docMetadata, isLoading: isLoadingDoc } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  // Fetch parent invoice for breadcrumb
  const { data: parentInvoice } = useQuery({
    queryKey: ["document", docMetadata?.invoiceId],
    queryFn: () => api.getDocument(docMetadata!.invoiceId!),
    enabled: !!docMetadata?.invoiceId,
  });

  useEffect(() => {
    if (docMetadata && !docData) {
      setDocData(docMetadata.content);
    }
  }, [docMetadata]);

  const saveMutation = useMutation({
    mutationFn: (updates: DocData) =>
      api.updateDocument(id!, { content: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
    },
  });

  useEffect(() => {
    if (!id || !docData) return;
    const timer = setTimeout(() => {
      saveMutation.mutate(docData);
    }, 1500);
    return () => clearTimeout(timer);
  }, [docData, id]);

  const updateDocData = (
    newData: DocData | ((prev: DocData | null) => DocData | null),
  ) => {
    setDocData((prev) => {
      const next = typeof newData === "function" ? newData(prev) : newData;
      return next;
    });
  };

  if (isLoadingDoc || !docData)
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <RefreshCw className="animate-spin text-primary" size={32} />
      </div>
    );

  const resolveFormula = (
    rowData: TableRow | Record<string, number>,
    formula: string | undefined,
    context: Record<string, number> = {},
  ): number => {
    if (!formula) return 0;
    try {
      let expression = formula.replace(/(\d*\.?\d+)\s*%/g, "($1/100)");
      Object.keys(context).forEach((key) => {
        expression = expression.replace(new RegExp(`\\b${key}\\b`, "g"), String(Number(context[key]) || 0));
      });
      const matches = formula.match(/[A-Z]+/g) || [];
      matches.forEach((cid) => {
        if (context[cid] !== undefined) return;
        expression = expression.replace(new RegExp(`\\b${cid}\\b`, "g"), String(Number((rowData as any)[cid]) || 0));
      });
      const idMatches = formula.match(/[a-z][a-zA-Z0-9]+/g) || [];
      idMatches.forEach((mid) => {
        if (context[mid] !== undefined) return;
        expression = expression.replace(new RegExp(`\\b${mid}\\b`, "g"), String(Number((rowData as any)[mid]) || 0));
      });
      if (/[^0-9\s+\-*/().]/.test(expression)) return 0;
      return new Function(`return ${expression}`)();
    } catch {
      return 0;
    }
  };

  const subTotal = (docData.table.rows || []).reduce((acc: number, row: TableRow) => {
    if (row.rowType === "section-header" || row.rowType === "section-total") return acc;
    const totalCol = [...docData.table.columns].reverse().find(
      (c) => (c.type === "formula" || c.type === "number") && !c.hidden
    );
    const rowTotal = totalCol?.type === "formula"
      ? resolveFormula(row, totalCol.formula)
      : Number(row[totalCol?.id || ""]) || 0;
    return acc + rowTotal;
  }, 0);

  const summaryForRender: any[] = [];
  let currentRunningTotal = subTotal;
  (docData.table.summary || []).forEach((item: any, idx: number) => {
    const displayId = String.fromCharCode(65 + idx);
    const val = item.type === "formula"
      ? resolveFormula({}, item.formula, { subTotal, prev: currentRunningTotal })
      : Number(item.value) || 0;
    summaryForRender.push({ ...item, calculatedValue: val, displayId });
    currentRunningTotal += val;
  });

  const grandTotal = currentRunningTotal;

  const rowNumbering: Record<string, string> = {};
  docData.table.rows.forEach((row, i) => {
    if (row.rowType === "row" || !row.rowType) {
      rowNumbering[row.id] = `${i + 1}`;
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && docData) {
      const oldIndex = docData.table.rows.findIndex((r) => r.id === active.id);
      const newIndex = docData.table.rows.findIndex((r) => r.id === over.id);
      const updatedRows = arrayMove(docData.table.rows, oldIndex, newIndex);
      updateDocData({
        ...docData,
        table: { ...docData.table, rows: updatedRows },
      });
    }
  };

  const handleHeaderResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = headerHeight;
    const handleMouseMove = (em: MouseEvent) => {
      const newHeight = startHeight + (em.clientY - startY);
      setHeaderHeight(Math.max(50, newHeight));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const pages = [{ rows: docData.table.rows, isFirstPage: true, showRows: true, showTotals: true, showFooter: true, isEndOfRows: true }];

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden print:overflow-visible print:h-auto">
      {/* ── Sticky breadcrumb header ── */}
      <header className="h-14 border-b border-border bg-white flex items-center gap-2 px-6 shrink-0 shadow-sm z-10 no-print print:hidden">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors uppercase tracking-widest shrink-0"
        >
          <ArrowLeft size={13} /> All Files
        </button>
        {docMetadata?.invoiceId && parentInvoice && (
          <>
            <span className="text-slate-200 font-thin text-base">/</span>
            <button
              onClick={() => navigate(`/invoice-preview/${docMetadata.invoiceId}`)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              {parentInvoice.content?.invoiceCode?.text ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-primary/10 text-primary tracking-wider font-lexend">
                  {parentInvoice.content.invoiceCode.text}
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-600 truncate max-w-[160px]">
                  {parentInvoice.name}
                </span>
              )}
            </button>
          </>
        )}
        <span className="text-slate-200 font-thin text-base">/</span>
        {docData.invoiceCode?.text ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-white tracking-wider font-lexend">
            {docData.invoiceCode.text}
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
            {docMetadata?.name || "Receipt"}
          </span>
        )}

        {/* Save indicator */}
        <div className="ml-auto flex items-center gap-3">
          {saveMutation.isPending ? (
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 flex items-center gap-1.5">
              <RefreshCw size={11} className="animate-spin" /> Saving…
            </span>
          ) : saveMutation.isSuccess ? (
            <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-500 flex items-center gap-1.5">
              <Check size={11} /> Saved
            </span>
          ) : null}
          {isPreview ? (
            <>
              <button
                onClick={() => setIsPreview(false)}
                className="px-3 py-1.5 text-xs font-bold border border-border rounded-md bg-white hover:bg-slate-50 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft size={12} /> Edit Mode
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-all flex items-center gap-1.5"
              >
                <Printer size={12} /> Print
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsPreview(true)}
              className="px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all flex items-center gap-1.5"
            >
              <Printer size={12} /> Preview & Print
            </button>
          )}
        </div>
      </header>

      <div className="preview-container flex-1 overflow-y-auto p-6 lg:p-16 flex flex-col items-center print:bg-white print:p-0 print:overflow-visible print:h-auto">

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {pages.map((page, idx) => (
            <ReceiptPage
              key={idx}
              {...page}
              data={docData}
              pageIndex={idx}
              totalPrice={{ subTotal, summaries: summaryForRender, grandTotal }}
              rowNumbering={rowNumbering}
              headerImage={headerImage}
              headerHeight={headerHeight}
              onHeaderResize={handleHeaderResize}
              onHeaderImageUpload={setHeaderImage}
              isLastPage={idx === pages.length - 1}
              startIndex={0}
              onUpdateContact={(field, val) => updateDocData(prev => prev ? { ...prev, contact: { ...prev.contact, [field]: val } } : null)}
              onUpdateTitle={(val) => updateDocData(prev => prev ? { ...prev, title: val } : null)}
              onUpdateCell={(i, col, val) => updateDocData(prev => {
                if (!prev) return null;
                const nr = [...prev.table.rows];
                nr[i] = { ...nr[i], [col]: val };
                return { ...prev, table: { ...prev.table, rows: nr } };
              })}
              onRemoveRow={(i) => updateDocData(prev => {
                if (!prev) return null;
                const nr = [...prev.table.rows];
                nr.splice(i, 1);
                return { ...prev, table: { ...prev.table, rows: nr } };
              })}
              onAddRowBelow={(i) => updateDocData(prev => {
                if (!prev) return null;
                const nr = [...prev.table.rows];
                const newRow = { id: crypto.randomUUID(), rowType: "row", B: "New Item", C: 1, D: 0 };
                nr.splice(i + 1, 0, newRow as any);
                return { ...prev, table: { ...prev.table, rows: nr } };
              })}
              onAddRowAbove={() => {}}
              onAddSectionBelow={() => {}}
              onAddSectionAbove={() => {}}
              onAddStageBelow={() => {}}
              onAddStageAbove={() => {}}
              onMoveRow={() => {}}
              useStages={false}
              resolveFormula={resolveFormula}
              resolveSectionTotal={() => 0}
              resolveStageTotal={() => 0}
              onUpdateInvoiceCode={(upd) => updateDocData(prev => prev ? { ...prev, invoiceCode: { ...(prev.invoiceCode || {}), ...upd } as any } : null)}
              onUpdateSummaryItem={() => {}}
              onUpdateDate={(val) => updateDocData(prev => prev ? { ...prev, date: val } : null)}
              onUpdatePaymentMethod={(val) => updateDocData(prev => prev ? { ...prev, paymentMethod: val } : null)}
              onUpdateSignature={(val) => updateDocData(prev => prev ? { ...prev, signature: val } : null)}
              onUpdateReceiptMessage={(val) => updateDocData(prev => prev ? { ...prev, receiptMessage: val } : null)}
              onUpdateTransactionId={(val) => updateDocData(prev => prev ? { ...prev, transactionId: val } : null)}
              onUpdateReference={(val) => updateDocData(prev => prev ? { ...prev, reference: val } : null)}
              onUpdateTotalInvoiceAmount={(val) => updateDocData(prev => prev ? { ...prev, totalInvoiceAmount: val } : null)}
              onUpdateAmountPaid={(val) => updateDocData(prev => prev ? { ...prev, amountPaid: val } : null)}
              onUpdateOutstandingBalance={(val) => updateDocData(prev => prev ? { ...prev, outstandingBalance: val } : null)}
              onUpdateAcknowledgement={(val) => updateDocData(prev => prev ? { ...prev, acknowledgement: val } : null)}
              isPreview={isPreview}
              showRows={false}
              showTotals={false}
              showFooter={true}
              isEndOfRows={true}
            />
          ))}
        </DndContext>
      </div>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0 !important;
          }
          html, body { 
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
          }
          .no-print { display: none !important; }
          .app-root, .app-main, .preview-container { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          .a4-page {
            margin: 0 auto !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .a4-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ReceiptEditor;
