import React, { useState } from "react";
import { X, User, MapPin, Phone, Mail, FileText, Hash, ArrowRight, Building2 } from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { type TemplateDefinition } from "../lib/templates";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateInvoiceFormData {
  projectName: string;
  description: string;
  clientName: string;
  street: string;
  location: string;
  phone: string;
  email: string;
}

interface Props {
  template?: TemplateDefinition;
  onClose: () => void;
  onSubmit: (data: CreateInvoiceFormData) => void;
  isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const templateBadgeClass = (color?: string) => {
  switch (color) {
    case "blue":   return "bg-blue-100 text-blue-700";
    case "green":  return "bg-green-100 text-green-700";
    case "purple": return "bg-purple-100 text-purple-700";
    case "amber":  return "bg-amber-100 text-amber-700";
    case "rose":   return "bg-rose-100 text-rose-700";
    case "cyan":   return "bg-cyan-100 text-cyan-700";
    case "indigo": return "bg-indigo-100 text-indigo-700";
    default:       return "bg-slate-100 text-slate-600";
  }
};

// ─── Field sub-component ─────────────────────────────────────────────────────

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  hint?: string;
}

const Field: React.FC<FieldProps> = ({ icon, label, placeholder, value, onChange, required, type = "text", hint }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
      {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
        {icon}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className={cn(
          "w-full pl-9 pr-3 h-10 text-[12px] border border-border rounded-lg outline-none transition-all",
          "placeholder:text-slate-300 text-slate-700 font-medium",
          "focus:border-primary/60 focus:ring-2 focus:ring-primary/10 bg-white",
        )}
      />
    </div>
    {hint && <p className="text-[9px] text-slate-400 ml-1">{hint}</p>}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const CreateInvoiceModal: React.FC<Props> = ({ template, onClose, onSubmit, isLoading }) => {
  const previewNumber = api.peekNextInvoiceNumber();
  const isReceipt = template?.content?.isReceipt;

  const [form, setForm] = useState<CreateInvoiceFormData>({
    projectName: previewNumber,
    description: template?.content?.title || "",
    clientName: "",
    street: "",
    location: "",
    phone: "",
    email: "",
  });

  const set = (key: keyof CreateInvoiceFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim()) return;
    onSubmit(form);
  };

  const canSubmit = form.clientName.trim().length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden animate-in fade-in zoom-in duration-200 origin-center">

        {/* ── Header ── */}
        <div className="px-7 pt-7 pb-5 border-b border-border/60">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              {/* Number + template badge row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded font-lexend tracking-widest">
                  {previewNumber}
                </span>
                {template && !isReceipt && (
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-sm", templateBadgeClass(template.color))}>
                    {template.name}
                  </span>
                )}
                {isReceipt && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-700">
                    Receipt
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-800 leading-tight">
                  {isReceipt ? "New Receipt" : "New Invoice"}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Fill in the details below — you can edit everything later in the editor
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Form Body ── */}
        <form onSubmit={handleSubmit}>
          <div className="px-7 py-6 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin">

            {/* Invoice Details */}
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <FileText size={9} /> Invoice Details
              </p>
              <Field
                icon={<Hash size={12} />}
                label="Project / Invoice Name"
                placeholder={previewNumber}
                value={form.projectName}
                onChange={set("projectName")}
                hint="Defaults to invoice number — you can use a project name instead"
              />
              <Field
                icon={<FileText size={12} />}
                label="Description"
                placeholder={template?.content?.title || "e.g. Design Fee Invoice, Renovation Works"}
                value={form.description}
                onChange={set("description")}
              />
            </div>

            {/* Divider */}
            <div className="relative flex items-center gap-3 py-1">
              <div className="flex-1 border-t border-dashed border-slate-100" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Client</span>
              <div className="flex-1 border-t border-dashed border-slate-100" />
            </div>

            {/* Client Info */}
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <User size={9} /> Client Information
              </p>
              <Field
                icon={<User size={12} />}
                label="Client Name"
                placeholder="Full name or company name"
                value={form.clientName}
                onChange={set("clientName")}
                required
              />
              <Field
                icon={<MapPin size={12} />}
                label="Street / Address"
                placeholder="e.g. 12 Glover Road, Ikoyi"
                value={form.street}
                onChange={set("street")}
              />
              <Field
                icon={<Building2 size={12} />}
                label="City / Province"
                placeholder="e.g. Victoria Island, Lagos"
                value={form.location}
                onChange={set("location")}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  icon={<Phone size={12} />}
                  label="Phone"
                  placeholder="+234 800 000 0000"
                  value={form.phone}
                  onChange={set("phone")}
                  type="tel"
                />
                <Field
                  icon={<Mail size={12} />}
                  label="Email"
                  placeholder="client@email.com"
                  value={form.email}
                  onChange={set("email")}
                  type="email"
                />
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-7 pb-7 pt-4 border-t border-border/60 flex items-center justify-between">
            <p className="text-[10px] text-slate-400">
              Invoice number is auto-assigned and cannot be reused
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || isLoading}
                className={cn(
                  "px-5 py-2.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition-all",
                  canSubmit && !isLoading
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                {isLoading ? "Creating…" : (
                  <>Create Invoice <ArrowRight size={12} /></>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateInvoiceModal;
