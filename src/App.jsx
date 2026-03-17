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
  // --- State ---
  const [letterContext, setLetterContext] = useState(`contact :
OLUWAKEMI ISINKAYE 
Prime Waters Garden II
Lekki Phase 1

Ttitle :
PROPOSED For Maintenance of A 5 bedroom apartment at Prime Waters Garden II
Lekki Phase 1.

content:
- Master Bedroom Closet Maintenance 260,000
- Glass Works (Change of Glass) 335,000
- Plumbing maintenance 165,000
- Bedframe Joinery Maintenance 110,000
- Tv Console Maintenance 200,000
- Door handles and Locks 78,000
- Switches & Socket 410,000
- Fix & Deep Wash Sofa 180,000
- Launder Rugs 50,000
- Kitchen Joinery & Other Kitchen Maintenance Works 270,000
- Arts in Rooms 200,000
- Dining Rug 200,000
- Apartment Deep Cleaning 100,000`);

  const [headerImage, setHeaderImage] = useState("/shan-letterhead.png");
  const [columns, setColumns] = useState({
    views: true,
    unitPrice: true,
    total: true,
  });

  const [headerHeight, setHeaderHeight] = useState(128);

  const [invoiceNotes, setInvoiceNotes] = useState(
    `<p>This invoice relates to the approved design stage services, as outlined in our executed proposal and based on the scope discussed during our engagement. Once payment is received and confirmed, we will be delighted to proceed with this phase of the project and begin translating the agreed concepts into detailed design outputs.</p><p>We kindly ask that you review the invoice details at your convenience. Should you have any questions, require clarification, or notice any discrepancies, please let us know in writing within forty-eight (48) hours, and we will be happy to address them promptly. In the absence of any feedback within this period, the invoice will be deemed accepted as issued.</p><p>Please note that this invoice remains valid for seven (7) days from the date of issue. Upon commencement of the design stage, all payments made are non-refundable, irrespective of any subsequent project changes, scope adjustments, or project termination.</p><p>Our goal is to ensure a smooth, transparent, and enjoyable design process for you. If you need any further information or would like to discuss the next steps, please feel free to contact us at <a href="mailto:hello@shaninteriordesign.com">hello@shaninteriordesign.com</a> we are always happy to assist.</p><p>We truly appreciate your trust in Shan Interiors Limited and look forward to creating a space you will love.</p><p>For further information or clarification, contact us at <a href="mailto:hello@shaninteriordesign.com">hello@shaninteriordesign.com</a></p>`,
  );

  // Example editable key-value pairs for emphasis section
  const [emphasisText, setEmphasisText] = useState([
    { key: "Account Name", value: "SHAN INTERIORS LIMITED" },
    { key: "Account Number", value: "1615822982" },
    { key: "Bank", value: "ACCESS BANK" },
  ]);

  const [hoveredIndex, setHoveredIndex] = useState(null);

  const [isPreview, setIsPreview] = useState(false);


  const editor = useEditor({
    extensions: [StarterKit],
    content: invoiceNotes,
    onUpdate: ({ editor }) => {
      setInvoiceNotes(editor.getHTML());
    },
  });

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

  const [parsedData, setParsedData] = useState(() =>
    parseLetterContext(letterContext),
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preview = urlParams.get("preview");
    const data = urlParams.get("data");
    const pass = urlParams.get("pass");
    if (preview === "true" && data && pass) {
      const enteredPass = prompt("Enter password to view preview:");
      if (enteredPass === pass) {
        setParsedData(JSON.parse(atob(data)));
        setIsPreview(true);
      } else {
        alert("Incorrect password");
      }
    }
  }, []);

  const handleSyncFromContext = () => {
    setParsedData(parseLetterContext(letterContext));
  };

  const updateContactField = (field, value) => {
    setParsedData((prev) => ({
      ...prev,
      contact: { ...prev.contact, [field]: value },
    }));
  };

  const updateTitle = (value) => {
    setParsedData((prev) => ({ ...prev, title: value }));
  };

  const updateItem = (id, field, value) => {
    setParsedData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const removeItem = (id) => {
    setParsedData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const moveItemUp = (index) => {
    setParsedData((prev) => {
      const updated = [...prev.items];
      if (index > 0) {
        [updated[index - 1], updated[index]] = [
          updated[index],
          updated[index - 1],
        ];
      }
      return { ...prev, items: updated };
    });
  };

  const moveItemDown = (index) => {
    setParsedData((prev) => {
      const updated = [...prev.items];
      if (index < updated.length - 1) {
        [updated[index], updated[index + 1]] = [
          updated[index + 1],
          updated[index],
        ];
      }
      return { ...prev, items: updated };
    });
  };

  const addItemAbove = (index) => {
    setParsedData((prev) => {
      const updated = [...prev.items];
      updated.splice(index, 0, {
        id: Math.random().toString(36).substr(2, 9),
        desc: "",
        price: 0,
        qty: 1,
      });
      return { ...prev, items: updated };
    });
  };

  const addItemBelow = (index) => {
    setParsedData((prev) => {
      const updated = [...prev.items];
      updated.splice(index + 1, 0, {
        id: Math.random().toString(36).substr(2, 9),
        desc: "",
        price: 0,
        qty: 1,
      });
      return { ...prev, items: updated };
    });
  };

  const updateKey = (index, newKey) => {
    const newEmphasis = [...emphasisText];
    newEmphasis[index].key = newKey;
    setEmphasisText(newEmphasis);
  };

  const updateValue = (index, newValue) => {
    const newEmphasis = [...emphasisText];
    newEmphasis[index].value = newValue;
    setEmphasisText(newEmphasis);
  };

  const addRowAbove = (index) => {
    const newEmphasis = [...emphasisText];
    newEmphasis.splice(index, 0, { key: "New Key", value: "New Value" });
    setEmphasisText(newEmphasis);
  };

  const addRowBelow = (index) => {
    const newEmphasis = [...emphasisText];
    newEmphasis.splice(index + 1, 0, { key: "New Key", value: "New Value" });
    setEmphasisText(newEmphasis);
  };

  const removeRow = (index) => {
    if (emphasisText.length > 1) {
      const newEmphasis = emphasisText.filter((_, i) => i !== index);
      setEmphasisText(newEmphasis);
    }
  };

  const toggleColumn = (col) => {
    setColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  const handlePrint = () => window.print();

  const handleDownload = () => window.print(); // For now, same as print

  const generatePreviewLink = () => {
    const pass = prompt("Set a password for the preview:");
    if (pass) {
      const data = btoa(JSON.stringify(parsedData));
      const url = `${window.location.origin}${window.location.pathname}?preview=true&data=${data}&pass=${pass}`;
      navigator.clipboard.writeText(url);
      alert("Preview link copied to clipboard!");
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

  const subTotal = (parsedData.items || []).reduce(
    (acc, item) => acc + Number(item.price) * (Number(item.qty) || 0),
    0,
  );
  const logistics = subTotal > 0 ? 300000 : 0;
  const vatRate = 0.075;
  const vat = (subTotal + logistics) * vatRate;
  const grandTotal = subTotal + logistics + vat;

  // Reduced limits to ensure they actually fit on A4 pages without spilling out of the container
  const firstPageLimit = 10;
  const otherPagesLimit = 18;
  const chunks = [];
  const safeItems = parsedData.items || [];

  if (safeItems.length > 0) {
    chunks.push(safeItems.slice(0, firstPageLimit));
    for (let i = firstPageLimit; i < safeItems.length; i += otherPagesLimit) {
      chunks.push(safeItems.slice(i, i + otherPagesLimit));
    }
  } else {
    chunks.push([]);
  }

  return (
    <div className="flex flex-col h-screen bg-[#FDFCFB] text-slate-900 overflow-hidden font-sans no-print">
      <div className="flex flex-1 overflow-hidden">
        {!isPreview && (
          <div className="w-full lg:w-[420px] flex flex-col border-r border-slate-200/60 bg-white p-8 overflow-y-auto scrollbar-thin">
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
                    Letter Context
                  </label>
                  <button
                    onClick={handleSyncFromContext}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold font-lexend transition-all border border-slate-200/60"
                  >
                    <RefreshCw size={12} /> SYNC
                  </button>
                </div>
                <textarea
                  className="w-full h-48 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-[11px] font-mono focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none resize-none scrollbar-thin text-slate-700 transition-all shadow-sm"
                  value={letterContext}
                  onChange={(e) => setLetterContext(e.target.value)}
                  placeholder="Paste content..."
                />
              </section>

              <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 space-y-4">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] font-lexend mb-2 flex items-center gap-2">
                  <Settings2 size={14} /> Columns
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <ToggleButton
                    active={columns.views}
                    onClick={() => toggleColumn("views")}
                    label="Views"
                    icon={<Layout size={12} />}
                  />
                  <ToggleButton
                    active={columns.unitPrice}
                    onClick={() => toggleColumn("unitPrice")}
                    label="Prices"
                    icon={<TableIcon size={12} />}
                  />
                  <ToggleButton
                    active={columns.total}
                    onClick={() => toggleColumn("total")}
                    label="Totals"
                    icon={<Check size={12} />}
                  />
                </div>
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
                  Invoice Notes
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
                  Emphasis Key-Value Pairs
                </label>
                <div className="flex flex-col gap-3 relative">
                  {emphasisText.map((item, idx) => (
                    <div key={idx} className="relative group/row">
                      {hoveredIndex === idx && (
                        <button
                          className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-slate-800 z-10 shadow-lg border-2 border-white"
                          onClick={() => addRowAbove(idx)}
                          title="Add row above"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <div
                        className="flex gap-3 items-center p-3 border border-slate-200/60 rounded-xl bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <input
                          className="w-32 bg-transparent border-b border-slate-200 text-[11px] font-lexend font-bold text-slate-500 hover:border-slate-400 focus:border-slate-900 outline-none transition-colors px-1"
                          value={item.key}
                          onChange={(e) => updateKey(idx, e.target.value)}
                          placeholder="Key"
                        />
                        <input
                          className="flex-1 bg-transparent border-b border-slate-200 text-[11px] font-lexend text-slate-700 hover:border-slate-400 focus:border-slate-900 outline-none transition-colors px-1"
                          value={item.value}
                          onChange={(e) => updateValue(idx, e.target.value)}
                          placeholder="Value"
                        />
                        <button
                          onClick={() => removeRow(idx)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {hoveredIndex === idx && (
                        <button
                          className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-slate-800 z-10 shadow-lg border-2 border-white"
                          onClick={() => addRowBelow(idx)}
                          title="Add row below"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Preview Area */}
        <div
          className={`${isPreview ? "w-full" : "flex-1"} overflow-y-auto bg-[#F8F9FA] p-6 lg:p-16 flex flex-col items-center scrollbar-thin`}
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
              data={parsedData}
              items={itemChunk}
              pageIndex={pageIndex}
              totalPrice={
                pageIndex === chunks.length - 1
                  ? { subTotal, logistics, vat, grandTotal }
                  : null
              }
              headerImage={headerImage}
              headerHeight={headerHeight}
              onHeaderResize={handleHeaderResize}
              invoiceNotes={invoiceNotes}
              emphasisText={emphasisText}
              columns={columns}
              isFirstPage={pageIndex === 0}
              isLastPage={pageIndex === chunks.length - 1}
              startIndex={
                pageIndex === 0
                  ? 0
                  : firstPageLimit + (pageIndex - 1) * otherPagesLimit
              }
              onUpdateContact={updateContactField}
              onUpdateTitle={updateTitle}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
              onMoveItemUp={moveItemUp}
              onMoveItemDown={moveItemDown}
              onAddItemAbove={addItemAbove}
              onAddItemBelow={addItemBelow}
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
          body { margin: 0; padding: 0; background: white !important; }
          .no-print { display: none !important; }
          .a4-page { 
            box-shadow: none !important; 
            margin: 0 auto !important; 
            border: none !important; 
            page-break-after: always !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
  items,
  pageIndex,
  totalPrice,
  headerImage,
  headerHeight,
  onHeaderResize,
  invoiceNotes,
  emphasisText,
  columns,
  isFirstPage,
  isLastPage,
  startIndex,
  onUpdateContact,
  onUpdateTitle,
  onUpdateItem,
  onRemoveItem,
  onMoveItemUp,
  onMoveItemDown,
  onAddItemAbove,
  onAddItemBelow,
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

      {/* Maintenance Table */}
      <div className="overflow-hidden border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="text-white text-[11px] font-normal uppercase tracking-[0.2em] font-luzia"
              style={{ backgroundColor: HEADER_DARK_BROWN }}
            >
              <th className="p-4 text-center w-14 border-r border-white/10 font-normal">
                S/N
              </th>
              <th className="p-4 text-left border-r border-white/10 font-normal">
                Description of Service
              </th>
              {columns.views && (
                <th className="p-4 text-center w-20 border-r border-white/10 font-normal">
                  Views
                </th>
              )}
              {columns.unitPrice && (
                <th className="p-4 text-center w-36 border-r border-white/10 font-normal">
                  Unit Price
                </th>
              )}
              {columns.total && (
                <th className="p-4 text-center w-36 font-normal">Total</th>
              )}
            </tr>
          </thead>
          <tbody>
            {(items || []).map((item, idx) => {
              const rowTotal =
                (Number(item.price) || 0) * (Number(item.qty) || 0);
              return (
                <tr
                  key={item.id}
                  className="text-[12px] text-[#212121] border-b border-slate-50 font-lexend"
                  style={{
                    backgroundColor: idx % 2 === 1 ? "#FBFBFB" : "#fff",
                  }}
                >
                  <td className="p-3 text-center border-r border-slate-100 relative group">
                    1.{startIndex + idx + 1}
                    {!isPreview && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 no-print transition-all">
                        <button
                          onClick={() => onAddItemAbove(startIndex + idx)}
                          className="text-green-500 hover:text-green-700"
                          title="Add row above"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => onMoveItemUp(startIndex + idx)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => onMoveItemDown(startIndex + idx)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                        <button
                          onClick={() => onAddItemBelow(startIndex + idx)}
                          className="text-green-500 hover:text-green-700"
                          title="Add row below"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="relative border-r border-slate-100 capitalize min-h-[40px]">
                    <Editable
                      value={item.desc}
                      onSave={(val) => onUpdateItem(item.id, "desc", val)}
                      containerPadding="px-3"
                      readOnly={isPreview}
                    />
                  </td>
                  {columns.views && (
                    <td className="relative border-r border-slate-100 min-h-[40px] text-center">
                      <Editable
                        numeric
                        value={item.qty}
                        onSave={(val) => onUpdateItem(item.id, "qty", val)}
                        className="text-center"
                        containerPadding="p-1"
                        readOnly={isPreview}
                      />
                    </td>
                  )}
                  {columns.unitPrice && (
                    <td className="relative border-r border-slate-100 min-h-[40px]">
                      <Editable
                        numeric
                        value={item.price}
                        onSave={(val) => onUpdateItem(item.id, "price", val)}
                        className="text-right pr-4"
                        containerPadding="p-1"
                        readOnly={isPreview}
                      />
                    </td>
                  )}
                  {columns.total && (
                    <td className="p-3 text-right pr-6">
                      {rowTotal > 0 ? rowTotal.toLocaleString() : "--"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isLastPage && totalPrice && (
        <div className="mt-8 border-t border-slate-100">
          <TotalRow label="Sub Total" value={totalPrice.subTotal} />
          <TotalRow
            label="Consultation & Logistics"
            value={totalPrice.logistics}
          />
          <TotalRow label="VAT (7.5%)" value={totalPrice.vat} />
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

      {isLastPage && invoiceNotes && (
        <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded">
          <h4 className="text-[12px] font-bold text-slate-700 mb-2">
            Invoice Notes
          </h4>
          <div
            className="text-[12px] font-normal text-[#212121]"
            dangerouslySetInnerHTML={{ __html: invoiceNotes }}
          />
        </div>
      )}

      {isLastPage &&
        emphasisText &&
        Array.isArray(emphasisText) &&
        emphasisText.length > 0 && (
          <div
            className="mt-4 bg-[#ededed] px-8 py-4 rounded-sm flex flex-col gap-1"
            style={{ maxWidth: "100%" }}
          >
            {emphasisText.map((item, idx) => (
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
