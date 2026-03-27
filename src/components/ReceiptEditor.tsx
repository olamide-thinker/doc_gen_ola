import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Printer,
  ArrowLeft,
  RefreshCw,
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

  // Simplified logic for Receipt (no stages, just rows, simple subtotal)
  const subTotal = (docData.table.rows || []).reduce((acc: number, row: TableRow) => {
    if (row.rowType === "section-header" || row.rowType === "section-total") return acc;
    const totalCol = [...docData.table.columns].reverse().find(
      (c) => (c.type === "formula" || c.type === "number") && !c.hidden
    );
    const rowTotal = Number(row[totalCol?.id || ""]) || 0;
    return acc + rowTotal;
  }, 0);

  const summaryForRender = (docData.table.summary || []).map((item: any, idx: number) => {
     // For receipts, we assume simple sum if not specified
     return { ...item, calculatedValue: Number(item.value) || 0 };
  });

  const grandTotal = subTotal + summaryForRender.reduce((acc, s) => acc + s.calculatedValue, 0);

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
      <div className="preview-container flex-1 overflow-y-auto p-6 lg:p-16 flex flex-col items-center print:bg-white print:p-0 print:overflow-visible print:h-auto">
        {!isPreview && (
           <div className="fixed z-50 flex gap-2 top-6 left-6 no-print">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-full transition-all shadow-xl active:scale-95 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase"
            >
              <ArrowLeft size={16} /> Dashboard
            </button>
          </div>
        )}
        
        {isPreview && (
          <div className="fixed z-50 flex gap-2 top-6 right-6 no-print">
            <button
              onClick={() => setIsPreview(false)}
              className="px-4 py-2 bg-slate-900 text-white rounded-full transition-all shadow-2xl active:scale-95 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase"
            >
              <ArrowLeft size={16} /> Edit Mode
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-full transition-all shadow-2xl active:scale-95 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase"
            >
              <Printer size={16} /> Print
            </button>
          </div>
        )}

        {!isPreview && (
          <button
              onClick={() => setIsPreview(true)}
              className="fixed bottom-10 right-10 z-50 px-8 py-4 bg-primary text-primary-foreground rounded-full shadow-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:scale-105 transition-all"
            >
              <Printer size={18} /> Preview & Print
          </button>
        )}

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
              resolveFormula={(row, formula) => 0} // Receipts skip formulas for now
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
