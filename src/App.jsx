import React, { useState, useEffect } from "react";
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
  Settings2,
  Layout,
  Table as TableIcon,
  Check,
  ChevronUp,
  ChevronDown,
  Download,
  Share,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const App = () => {
  // --- Constants ---
  const DEFAULT_DOC_DATA = {
    contact: {
      name: "OLUWAKEMI ISINKAYE",
      address1: "Prime Waters Garden II",
      address2: "Lekki Phase 1",
    },
    title: "PROPOSED For Maintenance of A 5 bedroom apartment at Prime Waters Garden II Lekki Phase 1.",
    date: new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    table: {
      columns: [
        { id: "A", label: "S/N", type: "index", width: "60px" },
        { id: "B", label: "Description of Service", type: "text" },
        { id: "C", label: "Views", type: "number", width: "80px" },
        { id: "D", label: "Unit Price", type: "number", format: "currency", width: "140px" },
        { id: "E", label: "Total", type: "formula", formula: "C * D", format: "currency", width: "140px" },
      ],
      rows: [
        { B: "Master Bedroom Closet Maintenance", C: 1, D: 260000 },
        { B: "Glass Works (Change of Glass)", C: 1, D: 335000 },
        { B: "Plumbing maintenance", C: 1, D: 165000 },
        { B: "Bedframe Joinery Maintenance", C: 1, D: 110000 },
        { B: "Tv Console Maintenance", C: 1, D: 200000 },
        { B: "Door handles and Locks", C: 1, D: 78000 },
        { B: "Switches & Socket", C: 1, D: 410000 },
        { B: "Fix & Deep Wash Sofa", C: 1, D: 180000 },
        { B: "Launder Rugs", C: 1, D: 50000 },
        { B: "Kitchen Joinery & Other Kitchen Maintenance Works", C: 1, D: 270000 },
        { B: "Arts in Rooms", C: 1, D: 200000 },
        { B: "Dining Rug", C: 1, D: 200000 },
      ],
      summary: [
        { id: "logistics", label: "Consultation & Logistics", type: "number", value: 300000 },
        { id: "vat", label: "VAT (7.5%)", type: "formula", formula: "(subTotal + logistics) * 0.075" }
      ]
    },
    footer: {
      notes: `<p>This invoice relates to the approved design stage services...</p>`,
      emphasis: [
        { key: "Account Name", value: "SHAN INTERIORS LIMITED" },
        { key: "Account Number", value: "1615822982" },
        { key: "Bank", value: "ACCESS BANK" },
      ],
    },
  };

  // --- State ---
  const [docData, setDocData] = useState(() => {
    const saved = localStorage.getItem("docData");
    return saved ? JSON.parse(saved) : DEFAULT_DOC_DATA;
  });
  
  const [jsonInput, setJsonInput] = useState(() => JSON.stringify(docData, null, 2));

  const [headerImage, setHeaderImage] = useState(
    () => localStorage.getItem("headerImage") || "/shan-letterhead.png",
  );
  
  const [headerHeight, setHeaderHeight] = useState(
    () => Number(localStorage.getItem("headerHeight")) || 128,
  );

  const [isPreview, setIsPreview] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSharedView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("preview") === "true";
  });
  const [previewPass, setPreviewPass] = useState("");

  useEffect(() => {
    localStorage.setItem("headerImage", headerImage || "");
  }, [headerImage]);

  useEffect(() => {
    localStorage.setItem("headerHeight", headerHeight.toString());
  }, [headerHeight]);

  useEffect(() => {
    // Migration: Ensure docData always has the required nested structure
    let needsUpdate = false;
    const stabilized = JSON.parse(JSON.stringify(docData)); // Deep clone for safety

    if (!stabilized.table.summary) {
      stabilized.table.summary = DEFAULT_DOC_DATA.table.summary;
      needsUpdate = true;
    }
    if (!stabilized.footer.emphasis) {
      stabilized.footer.emphasis = DEFAULT_DOC_DATA.footer.emphasis;
      needsUpdate = true;
    }

    if (needsUpdate) {
      setDocData(stabilized);
      return; // Let the next cycle handle persistence
    }
    
    localStorage.setItem("docData", JSON.stringify(docData));
    setJsonInput(JSON.stringify(docData, null, 2));
  }, [docData]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: docData.footer.notes,
    onUpdate: ({ editor }) => {
      setDocData(prev => ({
        ...prev,
        footer: { ...prev.footer, notes: editor.getHTML() }
      }));
    },
  });

  // Re-sync editor content if docData.footer.notes changes externally (e.g. from JSON import)
  useEffect(() => {
    if (editor && docData.footer.notes !== editor.getHTML()) {
      editor.commands.setContent(docData.footer.notes);
    }
  }, [docData.footer.notes, editor]);

  // --- Formula Logic ---
  const resolveFormula = (data, formula, context = {}) => {
    if (!formula) return 0;
    try {
      let expression = formula;
      
      // 1. Inject context variables (like subTotal)
      Object.keys(context).forEach(key => {
        const val = Number(context[key]) || 0;
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expression = expression.replace(regex, val);
      });

      // 2. Inject row/item variables (A, B, C...)
      const matches = formula.match(/[A-Z]+/g) || [];
      matches.forEach(id => {
        const val = Number(data[id]) || 0;
        const regex = new RegExp(`\\b${id}\\b`, 'g');
        expression = expression.replace(regex, val);
      });

      // 3. Inject ID-based variables (like 'logistics' if data is a summary map)
      const idMatches = formula.match(/[a-z][a-zA-Z0-9]+/g) || [];
      idMatches.forEach(id => {
        if (context[id] !== undefined) return; // Already handled by context
        const val = Number(data[id]) || 0;
        const regex = new RegExp(`\\b${id}\\b`, 'g');
        expression = expression.replace(regex, val);
      });

      if (/[^0-9\s+\-*/().]/.test(expression)) return 0;
      return eval(expression);
    } catch (e) {
      console.error("Formula error:", e);
      return 0;
    }
  };

  const parseLetterContext = (text) => {
    if (!text.trim())
      return {
        contact: { name: "", address1: "", address2: "" },
        title: "",
        items: [],
        date: new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      };

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    let contact = { name: "", address1: "", address2: "" };
    let title = "";
    let items = [];
    let mode = null;

    lines.forEach((line) => {
      const lowerLine = line.toLowerCase();
      if (lowerLine.startsWith("contact")) {
        mode = "contact";
        return;
      }
      if (lowerLine.includes("title")) {
        mode = "title";
        return;
      }
      if (lowerLine.startsWith("content")) {
        mode = "content";
        return;
      }

      if (mode === "contact") {
        if (!contact.name) contact.name = line;
        else if (!contact.address1) contact.address1 = line;
        else contact.address2 = line;
      } else if (mode === "title") {
        title += (title ? " " : "") + line;
      } else if (mode === "content") {
        const cleanedLine = line.replace(/^-\s*/, "");
        const parts = cleanedLine.split(/\s+(\d{1,3}(?:,\d{3})*)$/);
        if (parts.length > 1) {
          items.push({
            id: Math.random().toString(36).substr(2, 9),
            desc: parts[0].trim(),
            price: parseInt(parts[1].replace(/,/g, ""), 10),
            qty: 1,
          });
        } else if (line.length > 3) {
          items.push({
            id: Math.random().toString(36).substr(2, 9),
            desc: line,
            price: 0,
            qty: 1,
          });
        }
      }
    });

    return {
      contact,
      title,
      items,
      date: new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  };

  // --- Handlers ---
  const handleJsonImport = (input) => {
    try {
      let data = JSON.parse(input || jsonInput);
      
      // Migration: Convert legacy 'items' to 'table.rows'
      if (data.items && (!data.table || !data.table.rows)) {
        const rows = data.items.map(item => ({
          B: item.desc || "",
          C: item.qty || 1,
          D: item.price || 0
        }));
        data = {
          ...data,
          table: {
            ...DEFAULT_DOC_DATA.table,
            rows: rows
          }
        };
        delete data.items;
      }

      // Ensure summary and emphasis exist
      if (!data.table) data.table = { ...DEFAULT_DOC_DATA.table };
      if (!data.table.summary) data.table.summary = DEFAULT_DOC_DATA.table.summary;
      if (!data.footer) data.footer = { ...DEFAULT_DOC_DATA.footer };
      if (!data.footer.emphasis) data.footer.emphasis = DEFAULT_DOC_DATA.footer.emphasis;

      setDocData(data);
      setJsonInput(JSON.stringify(data, null, 2));
      alert("Document updated successfully!");
    } catch (e) {
      console.error("Import error:", e);
      alert("Invalid JSON format. Please check your data.");
    }
  };

  const updateContactField = (field, value) => {
    setDocData((prev) => ({
      ...prev,
      contact: { ...prev.contact, [field]: value },
    }));
  };

  const updateTitle = (value) => {
    setDocData((prev) => ({ ...prev, title: value }));
  };

  const updateCell = (rowIndex, colId, value) => {
    setDocData((prev) => {
      const newRows = [...prev.table.rows];
      newRows[rowIndex] = { ...newRows[rowIndex], [colId]: value };
      return { ...prev, table: { ...prev.table, rows: newRows } };
    });
  };

  const removeTableRow = (index) => {
    setDocData((prev) => ({
      ...prev,
      table: {
        ...prev.table,
        rows: prev.table.rows.filter((_, i) => i !== index),
      },
    }));
  };

  const moveTableRow = (index, direction) => {
    setDocData((prev) => {
      const newRows = [...prev.table.rows];
      const targetIndex = index + direction;
      if (targetIndex >= 0 && targetIndex < newRows.length) {
        [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
      }
      return { ...prev, table: { ...prev.table, rows: newRows } };
    });
  };

  const addTableRow = (index, offset = 0) => {
    setDocData((prev) => {
      const newRows = [...prev.table.rows];
      const newRow = {};
      prev.table.columns.forEach(col => {
        if (col.type === 'number') newRow[col.id] = 0;
        else if (col.type === 'text') newRow[col.id] = "";
      });
      newRows.splice(index + offset, 0, newRow);
      return { ...prev, table: { ...prev.table, rows: newRows } };
    });
  };

  const updateEmphasisKey = (index, newKey) => {
    setDocData((prev) => {
      const newEmphasis = [...prev.footer.emphasis];
      newEmphasis[index].key = newKey;
      return { ...prev, footer: { ...prev.footer, emphasis: newEmphasis } };
    });
  };

  const updateEmphasisValue = (index, newValue) => {
    setDocData((prev) => {
      const newEmphasis = [...prev.footer.emphasis];
      newEmphasis[index].value = newValue;
      return { ...prev, footer: { ...prev.footer, emphasis: newEmphasis } };
    });
  };

  const addEmphasisRow = (index, offset = 0) => {
    setDocData((prev) => {
      const newEmphasis = [...prev.footer.emphasis];
      newEmphasis.splice(index + offset, 0, { key: "New Key", value: "New Value" });
      return { ...prev, footer: { ...prev.footer, emphasis: newEmphasis } };
    });
  };

  const removeEmphasisRow = (index) => {
    setDocData((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        emphasis: prev.footer.emphasis.filter((_, i) => i !== index),
      },
    }));
  };

  const toggleColumn = (col) => {
    setColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  const handlePrint = () => window.print();

  const handleDownload = () => window.print(); // For now, same as print

  const generatePreviewLink = async () => {
    const pass = prompt("Set a password for the preview:");
    if (!pass) return;

    const data = btoa(JSON.stringify(docData));
    const longUrl = `${window.location.origin}${window.location.pathname}?preview=true&data=${data}&pass=${pass}`;

    try {
      const response = await fetch("https://spoo.me/", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ url: longUrl }),
      });

      const result = await response.json();
      if (result.short_url) {
        await navigator.clipboard.writeText(result.short_url);
        alert("Professional short link copied to clipboard!");
      } else {
        throw new Error("Shortening service returned invalid response");
      }
    } catch (error) {
      await navigator.clipboard.writeText(longUrl);
      alert("Preview link copied to clipboard! (Note: Link is long because shortener service is currently unavailable)");
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (f) => setHeaderImage(f.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleHeaderResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = headerHeight;
    const handleMouseMove = (e) => {
      const newHeight = startHeight + (e.clientY - startY);
      setHeaderHeight(Math.max(50, newHeight));
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const subTotal = (docData.table.rows || []).reduce((acc, row) => {
    const totalCol = docData.table.columns.find(c => c.type === 'formula' || c.id === 'E');
    const rowTotal = totalCol?.type === 'formula' 
      ? resolveFormula(row, totalCol.formula) 
      : (Number(row[totalCol?.id]) || 0);
    return acc + rowTotal;
  }, 0);

  // Calculate dynamic summaries (Logistics, VAT, etc.)
  const summaryCalculations = (docData.table.summary || []).reduce((acc, item) => {
    const context = { subTotal, ...acc };
    const value = item.type === 'formula' 
      ? resolveFormula({}, item.formula, context) 
      : (Number(item.value) || 0);
    acc[item.id] = value;
    return acc;
  }, {});

  const totalSummaryValue = Object.values(summaryCalculations).reduce((acc, val) => acc + val, 0);
  const grandTotal = subTotal + totalSummaryValue;

  const summaryForRender = (docData.table.summary || []).map(item => ({
    ...item,
    calculatedValue: summaryCalculations[item.id] || 0
  }));

  // Reduced limits to ensure they actually fit on A4 pages
  const firstPageLimit = 10;
  const otherPagesLimit = 18;
  const chunks = [];
  const safeItems = docData.table.rows || [];

  if (safeItems.length > 0) {
    chunks.push(safeItems.slice(0, firstPageLimit));
    for (let i = firstPageLimit; i < safeItems.length; i += otherPagesLimit) {
      chunks.push(safeItems.slice(i, i + otherPagesLimit));
    }
  } else {
    chunks.push([]);
  }

  if (isSharedView && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-6 font-lexend">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-10 shadow-xl">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="p-4 bg-slate-900 rounded-2xl mb-6">
              <FileText size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2 uppercase">
              Secure Preview
            </h2>
            <p className="text-slate-500 text-sm">
              Please enter the password to view this document.
            </p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              autoFocus
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-center text-lg tracking-widest"
              required
            />
            <button
              type="submit"
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10"
            >
              Access Document
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root flex flex-col h-screen bg-[#FDFCFB] text-slate-900 overflow-hidden font-sans">
      <div className="app-main flex flex-1 overflow-hidden">
        {!isPreview && !isSharedView && (
          <div className="w-full lg:w-[420px] flex flex-col border-r border-slate-200/60 bg-white p-8 overflow-y-auto scrollbar-thin no-print">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3 text-slate-900">
                <div className="p-2 bg-slate-900 rounded-xl">
                  <FileText size={20} className="text-white" />
                </div>
                <h1 className="text-xl font-black tracking-tighter font-lexend uppercase text-[14px]">
                  PRO DOCUMENT
                </h1>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generatePreviewLink}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200/60 active:scale-95"
                  title="Generate Preview Link"
                >
                  <Share size={18} />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200/60 active:scale-95"
                  title="Download"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={handlePrint}
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
                    Data Import (JSON)
                  </label>
                  <button
                    onClick={() => handleJsonImport()}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold font-lexend transition-all shadow-md active:scale-95"
                  >
                    <RefreshCw size={12} /> SYNC DATA
                  </button>
                </div>
                <textarea
                  className="w-full h-80 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-[10px] font-mono focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none resize-none scrollbar-thin text-slate-700 transition-all shadow-sm"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste JSON document structure here..."
                />
                <p className="text-[9px] text-slate-400 font-lexend italic px-2">
                  Tip: Columns use IDs (A, B, C...) for formulas. Total column is typically "C * D".
                </p>
              </section>

              <section className="space-y-4">
                <label className="block text-[11px] font-black text-slate-400 uppercase font-lexend tracking-[0.2em]">
                  Header Branding
                </label>
                <div className="relative group cursor-pointer border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:border-slate-900 transition-all bg-slate-50 text-center hover:bg-slate-100/50 overflow-hidden">
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={handleImageUpload}
                    accept="image/*"
                  />
                  {headerImage ? (
                    <div className="relative h-20 w-full flex items-center justify-center">
                      <img src={headerImage} alt="Logo Preview" className="max-h-full object-contain opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload size={20} className="text-slate-900" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload
                        size={24}
                        className="mx-auto mb-3 text-slate-400 group-hover:text-slate-900 transition-colors"
                      />
                      <span className="text-[10px] uppercase font-black font-lexend text-slate-400 group-hover:text-slate-900 transition-colors">
                        Logo Upload
                      </span>
                    </>
                  )}
                </div>
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
                  Banking Details (Emphasis)
                </label>
                <div className="flex flex-col gap-3 relative">
                  {(docData.footer.emphasis || []).map((item, idx) => (
                    <div key={idx} className="relative group/row">
                      <div
                        className="flex gap-3 items-center p-3 border border-slate-200/60 rounded-xl bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <input
                          className="w-32 bg-transparent border-b border-slate-200 text-[11px] font-lexend font-bold text-slate-500 hover:border-slate-400 focus:border-slate-900 outline-none transition-colors px-1"
                          value={item.key}
                          onChange={(e) => updateEmphasisKey(idx, e.target.value)}
                        />
                        <input
                          className="flex-1 bg-transparent border-b border-slate-200 text-[11px] font-lexend font-medium text-slate-900 hover:border-slate-400 focus:border-slate-900 outline-none transition-colors px-1"
                          value={item.value}
                          onChange={(e) => updateEmphasisValue(idx, e.target.value)}
                        />
                        <button
                          onClick={() => removeEmphasisRow(idx)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex justify-center gap-2 mt-1 opacity-0 group-hover/row:opacity-100 transition-opacity no-print">
                         <button onClick={() => addEmphasisRow(idx)} className="text-[8px] font-bold text-slate-400 hover:text-slate-900">+ ROW ABOVE</button>
                         <button onClick={() => addEmphasisRow(idx, 1)} className="text-[8px] font-bold text-slate-400 hover:text-slate-900">+ ROW BELOW</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Preview Area */}
        <div
          className={`preview-container ${isPreview ? "w-full" : "flex-1"} overflow-y-auto bg-[#F8F9FA] p-6 lg:p-16 flex flex-col items-center scrollbar-thin print:bg-white print:p-0 print:overflow-visible`}
        >
          {isPreview && (
            <div className="fixed top-6 right-6 z-50 flex gap-2 no-print">
              <button
                onClick={handleDownload}
                className="px-2.5 py-1 bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-black/60 rounded-full transition-all shadow-2xl active:scale-95 flex items-center gap-1.5 text-slate-200 text-[10px] font-bold tracking-tight uppercase"
                title="Download PDF"
              >
                <Download
                  size={12}
                  className="text-slate-400 group-hover:text-white"
                />
                <span>Download</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-2.5 py-1 bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-black/60 rounded-full transition-all shadow-2xl active:scale-95 flex items-center gap-1.5 text-slate-200 text-[10px] font-bold tracking-tight uppercase"
                title="Print Document"
              >
                <Printer
                  size={12}
                  className="text-slate-400 group-hover:text-white"
                />
                <span>Print</span>
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
                  : firstPageLimit + (pageIndex - 1) * otherPagesLimit
              }
              onUpdateContact={updateContactField}
              onUpdateTitle={updateTitle}
              onUpdateCell={updateCell}
              onRemoveRow={removeTableRow}
              onMoveRow={moveTableRow}
              onAddRowAbove={addTableRow}
              onAddRowBelow={addTableRow}
              resolveFormula={resolveFormula}
              isPreview={isPreview}
            />
          ))}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&family=Lora:ital,wght@0,400;0,700;1,400&display=swap');
        
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
        .ProseMirror a { color: #0f172a; text-decoration: underline; font-weight: 500; }

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

          /* Surgical layout overrides for printing */
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

const ToggleButton = ({ active, onClick, label, icon }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-[11px] font-bold font-lexend border transition-all flex items-center gap-2 ${active ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
  >
    <span className={active ? "text-white" : "text-slate-400"}>{icon}</span>{" "}
    {label}
  </button>
);

const Editable = ({
  value,
  onSave,
  className = "",
  multiline = false,
  numeric = false,
  containerPadding = "p-0",
  readOnly = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  const handleDoubleClick = (e) => {
    if (readOnly) return;
    e.stopPropagation();
    setCurrentValue(value);
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onSave(currentValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !multiline) handleBlur();
    if (e.key === "Escape") {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  const handleChange = (e) => {
    const val = numeric ? Number(e.target.value) : e.target.value;
    setCurrentValue(val);
  };

  if (isEditing) {
    const commonClasses = `w-full h-full bg-amber-50/90 border border-amber-400 outline-none text-[#212121] transition-all p-1 ${className}`;
    return (
      <div className="absolute inset-0 z-10">
        {multiline ? (
          <textarea
            autoFocus
            className={commonClasses}
            value={currentValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={3}
          />
        ) : (
          <input
            autoFocus
            type={numeric ? "number" : "text"}
            className={commonClasses}
            value={currentValue}
            onChange={handleChange}
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
        ? "--"
        : Number(value).toLocaleString();
  } else {
    displayValue = value === "" || value === null ? "--" : value;
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full ${readOnly ? "" : "hover:bg-amber-100/20 cursor-text"} transition-all group ${containerPadding} ${className}`}
    >
      {displayValue}
      {!readOnly && (
        <span className="absolute -right-4 -top-1 opacity-0 group-hover:opacity-20 text-[6px] no-print text-amber-700 font-black tracking-widest bg-amber-200 px-1 rounded uppercase">
          Edit
        </span>
      )}
    </div>
  );
};

const A4Page = ({
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
  onMoveRow,
  onAddRowAbove,
  onAddRowBelow,
  resolveFormula,
  isPreview,
}) => {
  const PRIMARY_BROWN = "#8D6E63";
  const HEADER_DARK_BROWN = "#503D36";
  const ADDRESS_BG = "#F8F8F8";

  return (
    <div
      className="a4-page bg-white text-[#212121] shadow-2xl mb-12 relative overflow-hidden shrink-0"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "14mm 8mm",
        backgroundColor: "#FFFFFF",
        fontFamily: "'Lexend', sans-serif",
      }}
    >
      {/* Header Area */}
      {isFirstPage && (
        <div
          className="flex items-center justify-center border-b border-slate-100"
          style={{
            margin: "-15mm -20mm 10mm -20mm",
            width: "calc(100% + 40mm)",
            height: `${headerHeight}px`,
            position: "relative",
          }}
        >
          {headerImage ? (
            <img
              src={headerImage}
              alt="Logo"
              className="max-w-full max-h-full object-center object-contain"
            />
          ) : (
            <div className="text-slate-200 italic text-[10px] uppercase tracking-[0.5em] font-black opacity-30">
              Document Logo
            </div>
          )}
          <div
            className="absolute bottom-0 left-0 right-0 h-2 bg-transparent cursor-ns-resize"
            onMouseDown={onHeaderResize}
          />
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
                  onSave={(val) => onUpdateContact("name", val)}
                  readOnly={isPreview}
                />
              </div>
              <div className="w-full relative min-h-[1.5em]">
                <Editable
                  className="font-normal text-[12px] opacity-90"
                  value={data.contact.address1}
                  onSave={(val) => onUpdateContact("address1", val)}
                  readOnly={isPreview}
                />
              </div>
              <div className="w-full relative min-h-[1.5em]">
                <Editable
                  className="font-normal text-[12px] opacity-90"
                  value={data.contact.address2}
                  onSave={(val) => onUpdateContact("address2", val)}
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

          {/* Title Area */}
          <div className="flex justify-center mb-10">
            <div
              style={{
                width: "368.29px",
                fontFamily: "'Lexend', sans-serif",
                fontStyle: "normal",
                fontWeight: 500,
                fontSize: "12px",
                lineHeight: "139.4%",
                textAlign: "center",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "#212121",
                paddingBottom: "8px",
              }}
            >
              <Editable
                value={data.title}
                onSave={onUpdateTitle}
                multiline
                readOnly={isPreview}
              />
            </div>
          </div>
        </>
      )}

      {/* Dynamic Table */}
      <div className="overflow-hidden border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="text-white text-[11px] font-normal uppercase tracking-[0.2em] font-luzia"
              style={{ backgroundColor: HEADER_DARK_BROWN }}
            >
              {(data.table.columns || []).map((col) => (
                <th
                  key={col.id}
                  className={`p-4 font-normal border-r border-white/10 last:border-r-0 ${
                    col.type === "index" ? "text-center" : "text-left"
                  }`}
                  style={{ width: col.width || "auto" }}
                >
                  <div className="flex flex-col">
                    {!isPreview && (
                      <span className="text-[7px] opacity-40 font-mono tracking-tighter mb-1">
                        Column {col.id}
                      </span>
                    )}
                    {col.label}
                  </div>
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
                {(data.table.columns || []).map((col) => {
                  if (col.type === "index") {
                    return (
                      <td
                        key={col.id}
                        className="p-3 text-center border-r border-slate-100 relative group"
                        style={{ width: col.width }}
                      >
                        {startIndex + idx + 1}
                        {!isPreview && (
                          <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 no-print transition-all z-20">
                            <button
                              onClick={() => onAddRowAbove(startIndex + idx)}
                              className="text-green-500 hover:text-green-700"
                              title="Add row above"
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              onClick={() => onMoveRow(startIndex + idx, -1)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => onMoveRow(startIndex + idx, 1)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button
                              onClick={() => onRemoveRow(startIndex + idx)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button
                              onClick={() => onAddRowBelow(startIndex + idx)}
                              className="text-green-500 hover:text-green-700"
                              title="Add row below"
                            >
                              <Plus size={12} />
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
                      className={`p-3 border-r border-slate-100 last:border-r-0 ${
                        col.type === "number" || col.type === "formula"
                          ? "text-center font-medium"
                          : "text-left"
                      }`}
                    >
                      <Editable
                        value={cellValue}
                        numeric={col.type === "number"}
                        readOnly={isPreview || col.type === "formula"}
                        onSave={(val) =>
                          onUpdateCell(startIndex + idx, col.id, val)
                        }
                        className={
                          col.type === "formula" ? "text-slate-900 font-bold" : ""
                        }
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
          {(totalPrice.summaries || []).map((item) => (
            <TotalRow
              key={item.id}
              label={item.label}
              value={item.calculatedValue}
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
          <h4 className="text-[12px] font-bold text-slate-700 mb-2">
            Document Notes
          </h4>
          <div
            className="text-[12px] font-normal text-[#212121]"
            dangerouslySetInnerHTML={{ __html: data.footer.notes }}
          />
        </div>
      )}

      {isLastPage &&
        data.footer.emphasis &&
        Array.isArray(data.footer.emphasis) &&
        data.footer.emphasis.length > 0 && (
          <div
            className="mt-4 bg-[#ededed] px-8 py-4 rounded-sm flex flex-col gap-1"
            style={{ maxWidth: "100%" }}
          >
            {data.footer.emphasis.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <span className="uppercase text-[10px] tracking-widest text-[#7a7672] font-bold">
                  {item.key}:
                </span>
                <span className="text-[15px] font-bold tracking-wide text-[#4b403a]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

      {/* Footer Branding */}
      <div className="absolute bottom-10 left-0 w-full text-center px-20">
        <div className="border-t border-slate-100 pt-6 flex justify-between items-center text-[9px] text-slate-300 uppercase font-bold tracking-widest opacity-60 font-lexend">
          <span>Maintenance Proposal 2026</span>
          <span>Page {pageIndex + 1}</span>
          <span>Quality Works Guaranteed</span>
        </div>
      </div>
    </div>
  );
};

const TotalRow = ({ label, value }) => {
  const isSubTotal = label === "Sub Total";
  return (
    <div
      className={`flex justify-between items-center p-4 text-[12px] font-normal border-b border-slate-50 font-lexend ${isSubTotal ? "bg-slate-100" : "bg-white"}`}
    >
      <span className="text-slate-400 uppercase text-[9px] tracking-[0.2em]">
        {label}
      </span>
      <span className={`text-[#212121] ${isSubTotal ? "font-semibold" : ""}`}>
        {Math.round(value).toLocaleString()}
      </span>
    </div>
  );
};

export default App;
