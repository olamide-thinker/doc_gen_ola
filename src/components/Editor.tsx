import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Printer,
  FileText,
  Upload,
  RefreshCw,
  User,
  Plus,
  Trash2,
  ArrowLeft,
  Layout,
  ChevronUp,
  ChevronDown,
  Download,
  Share,
  Undo2,
  Redo2,
  GripVertical,
} from "../lib/icons/lucide";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { arrayMove } from "@dnd-kit/sortable";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DocData, TableRow, Contact, TotalPrice, InvoiceCode } from "../types";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface EditableProps {
  value: string | number;
  onSave: (val: string | number) => void;
  className?: string;
  multiline?: boolean;
  numeric?: boolean;
  isDate?: boolean;
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
  onUpdateCell: (
    rowIndex: number,
    colId: string,
    value: string | number,
  ) => void;
  onRemoveRow: (index: number) => void;
  onAddRowBelow: (index: number) => void;
  onAddRowAbove: (index: number) => void;
  onMoveRow: (index: number, direction: "up" | "down") => void;
  resolveFormula: (
    data: TableRow | Record<string, number>,
    formula: string | undefined,
    context?: Record<string, number>,
  ) => number;
  onUpdateInvoiceCode: (updates: Partial<InvoiceCode>) => void;
  onUpdateSummaryItem: (id: string, label: string) => void;
  onUpdateDate: (value: string) => void;
  isPreview: boolean;
}

