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
  Search,
  Calculator,
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

  // Items pane state
  const [itemComposeOpen, setItemComposeOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["inventory-categories", businessId],
    queryFn: () => api.listInventoryCategories(businessId!),
    enabled: !!businessId && !!user,
  });

  // Items for the currently-selected category. Falls back to "all items in
  // the business" when no category is selected (the catch-all view).
  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["inventory-items", businessId, selectedCategoryId || "all"],
    queryFn: () =>
      api.listInventoryItems(
        businessId!,
        selectedCategoryId ? { categoryId: selectedCategoryId } : undefined,
      ),
    enabled: !!businessId && !!user,
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.deleteInventoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items", businessId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-categories", businessId] });
    },
    onError: (e: any) => alert(e?.message || "Failed to delete item"),
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

  // Items search — same query box as categories. Matches name, sku, and
  // description so crew typing "cement" or "DC-001" both find the row.
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return (items as any[]).filter(
      (i) =>
        (i.name || "").toLowerCase().includes(q) ||
        (i.sku || "").toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const selectedCategory = useMemo(
    () => (categories as any[]).find((c) => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId],
  );

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
              {categories.length} categor{categories.length === 1 ? "y" : "ies"}
              {(items as any[]).length > 0 && ` · ${(items as any[]).length} item${(items as any[]).length === 1 ? "" : "s"}`}
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
            className="flex items-center gap-2 px-4 py-2 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Plus size={14} className="text-current" />
            New Category
          </button>
          {categories.length > 0 && (
            <button
              onClick={() => {
                setEditingItem(null);
                setItemComposeOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={14} className="text-current" />
              New Item
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Loading…
        </div>
      ) : categories.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-90 py-20 px-8 max-w-md mx-auto">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
            <Boxes size={32} className="text-current" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest mb-2">
            No categories yet
          </h3>
          <p className="text-[11px] font-medium text-muted-foreground/80 leading-relaxed mb-6">
            Items live inside categories. Start by seeding the canonical defaults (Materials, Labour, Fuel…) or build your own.
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
        // Two-column workspace: categories on the left, items on the right.
        // The categories rail is fixed-width and scrolls independently; the
        // items pane fills the rest.
        <div className="flex-1 grid grid-cols-[280px_1fr] divide-x divide-border min-h-0">
          {/* Categories rail */}
          <aside className="flex flex-col min-h-0 bg-muted/10">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Categories
              </h3>
              <span className="text-[9px] font-mono font-bold text-muted-foreground/70 tabular-nums">
                {categories.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {/* "All items" pseudo-row */}
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  "w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all border",
                  !selectedCategoryId
                    ? "bg-primary/10 border-primary/30 shadow-sm"
                    : "bg-card border-transparent hover:bg-muted/40",
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-foreground/10 flex items-center justify-center shrink-0">
                  <Boxes size={13} className="text-foreground/70 text-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black truncate">All Items</div>
                  <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Everything across categories
                  </div>
                </div>
              </button>

              {(filtered as any[]).map((c) => {
                const color = colorFor(c.color);
                const isSelected = selectedCategoryId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={cn(
                      "group w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all border",
                      isSelected
                        ? "bg-primary/10 border-primary/30 shadow-sm"
                        : "bg-card border-transparent hover:bg-muted/40",
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        color.bg,
                      )}
                    >
                      <Boxes size={13} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black truncate">{c.name}</div>
                      {c.description && (
                        <div className="text-[9px] text-muted-foreground/70 truncate">
                          {c.description}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-mono font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded",
                        isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.itemCount ?? 0}
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(c);
                          setComposeOpen(true);
                        }}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
                        title="Edit category"
                      >
                        <Edit2 size={10} className="text-current" />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          const itemCount = c.itemCount ?? 0;
                          const msg = itemCount > 0
                            ? `Delete "${c.name}" and its ${itemCount} item${itemCount === 1 ? "" : "s"}? This cannot be undone.`
                            : `Delete "${c.name}"?`;
                          if (confirm(msg)) {
                            deleteMutation.mutate(c.id);
                            if (selectedCategoryId === c.id) setSelectedCategoryId(null);
                          }
                        }}
                        className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="Delete category"
                      >
                        <Trash2 size={10} className="text-current" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Items pane */}
          <section className="flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-1.5">
                  <Boxes size={11} className="text-current" />
                  {selectedCategory ? selectedCategory.name : "All Items"}
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground/70 truncate">
                  {selectedCategory
                    ? selectedCategory.description ||
                      `Items inside ${selectedCategory.name}`
                    : "Everything in this business"}
                </p>
              </div>
              <span className="text-[9px] font-mono font-bold text-muted-foreground/70 tabular-nums shrink-0">
                {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {loadingItems ? (
                <div className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 py-12">
                  Loading items…
                </div>
              ) : (items as any[]).length === 0 ? (
                <div className="border border-dashed border-border rounded-xl px-6 py-12 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Boxes size={20} className="text-muted-foreground/60 text-current" />
                  </div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground mb-1">
                    No items yet
                  </h4>
                  <p className="text-[10px] font-medium text-muted-foreground/70 leading-relaxed mb-4 max-w-sm mx-auto">
                    Items are the granular things crews request — "Dangote Cement", "1.5mm cable", "Chandelier".
                    {selectedCategory
                      ? ` Add the first one to ${selectedCategory.name}.`
                      : " Pick a category on the left, then add items to it."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setItemComposeOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm hover:opacity-90 transition-all"
                  >
                    <Plus size={11} className="text-current" /> New Item
                  </button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 py-12 italic">
                  No items match your search
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(filteredItems as any[]).map((item) => {
                    const cat = (categories as any[]).find((c) => c.id === item.categoryId);
                    const color = colorFor(cat?.color);
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center gap-3 p-3 bg-card border border-border/60 hover:border-primary/30 hover:bg-primary/5 rounded-lg transition-all"
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                            color.bg,
                          )}
                          title={cat?.name}
                        >
                          <Boxes size={14} className="text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-[12px] font-black truncate">{item.name}</h4>
                            {item.sku && (
                              <span className="text-[9px] font-mono font-bold text-muted-foreground/70 px-1.5 py-0.5 bg-muted/40 rounded shrink-0">
                                {item.sku}
                              </span>
                            )}
                            {!selectedCategoryId && cat && (
                              <span
                                className={cn(
                                  "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0",
                                  color.bg,
                                  "text-white",
                                )}
                              >
                                {cat.name}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[10px] text-muted-foreground/80 line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">
                              Unit
                            </div>
                            <div className="text-[11px] font-bold">{item.unit}</div>
                          </div>
                          {item.defaultCost != null && (
                            <div className="text-right">
                              <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 inline-flex items-center gap-1">
                                <Calculator size={9} className="text-current" /> Default
                              </div>
                              <div className="text-[11px] font-bold tabular-nums">
                                ₦{Math.round(item.defaultCost).toLocaleString()}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setItemComposeOpen(true);
                              }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Edit item"
                            >
                              <Edit2 size={11} className="text-current" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete item "${item.name}"?`)) {
                                  deleteItemMutation.mutate(item.id);
                                }
                              }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete item"
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
          </section>
        </div>
      )}

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

      {itemComposeOpen && (
        <ItemComposeModal
          businessId={businessId}
          categories={categories as any[]}
          editing={editingItem}
          /** Pre-select the currently-viewed category so creating from the
              rail just-works without the user re-picking it. */
          defaultCategoryId={selectedCategoryId}
          onClose={() => {
            setItemComposeOpen(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["inventory-items", businessId] });
            queryClient.invalidateQueries({ queryKey: ["inventory-categories", businessId] });
            setItemComposeOpen(false);
            setEditingItem(null);
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

// ── Item compose / edit modal ────────────────────────────────────────────
//
// Standard datalist-backed unit picker with construction-friendly
// suggestions (bag, m, m², ton…). Free-text — users can type anything.

const COMMON_UNITS = [
  "piece", "pcs", "bag", "ton", "m", "m²", "m³",
  "litre", "ml", "kg", "g", "bucket", "box", "carton", "roll", "set",
];

const ItemComposeModal: React.FC<{
  businessId: string;
  categories: Array<{ id: string; name: string; color: string | null }>;
  editing: any | null;
  defaultCategoryId: string | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ businessId, categories, editing, defaultCategoryId, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name || "");
  const [sku, setSku] = useState(editing?.sku || "");
  const [unit, setUnit] = useState(editing?.unit || "piece");
  const [categoryId, setCategoryId] = useState<string>(
    editing?.categoryId || defaultCategoryId || categories[0]?.id || "",
  );
  // defaultCost is stored in kobo on the backend; UI works in naira.
  const [defaultCost, setDefaultCost] = useState<string>(
    editing?.defaultCost != null ? String(editing.defaultCost) : "",
  );
  const [description, setDescription] = useState(editing?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!categoryId) {
      setError("Pick a category");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const cost = defaultCost.trim() === "" ? undefined : Number(defaultCost);
      if (defaultCost.trim() !== "" && (!Number.isFinite(cost) || cost! < 0)) {
        throw new Error("Default cost must be a non-negative number");
      }
      const payload: any = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        unit: unit.trim() || "piece",
        categoryId,
        defaultCost: cost,
        description: description.trim() || undefined,
      };
      if (editing) {
        await api.updateInventoryItem(editing.id, payload);
      } else {
        await api.createInventoryItem({ businessId, ...payload });
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
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-black uppercase tracking-widest">
            {editing ? `Edit "${editing.name}"` : "New Item"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            title="Close"
          >
            <X size={16} className="text-current" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dangote Cement, 1.5mm cable, Chandelier"
              className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Category <span className="text-destructive">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Unit
              </label>
              <input
                list="inv-unit-suggestions"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="bag, m, ton…"
                className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
              />
              <datalist id="inv-unit-suggestions">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                SKU
              </label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Optional code"
                className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Default cost (₦ per unit)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={defaultCost}
              onChange={(e) => setDefaultCost(e.target.value)}
              placeholder="Optional — used as a hint when typing fresh"
              className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background"
            />
            <p className="text-[10px] text-muted-foreground/70 font-medium leading-relaxed">
              Specific invoices and receipts can charge a different amount —
              this is just the catalog default.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes — supplier, alternative names, sizing"
              className="w-full px-3 py-2 bg-muted/40 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border focus:bg-background resize-y"
            />
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
