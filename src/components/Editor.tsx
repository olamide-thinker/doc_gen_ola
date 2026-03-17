import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Printer,
  FileText,
  Upload,
  RefreshCw,
  User,
  MapPin,
  Type,
  Plus,
  Trash2,
  ArrowLeft,
  Settings2,
  Layout,
  Table as TableIcon,
  Check,
  ChevronUp,
  ChevronDown,
  Download,
  Share,
} from "../lib/icons/lucide";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { 
  DocData, 
  TableRow, 
  Contact, 
  TotalPrice,
  InvoiceCode
} from "../types";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface EditableProps {
  value: string | number;
  onSave: (val: string | number) => void;
  className?: string;
  multiline?: boolean;
  numeric?: boolean;
  readOnly?: boolean;
}

interface A4PageProps {
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
  onUpdateCell: (rowIndex: number, colId: string, value: string | number) => void;
  onRemoveRow: (index: number) => void;
  onAddRowBelow: (index: number) => void;
  resolveFormula: (data: TableRow | Record<string, number>, formula: string | undefined, context?: Record<string, number>) => number;
  onUpdateInvoiceCode: (updates: Partial<InvoiceCode>) => void;
  isPreview: boolean;
}

const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [docData, setDocData] = useState<DocData | null>(null);
  const [jsonInput, setJsonInput] = useState<string>("");
  const [headerImage, setHeaderImage] = useState<string>(
    () => localStorage.getItem("headerImage") || "/shan-letterhead.png",
  );
  
  const [headerHeight, setHeaderHeight] = useState<number>(
    () => Number(localStorage.getItem("headerHeight")) || 128,
  );
  const [isPreview, setIsPreview] = useState(false);

  // --- Queries ---
  const { data: docMetadata, isLoading: isLoadingDoc } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (docMetadata) {
      setDocData(docMetadata.content);
      setJsonInput(JSON.stringify(docMetadata.content, null, 2));
    }
  }, [docMetadata]);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: (updates: DocData) => api.updateDocument(id!, { content: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
    },
  });

  // Auto-save logic
  useEffect(() => {
    if (!id || !docData) return;
    const timer = setTimeout(() => {
      saveMutation.mutate(docData);
    }, 1500);
    return () => clearTimeout(timer);
  }, [docData, id]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: docData?.footer.notes || "",
    onUpdate: ({ editor }) => {
      setDocData((prev: DocData | null) => prev ? ({ ...prev, footer: { ...prev.footer, notes: editor.getHTML() } }) : null);
    },
  });

  useEffect(() => {
    if (editor && docData?.footer.notes && docData.footer.notes !== editor.getHTML()) {
      editor.commands.setContent(docData.footer.notes);
    }
  }, [docData?.footer.notes, editor]);

  useEffect(() => {
    localStorage.setItem("headerImage", headerImage || "");
  }, [headerImage]);

  useEffect(() => {
    localStorage.setItem("headerHeight", headerHeight.toString());
  }, [headerHeight]);

  const onUpdateInvoiceCode = (updates: Partial<InvoiceCode>) => {
    setDocData(prev => {
      if (!prev) return null;
      const current = prev.invoiceCode || { 
        text: `SI/${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}/${new Date().getFullYear()}`, 
        x: 600, 
        y: 100, 
        color: "#503D36" 
      };
      return { ...prev, invoiceCode: { ...current, ...updates } };
    });
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

  const resolveFormula = (data: TableRow | Record<string, number>, formula: string | undefined, context: Record<string, number> = {}): number => {
    if (!formula) return 0;
    try {
      let expression = formula;
      Object.keys(context).forEach(key => {
        const val = Number(context[key]) || 0;
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expression = expression.replace(regex, val.toString());
      });
      const matches = formula.match(/[A-Z]+/g) || [];
      matches.forEach(cid => {
        const val = Number(data[cid]) || 0;
        const regex = new RegExp(`\\b${cid}\\b`, 'g');
        expression = expression.replace(regex, val.toString());
      });
      const idMatches = formula.match(/[a-z][a-zA-Z0-9]+/g) || [];
      idMatches.forEach(mid => {
        if (context[mid] !== undefined) return;
        const val = Number(data[mid]) || 0;
        const regex = new RegExp(`\\b${mid}\\b`, 'g');
        expression = expression.replace(regex, val.toString());
      });
      if (/[^0-9\s+\-*/().]/.test(expression)) return 0;
      return eval(expression);
    } catch (e) { return 0; }
  };

  if (isLoadingDoc || !docData) return (
    <div className="h-screen flex items-center justify-center bg-background"><RefreshCw className="animate-spin text-primary" size={32} /></div>
  );

  const subTotal = (docData.table.rows || []).reduce((acc: number, row: TableRow) => {
    const totalCol = docData.table.columns.find((c: any) => c.type === 'formula' || c.id === 'E');
    const rowTotal = totalCol?.type === 'formula' ? resolveFormula(row, totalCol.formula) : (Number(row[totalCol?.id || '']) || 0);
    return acc + rowTotal;
  }, 0);

  const summaryCalculations = (docData.table.summary || []).reduce((acc: Record<string, number>, item: any) => {
    const context = { subTotal, ...acc };
    acc[item.id] = item.type === 'formula' ? resolveFormula({}, item.formula, context) : (Number(item.value) || 0);
    return acc;
  }, {});

  const grandTotal = subTotal + Object.values(summaryCalculations).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
  const summaryForRender = (docData.table.summary || []).map((item: any) => ({ ...item, calculatedValue: summaryCalculations[item.id] || 0 }));

  const chunks: TableRow[][] = [];
  const safeItems = docData.table.rows || [];
  if (safeItems.length > 0) {
    chunks.push(safeItems.slice(0, 10));
    for (let i = 10; i < safeItems.length; i += 18) { chunks.push(safeItems.slice(i, i + 18)); }
  } else { chunks.push([]); }

  return (
    <div className="app-root flex flex-col h-screen bg-[#FDFCFB] text-slate-900 overflow-hidden font-sans">
      <div className="app-main flex flex-1 overflow-hidden">
        {!isPreview && (
          <div className="w-full lg:w-[420px] flex flex-col border-r border-slate-200/60 bg-white p-8 overflow-y-auto scrollbar-thin no-print">
            <div className="flex items-center justify-between mb-10">
              <button 
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-widest font-lexend">Back to Dashboard</span>
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPreview(true)}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200/60 active:scale-95"
                  title="Preview"
                >
                  <Layout size={18} />
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200/60 active:scale-95"
                  title="Download"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-md active:scale-95 border border-slate-900"
                  title="Print"
                >
                  <Printer size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] font-lexend">
                    Data Status
                  </label>
                  <div className={cn("text-[10px] font-bold px-3 py-1 rounded-full bg-slate-50 text-slate-400 uppercase flex items-center gap-2 border border-slate-200", saveMutation.isPending && "text-blue-500 animate-pulse")}>
                    {saveMutation.isPending ? "Local Sync..." : "Local Storage Sync"}
                  </div>
                </div>
                <textarea
                  className="w-full h-80 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-[10px] font-mono focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none resize-none scrollbar-thin text-slate-700 transition-all shadow-sm"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
              </section>

              <section className="space-y-4">
                <label className="block text-[11px] font-black text-slate-400 uppercase font-lexend tracking-[0.2em]">
                  Document Notes
                </label>
                <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm min-h-[150px]">
                  <EditorContent
                    editor={editor}
                    className="text-slate-700 font-lexend"
                  />
                </div>
              </section>
              
              <section className="space-y-4">
                <label className="block text-[11px] font-black text-slate-400 uppercase font-lexend tracking-[0.2em]">
                  Invoice Settings
                </label>
                <div className="space-y-4 bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm">
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Invoice Code</span>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs outline-none focus:border-slate-400 font-lexend flex-none"
                      value={docData.invoiceCode?.text || ""}
                      placeholder="e.g. SI/024/2026"
                      onChange={(e) => onUpdateInvoiceCode({ text: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Text Color</span>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-lg p-1 outline-none cursor-pointer flex-none"
                        value={docData.invoiceCode?.color || "#503D36"}
                        onChange={(e) => onUpdateInvoiceCode({ color: e.target.value })}
                      />
                      <span className="text-xs font-mono text-slate-500 uppercase">{docData.invoiceCode?.color || "#503D36"}</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground italic">Drag the invoice code on the document to reposition it.</p>
                </div>
              </section>

              <button 
                onClick={() => navigate("/dashboard")}
                 className="w-full py-4 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
            </div>
          </div>
        )}

        <div
          className={`preview-container ${isPreview ? "w-full" : "flex-1"} overflow-y-auto bg-[#F8F9FA] p-6 lg:p-16 flex flex-col items-center scrollbar-thin print:bg-white print:p-0 print:overflow-visible`}
        >
          {isPreview && (
            <div className="fixed top-6 right-6 z-50 flex gap-2 no-print">
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
          {chunks.map((itemChunk, pageIndex) => (
            <A4Page
              key={pageIndex}
              data={docData}
              rows={itemChunk}
              pageIndex={pageIndex}
              totalPrice={
                pageIndex === chunks.length - 1
                  ? { subTotal, summaries: summaryForRender, grandTotal }
                  : null
              }
              headerImage={headerImage}
              headerHeight={headerHeight}
              onHeaderResize={handleHeaderResize}
              isFirstPage={pageIndex === 0}
              isLastPage={pageIndex === chunks.length - 1}
              startIndex={
                pageIndex === 0
                  ? 0
                  : 10 + (pageIndex - 1) * 18
              }
              onUpdateContact={(f, v) => setDocData((prev: DocData | null) => prev ? ({ ...prev, contact: { ...prev.contact, [f]: v } }) : null)}
              onUpdateTitle={v => setDocData((prev: DocData | null) => prev ? ({ ...prev, title: v }) : null)}
              onUpdateCell={(ri, ci, v) => setDocData((prev: DocData | null) => {
                if (!prev) return null;
                const nr = [...prev.table.rows];
                nr[ri] = { ...nr[ri], [ci]: v };
                return { ...prev, table: { ...prev.table, rows: nr } };
              })}
              onRemoveRow={i => setDocData((prev: DocData | null) => prev ? ({ ...prev, table: { ...prev.table, rows: prev.table.rows.filter((_: any, idx: number) => idx !== i) } }) : null)}
              onAddRowBelow={(i) => setDocData((prev: DocData | null) => {
                if (!prev) return null;
                const nr = [...prev.table.rows];
                nr.splice(i + 1, 0, { B: "New Item", C: 1, D: 0 });
                return { ...prev, table: { ...prev.table, rows: nr } };
              })}
              resolveFormula={resolveFormula}
              onUpdateInvoiceCode={onUpdateInvoiceCode}
              isPreview={isPreview}
            />
          ))}
        </div>
      </div>

      <style>{`
        .font-lexend { font-family: 'Lexend', sans-serif; }
        .font-luzia { font-family: 'Lora', serif; }

        .ProseMirror {
          color: #334155;
          font-size: 12px;
          line-height: 1.6;
          outline: none;
        }
        .ProseMirror p { margin: 0 0 1em 0; }
        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 { color: #0f172a; font-weight: 700; }
        
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body { 
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }

          .app-root, .app-main, .preview-container { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important;
            position: static !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }

          .a4-page { 
            box-shadow: none !important; 
            margin: 0 auto !important; 
            border: none !important; 
            page-break-after: always !important;
            page-break-inside: avoid !important;
            display: block !important;
            width: 210mm !important;
            height: 297mm !important;
            position: relative !important;
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
};

const Editable: React.FC<EditableProps> = ({
  value,
  onSave,
  className = "",
  multiline = false,
  numeric = false,
  readOnly = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  const handleBlur = () => {
    setIsEditing(false);
    onSave(currentValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) handleBlur();
    if (e.key === "Escape") {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    const commonClasses = `w-full h-full box-border bg-amber-50/90 border border-amber-400 outline-none text-[#212121] transition-all p-1 overflow-hidden ${className}`;
    return (
      <div className="absolute inset-0 z-10 overflow-hidden">
        {multiline ? (
          <textarea
            autoFocus
            className={cn(commonClasses, "resize-none")}
            value={currentValue as string}
            onChange={(e) => setCurrentValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <input
            autoFocus
            type={numeric ? "number" : "text"}
            className={commonClasses}
            value={currentValue}
            onChange={(e) => setCurrentValue(numeric ? Number(e.target.value) : e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>
    );
  }

  let displayValue = value;
  if (numeric) {
    displayValue = (value === 0 || value === "" || value === null) ? "0" : Number(value).toLocaleString();
  } else {
    displayValue = (value === "" || value === null) ? "--" : value;
  }

  return (
    <div
      onDoubleClick={() => !readOnly && setIsEditing(true)}
      className={cn("relative w-full h-full transition-all group overflow-hidden", !readOnly && "hover:bg-amber-100/20 cursor-text", className)}
    >
      <span className="block truncate w-full">{displayValue}</span>
    </div>
  );
};

const A4Page: React.FC<A4PageProps> = ({
  data,
  rows,
  pageIndex,
  totalPrice,
  headerImage,
  headerHeight,
  onHeaderResize,
  isFirstPage,
  isLastPage,
  startIndex,
  onUpdateContact,
  onUpdateTitle,
  onUpdateCell,
  onRemoveRow,
  onAddRowBelow,
  resolveFormula,
  onUpdateInvoiceCode,
  isPreview,
}) => {
  const HEADER_DARK_BROWN = "#503D36";
  const PRIMARY_BROWN = "#8D6E63";
  const ADDRESS_BG = "#F8F8F8";

  return (
    <div
      className="a4-page bg-white text-[#212121] shadow-2xl mb-12 relative overflow-hidden shrink-0"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "14mm 8mm",
        backgroundColor: "#FFFFFF",
      }}
    >
      {isFirstPage && (
        <div
          className="flex items-center justify-center border-b border-slate-100 overflow-hidden"
          style={{
            margin: "-15mm -20mm 10mm -20mm",
            width: "calc(100% + 40mm)",
            height: `${headerHeight}px`,
            position: "relative",
          }}
        >
          <img
            src={headerImage}
            alt="Logo"
            className="w-full h-full object-contain object-center"
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-2 bg-transparent cursor-ns-resize z-10"
            onMouseDown={onHeaderResize}
          />
        </div>
      )}

      {/* Draggable Invoice Code */}
      {isFirstPage && data.invoiceCode && (
        <div 
          className={cn(
            "absolute select-none z-30 group",
            !isPreview ? "cursor-move" : ""
          )}
          style={{ 
            left: `${data.invoiceCode.x}px`, 
            top: `${data.invoiceCode.y}px`,
            color: data.invoiceCode.color
          }}
          onMouseDown={(e) => {
            if (isPreview) return;
            e.preventDefault();
            const startX = e.clientX - data.invoiceCode!.x;
            const startY = e.clientY - data.invoiceCode!.y;
            const handleMouseMove = (em: MouseEvent) => {
              onUpdateInvoiceCode({ x: em.clientX - startX, y: em.clientY - startY });
            };
            const handleMouseUp = () => {
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
            };
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
          }}
        >
          <div className="font-lexend font-bold text-[14px] whitespace-nowrap">
            {data.invoiceCode.text}
          </div>
          {!isPreview && (
            <div className="absolute -inset-2 border-2 border-dashed border-primary/20 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          )}
        </div>
      )}

      {isFirstPage && (
        <>
          <div className="mb-8 text-[12px] font-normal text-[#212121] font-lexend opacity-80">
            {data.date}
          </div>

          <div
            className="flex justify-between mb-12 py-8 px-4"
            style={{ backgroundColor: ADDRESS_BG }}
          >
            <div className="w-1/2 flex flex-col items-start font-lexend">
              <span className="block text-[#503D36] font-normal text-[11px] font-luzia uppercase mb-3 tracking-[0.1em]">
                Attention To:
              </span>
              <div className="w-full relative min-h-[1.5em] mb-1">
                <Editable
                  className="font-normal text-[#212121] text-[13px] uppercase"
                  value={data.contact.name}
                  onSave={(val) => onUpdateContact("name", val as string)}
                  readOnly={isPreview}
                />
              </div>
              <div className="w-full relative min-h-[1.5em]">
                <Editable
                  className="font-normal text-[12px] opacity-90"
                  value={data.contact.address1}
                  onSave={(val) => onUpdateContact("address1", val as string)}
                  readOnly={isPreview}
                />
              </div>
              <div className="w-full relative min-h-[1.5em]">
                <Editable
                  className="font-normal text-[12px] opacity-90"
                  value={data.contact.address2}
                  onSave={(val) => onUpdateContact("address2", val as string)}
                  readOnly={isPreview}
                />
              </div>
            </div>

            <div className="w-1/2 flex flex-col items-start font-lexend text-left pl-12 border-l border-slate-200">
              <span className="block text-[#503D36] font-normal text-[11px] font-luzia uppercase mb-3 tracking-[0.1em]">
                Billed From:
              </span>
              <div className="font-normal text-[#212121] mb-1 text-[13px]">
                B3F3, The Genesis Estate, Off Odobo Street,
              </div>
              <div className="font-normal text-[12px] opacity-90">
                Ogba-Ikeja, Lagos.
              </div>
            </div>
          </div>

          <div className="flex justify-center mb-10 text-center uppercase tracking-widest text-[12px] font-medium leading-[139.4%] text-[#212121]">
            <Editable
              className="w-[370px]"
              value={data.title}
              onSave={val => onUpdateTitle(val as string)}
              multiline
              readOnly={isPreview}
            />
          </div>
        </>
      )}

      <div className="overflow-hidden border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="text-white text-[11px] font-normal uppercase tracking-[0.2em] font-luzia"
              style={{ backgroundColor: HEADER_DARK_BROWN }}
            >
              {(data.table.columns || []).map((col: any) => (
                <th
                  key={col.id}
                  className="p-4 font-normal border-r border-white/10 last:border-r-0 text-left"
                  style={{ width: col.width || "auto" }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row, idx) => (
              <tr
                key={idx}
                className="text-[12px] text-[#212121] border-b border-slate-50 font-lexend"
                style={{
                  backgroundColor: idx % 2 === 1 ? "#FBFBFB" : "#fff",
                }}
              >
                {(data.table.columns || []).map((col: any) => {
                  if (col.type === "index") {
                    return (
                      <td
                        key={col.id}
                        className="p-3 text-center border-r border-slate-100 relative group"
                        style={{ width: col.width }}
                      >
                        {startIndex + idx + 1}
                        {!isPreview && (
                          <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 no-print transition-all z-20">
                            <button
                              onClick={() => onRemoveRow(startIndex + idx)}
                              className="text-red-400 hover:text-red-500"
                            >
                              <Plus className="rotate-45" size={14} />
                            </button>
                            <button
                              onClick={() => onAddRowBelow(startIndex + idx)}
                              className="text-blue-400 hover:text-blue-500"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  }

                  const cellValue =
                    col.type === "formula"
                      ? resolveFormula(row, col.formula)
                      : row[col.id];

                  return (
                    <td
                      key={col.id}
                      className="p-3 border-r border-slate-100 last:border-r-0"
                    >
                      <Editable
                        value={cellValue}
                        numeric={col.type === "number"}
                        readOnly={isPreview || col.type === "formula"}
                        onSave={(val) =>
                          onUpdateCell(startIndex + idx, col.id, val)
                        }
                        className={col.type === "formula" ? "font-bold" : ""}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLastPage && totalPrice && (
        <div className="mt-8 border-t border-slate-100">
          <TotalRow label="Sub Total" value={totalPrice.subTotal} />
          {(totalPrice.summaries || []).map((item: any) => (
            <TotalRow
              key={item.id}
              label={item.label}
              value={item.calculatedValue || 0}
            />
          ))}
          <div
            className="flex justify-between items-center p-6 text-white"
            style={{ backgroundColor: PRIMARY_BROWN }}
          >
            <span className="text-[14px] font-normal tracking-wide font-lexend uppercase">
              Grand Total
            </span>
            <span className="text-[18px] font-bold font-lexend">
              ₦{Math.round(totalPrice.grandTotal).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {isLastPage && data.footer.notes && (
        <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded">
          <h4 className="text-[12px] font-bold text-slate-700 mb-2 uppercase tracking-widest">
            Document Notes
          </h4>
          <div
            className="text-[12px] font-normal text-[#212121] font-lexend leading-relaxed"
            dangerouslySetInnerHTML={{ __html: data.footer.notes }}
          />
        </div>
      )}
      
      {isLastPage && data.footer.emphasis && Array.isArray(data.footer.emphasis) && data.footer.emphasis.length > 0 && (
          <div
            className="mt-4 bg-[#EDEDED] px-8 py-5 flex flex-col gap-1.5"
          >
            {data.footer.emphasis.map((item: any, idx: number) => (
              <div key={idx} className="flex gap-3 items-center">
                <span className="uppercase text-[10px] tracking-widest text-[#7A7672] font-black">
                  {item.key}:
                </span>
                <span className="text-[15px] font-bold tracking-wide text-[#4B4032]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
      )}

      <div className="absolute bottom-10 left-0 w-full text-center px-16">
        <div className="border-t border-slate-100 pt-6 flex justify-between items-center text-[9px] text-slate-300 uppercase font-bold tracking-widest opacity-60 font-lexend">
          <span>Maintenance Proposal 2026</span>
          <span>Page {pageIndex + 1}</span>
          <span>Quality Works Guaranteed</span>
        </div>
      </div>
    </div>
  );
};

const TotalRow = ({ label, value }: { label: string, value: number }) => {
  return (
    <div className="flex justify-between items-center p-4 text-[12px] font-normal border-b border-slate-50 font-lexend">
      <span className="text-slate-400 uppercase text-[9px] tracking-[0.2em]">
        {label}
      </span>
      <span className="text-[#212121]">
        ₦{Math.round(value).toLocaleString()}
      </span>
    </div>
  );
};

export default Editor;