const SortableSummaryItem = ({
  item,
  idx,
  onUpdate,
  onRemove,
  calculatedValue,
}: {
  item: any;
  idx: number;
  onUpdate: (updates: any) => void;
  onRemove: () => void;
  calculatedValue: number;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };
  const letterId = String.fromCharCode(65 + idx);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col items-center gap-2 p-2 border bg-slate-50 border-slate-200 rounded-xl group/summary"
    >
      <div className="flex items-center w-full gap-2">
        <div
          {...attributes}
          {...listeners}
          className="transition-colors cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
        >
          <GripVertical size={14} />
        </div>
        <div className="w-6 h-6 flex items-center justify-center bg-slate-200/50 rounded text-[10px] font-black text-slate-500">
          {letterId}
        </div>
        <div className="flex items-center flex-1 min-w-0 gap-2">
          <div className="relative flex-1 min-w-0 overflow-hidden bg-white border rounded-md h-7 border-slate-200">
            <input
              className="w-full h-full px-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 outline-none focus:bg-amber-50/30"
              value={item.label}
              placeholder="Label"
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </div>
          <div className="text-slate-400 font-bold text-[10px]">:</div>
          <div className="relative flex-1 min-w-0 overflow-hidden bg-white border rounded-md h-7 border-slate-200">
            <input
              className="w-full h-full px-2 text-[10px] font-lexend text-slate-500 outline-none focus:bg-amber-50/30"
              value={item.formula || ""}
              placeholder="Formula (e.g. prev * 0.1)"
              onChange={(e) => onUpdate({ formula: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end w-full gap-2">
        <div className="text-[16px] font-lexend font-bold text-slate-400 min-w-[40px] text-right">
          ₦{Math.round(calculatedValue).toLocaleString()}
        </div>
        <button
          onClick={onRemove}
          className="px-1 transition-colors text-slate-300 hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

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
  const [rawInput, setRawInput] = useState<string>("");
  const [history, setHistory] = useState<DocData[]>([]);
  const [future, setFuture] = useState<DocData[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // --- Queries ---
  const { data: docMetadata, isLoading: isLoadingDoc } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (docMetadata) {
      if (!docData) {
        setDocData(docMetadata.content);
        setJsonInput(JSON.stringify(docMetadata.content, null, 2));
      }
    }
  }, [docMetadata]);

  const updateDocData = (
    newData: DocData | ((prev: DocData | null) => DocData | null),
  ) => {
    setDocData((prev) => {
      const next = typeof newData === "function" ? newData(prev) : newData;
      if (prev && next && JSON.stringify(prev) !== JSON.stringify(next)) {
        setHistory((h) => [...h, prev].slice(-50));
        setFuture([]);
      }
      return next;
    });
  };

  const undo = () => {
    if (history.length === 0 || !docData) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [docData, ...f]);
    setDocData(prev);
  };

  const redo = () => {
    if (future.length === 0 || !docData) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, docData]);
    setDocData(next);
  };

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: (updates: DocData) =>
      api.updateDocument(id!, { content: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
    },
  });

  // Undo/Redo shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, future, docData]);

  // Auto-save logic
  useEffect(() => {
    if (!id || !docData) return;
    setJsonInput(JSON.stringify(docData, null, 2));
    const timer = setTimeout(() => {
      saveMutation.mutate(docData);
    }, 1500);
    return () => clearTimeout(timer);
  }, [docData, id]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: docData?.footer.notes || "",
    onUpdate: ({ editor }) => {
      setDocData((prev: DocData | null) =>
        prev
          ? { ...prev, footer: { ...prev.footer, notes: editor.getHTML() } }
          : null,
      );
    },
  });

  useEffect(() => {
    if (
      editor &&
      docData?.footer.notes &&
      docData.footer.notes !== editor.getHTML()
    ) {
      editor.commands.setContent(docData.footer.notes);
    }
  }, [docData?.footer.notes, editor]);

  useEffect(() => {
    localStorage.setItem("headerImage", headerImage || "");
  }, [headerImage]);

  useEffect(() => {
    localStorage.setItem("headerHeight", headerHeight.toString());
  }, [headerHeight]);

  useEffect(() => {
    if (docData && docData.table.rows.some((r) => !r.id)) {
      const updatedRows = docData.table.rows.map((r) =>
        r.id ? r : { ...r, id: crypto.randomUUID() },
      );
      updateDocData({
        ...docData,
        table: { ...docData.table, rows: updatedRows },
      });
    }
  }, [docData]);

  const onUpdateInvoiceCode = (updates: Partial<InvoiceCode>) => {
    setDocData((prev) => {
      if (!prev) return null;
      const current = prev.invoiceCode || {
        text: "",
        prefix: "SI",
        count: String(Math.floor(Math.random() * 999) + 1).padStart(3, "0"),
        year: String(new Date().getFullYear()),
        x: 600,
        y: 100,
        color: "#503D36",
      };

      const next = { ...current, ...updates };
      // Sync the combined text field
      next.text = `${next.prefix || "SI"}/${next.count || "001"}/${next.year || new Date().getFullYear()}`;

      return { ...prev, invoiceCode: next };
    });
  };

  const handleRawImport = () => {
    if (!rawInput.trim() || !docData) return;

    const sections = rawInput.split(/\n\s*\n/);
    let newContact = { ...docData.contact };
    let newTitle = docData.title;
    let newRows: TableRow[] = [];

    sections.forEach((section) => {
      const lines = section.trim().split("\n");
      const firstLineLower = lines[0].toLowerCase();

      if (firstLineLower.includes("contact")) {
        const sameLineContent = lines[0].split(":").slice(1).join(":").trim();
        const dataLines = sameLineContent
          ? [sameLineContent, ...lines.slice(1)]
          : lines.slice(1);
        if (dataLines[0]) newContact.name = dataLines[0].trim();
        if (dataLines[1]) newContact.address1 = dataLines[1].trim();
        if (dataLines[2]) newContact.address2 = dataLines[2].trim();
      } else if (
        firstLineLower.includes("title") ||
        firstLineLower.includes("ttitle")
      ) {
        const sameLineTitle = lines[0].split(":").slice(1).join(":").trim();
        const titleLines = sameLineTitle
          ? [sameLineTitle, ...lines.slice(1)]
          : lines.slice(1);
        newTitle = titleLines.join("\n").trim();
      } else if (firstLineLower.includes("content")) {
        lines.slice(1).forEach((line) => {
          const rowMatch = line.trim().match(/^-?\s*(.*?)\s+([\d,]+)$/);
          if (rowMatch) {
            newRows.push({
              B: rowMatch[1].trim(),
              C: 1,
              D: Number(rowMatch[2].replace(/,/g, "")),
            });
          }
        });
      }
    });

    if (
      newRows.length > 0 ||
      newTitle !== docData.title ||
      JSON.stringify(newContact) !== JSON.stringify(docData.contact)
    ) {
      const updated = {
        ...docData,
        contact: newContact,
        title: newTitle,
        table: {
          ...docData.table,
          rows: newRows.length > 0 ? [...newRows] : docData.table.rows,
        },
      };
      setDocData(updated);
      setJsonInput(JSON.stringify(updated, null, 2));
    }
  };

  const handleApplyJson = () => {
    try {
      if (!jsonInput.trim()) return;
      const parsed = JSON.parse(jsonInput);
      setDocData(parsed);
      saveMutation.mutate(parsed);
    } catch (e) {
      alert("Invalid JSON format. Please check your syntax.");
    }
  };

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

  const handleSummaryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && docData) {
      const oldIndex = docData.table.summary.findIndex(
        (s) => s.id === active.id,
      );
      const newIndex = docData.table.summary.findIndex(
        (s) => s.id === over?.id,
      );
      const newSummary = arrayMove(docData.table.summary, oldIndex, newIndex);
      updateDocData({
        ...docData,
        table: { ...docData.table, summary: newSummary },
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

  const resolveFormula = (
    data: TableRow | Record<string, number>,
    formula: string | undefined,
    context: Record<string, number> = {},
  ): number => {
    if (!formula) return 0;
    try {
      // First, handle percentages (e.g. 75% -> (75/100))
      let expression = formula.replace(/(\d+(\.\d+)?)%/g, "($1/100)");

      // Inject context variables (subTotal, prev, or previous summary results)
      Object.keys(context).forEach((key) => {
        const val = Number(context[key]) || 0;
        const regex = new RegExp(`\\b${key}\\b`, "g");
        expression = expression.replace(regex, val.toString());
      });

      // Inject row column variables (A, B, C...)
      const matches = formula.match(/[A-Z]+/g) || [];
      matches.forEach((cid) => {
        const val = Number(data[cid]) || 0;
        const regex = new RegExp(`\\b${cid}\\b`, "g");
        expression = expression.replace(regex, val.toString());
      });

      // Inject any other lowercase variable names if provided in context
      const idMatches = formula.match(/[a-z][a-zA-Z0-9]+/g) || [];
      idMatches.forEach((mid) => {
        if (context[mid] !== undefined) return;
        const val = Number(data[mid]) || 0;
        const regex = new RegExp(`\\b${mid}\\b`, "g");
        expression = expression.replace(regex, val.toString());
      });

      // Final safety check: block any dangerous characters
      if (/[^0-9\s+\-*/().]/.test(expression)) {
        console.warn(
          "Dangerous or invalid characters in expression:",
          expression,
        );
        return 0;
      }

      return new Function(`return ${expression}`)();
    } catch (e) {
      console.warn("Formula calculation error:", e, formula);
      return 0;
    }
  };

  const getLetterId = (idx: number) => String.fromCharCode(65 + idx);

  if (isLoadingDoc || !docData)
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <RefreshCw className="animate-spin text-primary" size={32} />
      </div>
    );

  const subTotal = (docData.table.rows || []).reduce(
    (acc: number, row: TableRow) => {
      const totalCol = docData.table.columns.find(
        (c: any) => c.type === "formula" || c.id === "E",
      );
      const rowTotal =
        totalCol?.type === "formula"
          ? resolveFormula(row, totalCol.formula)
          : Number(row[totalCol?.id || ""]) || 0;
      return acc + rowTotal;
    },
    0,
  );

  const summaryResults: any[] = [];
  let currentRunningTotal = subTotal;

  (docData.table.summary || []).forEach((item: any, idx: number) => {
    const itemContext = { subTotal, prev: currentRunningTotal };
    const val =
      item.type === "formula"
        ? resolveFormula({}, item.formula, itemContext)
        : Number(item.value) || 0;
    summaryResults.push({
      ...item,
      calculatedValue: val,
      displayId: getLetterId(idx),
    });
    currentRunningTotal += val;
  });

  const grandTotal = currentRunningTotal;
  const summaryForRender = summaryResults;

  const chunks: TableRow[][] = [];
  const safeItems = docData.table.rows || [];
  if (safeItems.length > 0) {
    chunks.push(safeItems.slice(0, 10));
    for (let i = 10; i < safeItems.length; i += 18) {
      chunks.push(safeItems.slice(i, i + 18));
    }
  } else {
    chunks.push([]);
  }

  return (
    <div className="app-root flex flex-col h-screen bg-[#FDFCFB] text-slate-900 overflow-hidden font-sans">
      <div className="flex flex-1 overflow-hidden app-main">
        {!isPreview && (
          <div className="w-full lg:w-[380px] flex flex-col border-r border-slate-200/60 bg-white pb-5 px-5 overflow-y-auto scrollbar-none no-print">
            <div className="sticky top-0 z-10 flex items-center justify-between pt-5 pb-4 mb-8 bg-white border-b border-border">
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 transition-colors text-slate-500 hover:text-slate-900 group"
              >
                <ArrowLeft
                  size={16}
                  className="group-hover:-translate-x-0.5 transition-transform"
                />
                <span className="text-[10px] font-semibold uppercase tracking-widest font-lexend">
                  Dashboard
                </span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={undo}
                  disabled={history.length === 0}
                  className="p-2 transition-all border rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-slate-200 disabled:opacity-30 active:scale-95"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={16} />
                </button>
                <button
                  onClick={redo}
                  disabled={future.length === 0}
                  className="p-2 transition-all border rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-slate-200 disabled:opacity-30 active:scale-95"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 size={16} />
                </button>
                <div className="w-px h-6 mx-1 bg-slate-200" />
                <button
                  onClick={() => setIsPreview(true)}
                  className="p-2 transition-all border bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border-slate-200/60 active:scale-95"
                  title="Preview"
                >
                  <Layout size={18} />
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 transition-all border bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border-slate-200/60 active:scale-95"
                  title="Download"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 transition-all border bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border-slate-200/60 active:scale-95"
                  title="Print"
                >
                  <Printer size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] font-lexend">
                    Raw context
                  </label>
                  <button
                    onClick={handleRawImport}
                    className="text-[10px] font-bold px-3 py-1 rounded-full bg-secondary/10 text-primary/75 uppercase border border-primary/20 hover:bg-primary/20 transition-all"
                  >
                    Sync Data
                  </button>
                </div>
                <textarea
                  className="w-full h-40 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-[10px] font-lexend focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none resize-none scrollbar-thin text-slate-700 transition-all shadow-sm"
                  placeholder="Paste contact, title, and content bullets here..."
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
              </section>

              {showAdvanced && (
                <section className="pt-4 space-y-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] font-lexend">
                      Data Status
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApplyJson}
                        className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-900 text-white uppercase border border-slate-900 hover:bg-slate-800 transition-all shadow-sm"
                      >
                        Apply JSON
                      </button>
                      <div
                        className={cn(
                          "text-[10px] font-bold px-3 py-1 rounded-full bg-slate-50 text-slate-400 uppercase flex items-center gap-2 border border-slate-200",
                          saveMutation.isPending &&
                            "text-blue-500 animate-pulse",
                        )}
                      >
                        {saveMutation.isPending
                          ? "Local Sync..."
                          : "Local Storage Sync"}
                      </div>
                    </div>
                  </div>
                  <textarea
                    className="w-full h-80 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-[10px] font-lexend focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none resize-none scrollbar-thin text-slate-700 transition-all shadow-sm"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                  />
                </section>
              )}

              <section className="space-y-4">
                <label className="block text-[11px] font-black text-slate-400 uppercase font-lexend tracking-[0.2em]">
                  Document Notes
                </label>
                <div className="border border-slate-200/60 rounded-xl p-4 min-h-[120px]">
                  <EditorContent
                    editor={editor}
                    className="text-slate-700 font-lexend"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <label className="block text-[11px] font-black text-slate-400 uppercase font-lexend tracking-[0.2em]">
                  Summary Calculations
                </label>
                <div className="p-3 border border-slate-200/60 rounded-xl">
                  <div className="flex flex-col gap-2">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleSummaryDragEnd}
                    >
                      <SortableContext
                        items={docData.table.summary.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {docData.table.summary.map((item, idx) => (
                          <SortableSummaryItem
                            key={item.id}
                            item={item}
                            idx={idx}
                            calculatedValue={
                              summaryForRender[idx]?.calculatedValue || 0
                            }
                            onUpdate={(updates) => {
                              const newSummary = [...docData.table.summary];
                              newSummary[idx] = { ...item, ...updates };
                              updateDocData({
                                ...docData,
                                table: {
                                  ...docData.table,
                                  summary: newSummary,
                                },
                              });
                            }}
                            onRemove={() => {
                              const newSummary = docData.table.summary.filter(
                                (_, i) => i !== idx,
                              );
                              updateDocData({
                                ...docData,
                                table: {
                                  ...docData.table,
                                  summary: newSummary,
                                },
                              });
                            }}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <button
                      onClick={() => {
                        const newSummary = [
                          ...docData.table.summary,
                          {
                            id: crypto.randomUUID(),
                            label: "New Adjustment",
                            type: "formula" as const,
                            formula: "prev * 0",
                          },
                        ];
                        updateDocData({
                          ...docData,
                          table: { ...docData.table, summary: newSummary },
                        });
                      }}
                      className="w-full py-2.5 border border-dashed border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-400 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2 mt-2"
                    >
                      <Plus size={14} /> Add Calculation
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <label className="block text-[11px] font-black text-slate-400 uppercase font-lexend tracking-[0.2em]">
                  Emphasis Management
                </label>
                <div className="p-3 border border-slate-200/60 rounded-xl">
                  <div className="flex flex-col gap-3">
                    {(docData.footer.emphasis || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 border bg-slate-50 rounded-xl border-slate-200/60"
                      >
                        <input
                          type="text"
                          className="bg-transparent border-none outline-none font-bold text-[9px] uppercase tracking-wider text-slate-500 w-24"
                          value={item.key}
                          placeholder="KEY"
                          onChange={(e) => {
                            const newEmphasis = [
                              ...(docData.footer.emphasis || []),
                            ];
                            newEmphasis[idx] = { ...item, key: e.target.value };
                            updateDocData({
                              ...docData,
                              footer: {
                                ...docData.footer,
                                emphasis: newEmphasis,
                              },
                            });
                          }}
                        />
                        <div className="w-px h-4 bg-slate-200" />
                        <input
                          type="text"
                          className="bg-transparent border-none outline-none text-[11px] text-slate-700 w-full"
                          value={item.value}
                          placeholder="Value"
                          onChange={(e) => {
                            const newEmphasis = [
                              ...(docData.footer.emphasis || []),
                            ];
                            newEmphasis[idx] = {
                              ...item,
                              value: e.target.value,
                            };
                            updateDocData({
                              ...docData,
                              footer: {
                                ...docData.footer,
                                emphasis: newEmphasis,
                              },
                            });
                          }}
                        />
                        <button
                          onClick={() => {
                            const newEmphasis = (
                              docData.footer.emphasis || []
                            ).filter((_, i) => i !== idx);
                            updateDocData({
                              ...docData,
                              footer: {
                                ...docData.footer,
                                emphasis: newEmphasis,
                              },
                            });
                          }}
                          className="px-1 transition-colors text-slate-300 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newEmphasis = [
                          ...(docData.footer.emphasis || []),
                          { key: "New Label", value: "Value" },
                        ];
                        updateDocData({
                          ...docData,
                          footer: { ...docData.footer, emphasis: newEmphasis },
                        });
                      }}
                      className="w-full py-2.5 border border-dashed border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-400 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Add Emphasis
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <label className="block text-[11px] font-black text-slate-400 uppercase font-lexend tracking-[0.2em]">
                  Invoice Settings
                </label>
                <div className="p-3 space-y-3 border border-slate-200/60 rounded-xl">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Invoice Code (Prefix / Count / Year)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          className="w-12 h-8 p-2 text-xs text-center border rounded-md outline-none border-slate-200 focus:border-slate-400 font-lexend"
                          value={docData.invoiceCode?.prefix || "SI"}
                          placeholder="SI"
                          onChange={(e) =>
                            onUpdateInvoiceCode({ prefix: e.target.value })
                          }
                        />
                        <span className="text-slate-300">/</span>
                        <input
                          type="text"
                          className="w-12 h-8 p-2 text-xs text-center border rounded-md outline-none border-slate-200 focus:border-slate-400 font-lexend"
                          value={docData.invoiceCode?.count || "001"}
                          placeholder="001"
                          onChange={(e) =>
                            onUpdateInvoiceCode({ count: e.target.value })
                          }
                        />
                        <span className="text-slate-300">/</span>
                        <input
                          type="text"
                          className="w-12 h-8 p-2 text-xs text-center border rounded-md outline-none border-slate-200 focus:border-slate-400 font-lexend"
                          value={
                            docData.invoiceCode?.year ||
                            String(new Date().getFullYear())
                          }
                          placeholder="2026"
                          onChange={(e) =>
                            onUpdateInvoiceCode({ year: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Code Color
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="w-6 h-6 p-0 bg-transparent border-none rounded cursor-pointer"
                          value={docData.invoiceCode?.color || "#503D36"}
                          onChange={(e) =>
                            onUpdateInvoiceCode({ color: e.target.value })
                          }
                        />
                        <span className="text-[10px] font-lexend text-slate-500 uppercase">
                          {docData.invoiceCode?.color || "#503D36"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors border-t border-slate-100 flex items-center justify-center gap-2"
              >
                {showAdvanced
                  ? "Hide Advanced Settings"
                  : "Show Advanced Settings"}
              </button>

              {/* <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center justify-center gap-2 py-2 transition-colors text-slate-400 hover:text-slate-600 group"
              >
                <ArrowLeft
                  size={14}
                  className="group-hover:-translate-x-0.5 transition-transform"
                />
                <span className="text-[10px] font-black uppercase tracking-widest font-lexend">
                  Back to Dashboard
                </span>
              </button> */}
            </div>
          </div>
        )}

        <div
          className={`preview-container ${isPreview ? "w-full" : "flex-1"} overflow-y-auto bg-[#F8F9FA] p-6 lg:p-16 flex flex-col items-center scrollbar-thin print:bg-white print:p-0 print:overflow-visible`}
        >
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
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
                startIndex={pageIndex === 0 ? 0 : 10 + (pageIndex - 1) * 18}
                onUpdateContact={(f, v) =>
                  updateDocData((prev: DocData | null) =>
                    prev
                      ? { ...prev, contact: { ...prev.contact, [f]: v } }
                      : null,
                  )
                }
                onUpdateTitle={(v) =>
                  updateDocData((prev: DocData | null) =>
                    prev ? { ...prev, title: v } : null,
                  )
                }
                onUpdateCell={(ri, ci, v) =>
                  updateDocData((prev: DocData | null) => {
                    if (!prev) return null;
                    const nr = [...prev.table.rows];
                    nr[ri] = { ...nr[ri], [ci]: v };
                    return { ...prev, table: { ...prev.table, rows: nr } };
                  })
                }
                onRemoveRow={(i) =>
                  updateDocData((prev: DocData | null) =>
                    prev
                      ? {
                          ...prev,
                          table: {
                            ...prev.table,
                            rows: prev.table.rows.filter(
                              (_: any, idx: number) => idx !== i,
                            ),
                          },
                        }
                      : null,
                  )
                }
                onAddRowBelow={(i) =>
                  updateDocData((prev: DocData | null) => {
                    if (!prev) return null;
                    const nr = [...prev.table.rows];
                    nr.splice(nr.length, 0, {
                      id: crypto.randomUUID(),
                      B: "New Item",
                      C: 1,
                      D: 0,
                    });
                    return { ...prev, table: { ...prev.table, rows: nr } };
                  })
                }
                onAddRowAbove={(i) =>
                  updateDocData((prev: DocData | null) => {
                    if (!prev) return null;
                    const nr = [...prev.table.rows];
                    nr.splice(i, 0, {
                      id: crypto.randomUUID(),
                      B: "New Item",
                      C: 1,
                      D: 0,
                    });
                    return { ...prev, table: { ...prev.table, rows: nr } };
                  })
                }
                onMoveRow={(i, dir) =>
                  updateDocData((prev: DocData | null) => {
                    if (!prev) return null;
                    const nr = [...prev.table.rows];
                    const target = dir === "up" ? i - 1 : i + 1;
                    if (target < 0 || target >= nr.length) return prev;
                    [nr[i], nr[target]] = [nr[target], nr[i]];
                    return { ...prev, table: { ...prev.table, rows: nr } };
                  })
                }
                resolveFormula={resolveFormula}
                onUpdateInvoiceCode={(updates) =>
                  updateDocData((prev) =>
                    prev
                      ? {
                          ...prev,
                          invoiceCode: {
                            ...(prev.invoiceCode || {
                              text: "",
                              x: 0,
                              y: 0,
                              color: "",
                            }),
                            ...updates,
                          },
                        }
                      : null,
                  )
                }
                onUpdateSummaryItem={(id, label) =>
                  updateDocData((prev) => {
                    if (!prev) return null;
                    const ns = prev.table.summary.map((s) =>
                      s.id === id ? { ...s, label } : s,
                    );
                    return { ...prev, table: { ...prev.table, summary: ns } };
                  })
                }
                onUpdateDate={(v) =>
                  updateDocData((prev: DocData | null) =>
                    prev ? { ...prev, date: v } : null,
                  )
                }
                isPreview={isPreview}
              />
            ))}
          </DndContext>
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
  isDate = false,
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
        ) : isDate ? (
          <input
            autoFocus
            type="date"
            className={commonClasses}
            value={currentValue}
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
            onChange={(e) =>
              setCurrentValue(numeric ? Number(e.target.value) : e.target.value)
            }
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>
    );
  }

  let displayValue = value;
  if (numeric) {
    displayValue =
      value === 0 || value === "" || value === null
        ? "0"
        : Number(value).toLocaleString();
  } else {
    displayValue = value === "" || value === null ? "--" : value;
  }

  return (
    <div
      onDoubleClick={() => !readOnly && setIsEditing(true)}
      className={cn(
        "relative w-full h-full transition-all group font-lexend overflow-hidden",
        !readOnly && "hover:bg-amber-100/20 cursor-text",
        className,
      )}
    >
      <span className="block w-full ">{displayValue}</span>
    </div>
  );
};

interface SortableRowProps {
  id: string;
  row: TableRow;
  idx: number;
  startIndex: number;
  data: DocData;
  isPreview: boolean;
  onUpdateCell: (
    rowIndex: number,
    colId: string,
    value: string | number,
  ) => void;
  onRemoveRow: (index: number) => void;
  resolveFormula: (
    data: TableRow | Record<string, number>,
    formula: string | undefined,
    context?: Record<string, number>,
  ) => number;
}

const SortableRow: React.FC<SortableRowProps> = ({
  id,
  row,
  idx,
  startIndex,
  data,
  isPreview,
  onUpdateCell,
  onRemoveRow,
  resolveFormula,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: (startIndex + idx) % 2 === 1 ? "#FBFBFB" : "#fff",
    zIndex: isDragging ? 100 : 1,
    position: "relative" as const,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "text-[14px] text-[#212121] border-b border-slate-50 font-lexend group transition-colors",
        isDragging && "shadow-xl border-primary/20 z-50 ring-1 ring-primary/10",
      )}
    >
      {(data.table.columns || []).map((col: any) => {
        if (col.type === "index") {
          return (
            <td
              key={col.id}
              className="relative h-10 p-3 overflow-hidden border-r border-slate-100"
              style={{ width: col.width }}
            >
              <div
                {...attributes}
                {...listeners}
                className={cn(
                  "cursor-grab active:cursor-grabbing flex items-center justify-center gap-1 hover:text-primary transition-colors",
                  isPreview && "pointer-events-none",
                )}
              >
                {!isPreview && (
                  <GripVertical
                    size={12}
                    className="transition-opacity text-slate-300"
                  />
                )}
                <span className="font-bold">{startIndex + idx + 1}</span>
              </div>

              {!isPreview && (
                <div className="absolute left-[-14px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 no-print transition-all z-20">
                  <button
                    onClick={() => onRemoveRow(startIndex + idx)}
                    className="h-full p-1 text-red-400 transition-all bg-white border rounded-lg shadow-sm border-slate-200 hover:text-red-500 hover:border-red-100 active:scale-95"
                    title="Delete Row"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </td>
          );
        }

        const cellValue = row[col.id];
        const isFormula = col.type === "formula";
        const displayValue = isFormula
          ? resolveFormula(row, col.formula)
          : cellValue;

        return (
          <td
            key={col.id}
            className={cn(
              "p-3 border-r border-slate-100 last:border-r-0 relative h-10 overflow-hidden",
              (col.type === "number" || col.type === "formula") &&
                "text-left font-lexend text-medium",
            )}
            style={{ width: col.width }}
          >
            {isFormula ? (
              <span className="opacity-80">
                {typeof displayValue === "number"
                  ? displayValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : displayValue}
              </span>
            ) : (
              <Editable
                className={cn(
                  "w-full",
                  (col.type === "number" || col.type === "formula") &&
                    "text-left font-lexend",
                )}
                value={cellValue}
                onSave={(val) =>
                  onUpdateCell(
                    startIndex + idx,
                    col.id,
                    col.type === "number" ? Number(val) : (val as string),
                  )
                }
                readOnly={isPreview}
              />
            )}
          </td>
        );
      })}
    </tr>
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
  onAddRowAbove,
  onMoveRow,
  resolveFormula,
  onUpdateInvoiceCode,
  onUpdateSummaryItem,
  onUpdateDate,
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
          className="flex items-center justify-center overflow-hidden border-b border-slate-100"
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
            className="object-contain object-center w-full h-full"
          />
          <div
            className="absolute bottom-0 left-0 right-0 z-10 h-2 bg-transparent cursor-ns-resize"
            onMouseDown={onHeaderResize}
          />
        </div>
      )}

      {/* Draggable Invoice Code */}
      {isFirstPage && data.invoiceCode && (
        <div
          className={cn(
            "absolute select-none z-30 group",
            !isPreview ? "cursor-move" : "",
          )}
          style={{
            left: `${data.invoiceCode.x}px`,
            top: `${data.invoiceCode.y}px`,
            color: data.invoiceCode.color,
          }}
          onMouseDown={(e) => {
            if (isPreview) return;
            e.preventDefault();
            const startX = e.clientX - data.invoiceCode!.x;
            const startY = e.clientY - data.invoiceCode!.y;
            const handleMouseMove = (em: MouseEvent) => {
              onUpdateInvoiceCode({
                x: em.clientX - startX,
                y: em.clientY - startY,
              });
            };
            const handleMouseUp = () => {
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
            };
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
          }}
        >
          <div className="font-lexend font-bold text-[16px] whitespace-nowrap">
            {data.invoiceCode.text}
          </div>
          {!isPreview && (
            <div className="absolute transition-opacity border-2 border-dashed rounded opacity-0 pointer-events-none -inset-2 border-primary/20 group-hover:opacity-100" />
          )}
        </div>
      )}

      {isFirstPage && (
        <>
          <div className="mb-8 w-[150px] text-[14px] font-normal text-[#212121] font-lexend opacity-80 relative h-[1.5em] overflow-hidden">
            <Editable
              value={data.date}
              onSave={(val) => onUpdateDate(val as string)}
              isDate={true}
              readOnly={isPreview}
            />
          </div>

          <div
            className="flex justify-between px-4 py-8 mb-12"
            style={{ backgroundColor: ADDRESS_BG }}
          >
            <div className="flex flex-col items-start w-1/2 font-lexend">
              <span className="block text-[#503D36] font-normal text-[13px] font-luzia uppercase mb-3 tracking-[0.1em]">
                Attention To:
              </span>
              <div className="w-full relative h-[1.5em] mb-1 overflow-hidden">
                <Editable
                  className="font-normal text-[#212121] text-[15px] uppercase"
                  value={data.contact.name}
                  onSave={(val) => onUpdateContact("name", val as string)}
                  readOnly={isPreview}
                />
              </div>
              <div className="w-full relative h-[1.5em] overflow-hidden">
                <Editable
                  className="font-normal text-[14px] opacity-90"
                  value={data.contact.address1}
                  onSave={(val) => onUpdateContact("address1", val as string)}
                  readOnly={isPreview}
                />
              </div>
              <div className="w-full relative h-[1.5em] overflow-hidden">
                <Editable
                  className="font-normal text-[14px] opacity-90"
                  value={data.contact.address2}
                  onSave={(val) => onUpdateContact("address2", val as string)}
                  readOnly={isPreview}
                />
              </div>
            </div>

            <div className="flex flex-col items-start w-1/2 pl-12 text-left border-l font-lexend border-slate-200">
              <span className="block text-[#503D36] font-normal text-[13px] font-luzia uppercase mb-3 tracking-[0.1em]">
                Billed From:
              </span>
              <div className="font-normal text-[#212121] mb-1 text-[15px]">
                B3F3, The Genesis Estate, Off Odobo Street,
              </div>
              <div className="font-normal text-[14px] opacity-90">
                Ogba-Ikeja, Lagos.
              </div>
            </div>
          </div>

          <div className="flex justify-center mb-10 text-center uppercase tracking-widest text-[18px] font-medium leading-[139.4%] text-[#212121]">
            <div className="w-[500px] relative h-14 overflow-hidden">
              <Editable
                className="w-full"
                value={data.title}
                onSave={(val) => onUpdateTitle(val as string)}
                multiline
                readOnly={isPreview}
              />
            </div>
          </div>
        </>
      )}

      <div className="overflow-hidden border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="text-white text-[13px] font-normal uppercase tracking-[0.2em] font-luzia"
              style={{ backgroundColor: HEADER_DARK_BROWN }}
            >
              {(data.table.columns || []).map((col: any) => (
                <th
                  key={col.id}
                  className="p-4 font-normal text-left border-r border-white/10 last:border-r-0"
                  style={{ width: col.width || "auto" }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SortableContext
              items={rows.map((r) => r.id as string)}
              strategy={verticalListSortingStrategy}
            >
              {(rows || []).map((row, idx) => (
                <SortableRow
                  key={row.id as string}
                  id={row.id as string}
                  row={row}
                  idx={idx}
                  startIndex={startIndex}
                  data={data}
                  isPreview={isPreview}
                  onUpdateCell={onUpdateCell}
                  onRemoveRow={onRemoveRow}
                  resolveFormula={resolveFormula}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
        {isLastPage && !isPreview && (
          <div className="p-4 border-t border-slate-50 bg-[#FBFBFB]/50 flex justify-center no-print">
            <button
              onClick={() => onAddRowBelow(rows.length - 1)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/30 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 group"
            >
              <Plus
                size={14}
                className="transition-transform duration-300 group-hover:rotate-90"
              />
              Add New Line Item
            </button>
          </div>
        )}
      </div>

      {isLastPage && totalPrice && (
        <div className="mt-8 border-t border-slate-100">
          <TotalRow label="Sub Total" value={totalPrice.subTotal} readOnly />
          {(totalPrice.summaries || []).map((item: any) => (
            <TotalRow
              key={item.id}
              label={item.label}
              value={item.calculatedValue || 0}
              onSaveLabel={(val) => onUpdateSummaryItem(item.id, val)}
              readOnly={isPreview}
            />
          ))}
          <div
            className="flex items-center justify-between p-2 px-5 text-white"
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
        <div className="p-4 mt-8 border rounded bg-slate-50 border-slate-200">
          <h4 className="text-[14px] font-bold text-slate-700 mb-2 uppercase tracking-widest">
            Document Notes
          </h4>
          <div
            className="text-[14px] font-normal text-[#212121] font-lexend leading-relaxed"
            dangerouslySetInnerHTML={{ __html: data.footer.notes }}
          />
        </div>
      )}

      {isLastPage &&
        data.footer.emphasis &&
        Array.isArray(data.footer.emphasis) &&
        data.footer.emphasis.length > 0 && (
          <div className="mt-4 bg-[#EDEDED] px-8 py-5 flex flex-col gap-1.5">
            {data.footer.emphasis.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="uppercase text-[12px] tracking-widest text-[#7A7672] font-black">
                  {item.key}:
                </span>
                <span className="text-[17px] font-bold tracking-wide text-[#4B4032]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

      <div className="absolute left-0 w-full px-16 text-center bottom-10">
        <div className="border-t border-slate-100 pt-6 flex justify-between items-center text-[11px] text-slate-300 uppercase font-bold tracking-widest opacity-60 font-lexend">
          <span>Maintenance Proposal 2026</span>
          <span>Page {pageIndex + 1}</span>
          <span>Quality Works Guaranteed</span>
        </div>
      </div>
    </div>
  );
};

const TotalRow = ({
  label,
  value,
  onSaveLabel,
  readOnly = false,
}: {
  label: string;
  value: number;
  onSaveLabel?: (val: string) => void;
  readOnly?: boolean;
}) => {
  return (
    <div className="flex justify-between items-center p-4 text-[14px] font-normal border-b border-slate-50 font-lexend h-12">
      <div className="text-slate-400 uppercase text-[11px] tracking-[0.2em] min-w-[120px] relative h-full overflow-hidden flex items-center">
        {onSaveLabel ? (
          <Editable
            value={label}
            onSave={(val) => onSaveLabel(val as string)}
            readOnly={readOnly}
          />
        ) : (
          <span>{label}</span>
        )}
      </div>
      <span className="text-[#212121]">
        ₦{Math.round(value).toLocaleString()}
      </span>
    </div>
  );
};

export default Editor;
