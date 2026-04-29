import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSyncedStore } from "@syncedstore/react";
import {
  ArrowLeft,
  Plus,
  Boxes,
  Sparkles,
  Trash2,
  Edit2,
  Check,
  X,
  Info as AlertCircle,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { uiStore } from "../store";

// ── Color tokens ─────────────────────────────────────────────────────────
// Maps the user-friendly color names stored on a category to the tailwind
// classes used to render its swatch + pill. Anything unknown falls back
// to slate so we never render invisible.

const COLOR_PRESETS: Array<{ id: string; label: string; bg: string; ring: string }> = [
  { id: "blue", label: "Blue", bg: "bg-blue-500", ring: "ring-blue-500/30" },
  { id: "amber", label: "Amber", bg: "bg-amber-500", ring: "ring-amber-500/30" },
  { id: "red", label: "Red", bg: "bg-red-500", ring: "ring-red-500/30" },
  { id: "emerald", label: "Emerald", bg: "bg-emerald-500", ring: "ring-emerald-500/30" },
  { id: "violet", label: "Violet", bg: "bg-violet-500", ring: "ring-violet-500/30" },
  { id: "sky", label: "Sky", bg: "bg-sky-500", ring: "ring-sky-500/30" },
  { id: "rose", label: "Rose", bg: "bg-rose-500", ring: "ring-rose-500/30" },
  { id: "slate", label: "Slate", bg: "bg-slate-500", ring: "ring-slate-500/30" },
];

const colorFor = (key?: string | null) =>
  COLOR_PRESETS.find((c) => c.id === key) ||
  { id: "slate", label: "Slate", bg: "bg-slate-500", ring: "ring-slate-500/30" };

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { businessId, user } = useAuth();
  const queryClient = useQueryClient();
  const ui = useSyncedStore(uiStore);
  const search = ui.settings.searchQuery || "";

  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["inventory-categories", businessId],
    queryFn: () => api.listInventoryCategories(businessId!),
    enabled: !!businessId && !!user,
  });

  const seedMutation = useMutation({
    mutationFn: () => api.seedDefaultCategories(businessId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories", businessId] });
    },
    onError: (e: any) => alert(e?.message || "Failed to seed categories"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInventoryCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-categories", businessId] });
    },
    onError: (e: any) => alert(e?.message || "Failed to delete"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return (categories as any[]).filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q),
    );
  }, [categories, search]);

  if (!businessId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <AlertCircle size={32} className="text-current" />
        <p className="text-[11px] font-bold uppercase tracking-widest mt-3">
          No active business
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      {/* Sub-header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/30 px-8 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft size={18} className="text-current" />
          </button>
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground">
              Inventory
            </h1>
            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
              {categories.length} categor
              {categories.length === 1 ? "y" : "ies"} · Resource
              vocabulary for the whole business
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {categories.length === 0 && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
              title="Seed the canonical defaults: Materials, Labour, Fuel, Equipment…"
            >
              <Sparkles size={14} className="text-current" />
              {seedMutation.isPending ? "Seeding…" : "Seed Defaults"}
            </button>
          )}
          <button
            onClick={() => {
              setEditing(null);
              setComposeOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={14} className="text-current" />
            New Category
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {isLoading ? (
          <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 py-12">
            Loading…
          </div>
        ) : categories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-90 py-20 max-w-md mx-auto">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
              <Boxes size={32} className="text-current" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest mb-2">
              No categories yet
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground/80 leading-relaxed mb-6">
              Categories tag every spend in the Accounting log — Materials, Labour, Fuel, etc. Start with our defaults or build your own.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                <Sparkles size={14} className="text-current" />
                {seedMutation.isPending ? "Seeding…" : "Seed Defaults"}
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setComposeOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Plus size={14} className="text-current" />
                New Category
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-6xl mx-auto">
            {(filtered as any[]).map((c) => {
              const color = colorFor(c.color);
              return (
                <div
                  key={c.id}
                  className="group flex flex-col gap-3 p-4 bg-card border border-border/60 hover:border-primary/30 rounded-2xl transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-2 ring-inset",
                        color.bg,
                        color.ring,
                      )}
                    >
                      <Boxes size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black truncate">{c.name}</h3>
                      {c.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed mt-0.5">
                          {c.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-auto border-t border-border/40">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      {color.label}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditing(c);
                          setComposeOpen(true);
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={11} className="text-current" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete category "${c.name}"?`)) {
                            deleteMutation.mutate(c.id);
                          }
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={11} className="text-current" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {composeOpen && (
        <CategoryComposeModal
          businessId={businessId}
          editing={editing}
          onClose={() => {
            setComposeOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["inventory-categories", businessId] });
            setComposeOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

// ── Compose / Edit modal ─────────────────────────────────────────────────

const CategoryComposeModal: React.FC<{
  businessId: string;
  editing: any | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ businessId, editing, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [color, setColor] = useState<string>(editing?.color || "blue");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.updateInventoryCategory(editing.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
        });
      } else {
        await api.createInventoryCategory({
          businessId,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-black uppercase tracking-widest">
            {editing ? `Edit "${editing.name}"` : "New Category"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            title="Close"
          >
            <X size={16} className="text-current" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Materials, Labour, Fuel"
              className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What kinds of resources go here"
              className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background resize-y"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setColor(p.id)}
                  title={p.label}
                  className={cn(
                    "w-7 h-7 rounded-lg transition-all",
                    p.bg,
                    color === p.id
                      ? `ring-2 ring-offset-2 ring-offset-card ${p.ring} scale-110`
                      : "opacity-70 hover:opacity-100",
                  )}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="text-[11px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/10">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-60 transition-all"
          >
            <Check size={12} className="text-current" />
            {saving ? "Saving…" : editing ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
