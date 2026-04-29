import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Search,
  Boxes,
  Plus,
  Check,
  Trash2,
  Filter,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

// ── Types ────────────────────────────────────────────────────────────────

export interface InventoryPick {
  item: {
    id: string;
    name: string;
    unit: string;
    defaultCost: number | null;
    categoryId: string;
  };
  quantity: number;
}

interface InventoryRowInsertModalProps {
  open: boolean;
  businessId: string;
  onClose: () => void;
  /**
   * Called once when the user clicks "Insert" with the full list of picks.
   * Each pick is an inventory item + a quantity. Caller turns these into
   * invoice rows using whatever column heuristic the template needs.
   */
  onInsert: (picks: InventoryPick[]) => void;
}

const COLOR_TINT: Record<string, string> = {
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

const fmtNaira = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    const decimals = Math.abs(v) >= 100 ? 0 : 1;
    return `₦${v.toFixed(decimals).replace(/\.0$/, "")}k`;
  }
  return `₦${Math.round(n).toLocaleString()}`;
};

// ── Modal ────────────────────────────────────────────────────────────────

export const InventoryRowInsertModal: React.FC<InventoryRowInsertModalProps> = ({
  open,
  businessId,
  onClose,
  onInsert,
}) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [picks, setPicks] = useState<InventoryPick[]>([]);

  // Reset on open so the user starts clean each time. Closing without
  // inserting drops everything — by design (avoids "did I leave that
  // pick from yesterday?" confusion).
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setCategoryFilter(null);
    setPicks([]);
  }, [open]);

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories", businessId],
    queryFn: () => api.listInventoryCategories(businessId),
    enabled: open && !!businessId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["inventory-items", businessId, "all"],
    queryFn: () => api.listInventoryItems(businessId),
    enabled: open && !!businessId,
  });

  const categoryById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of categories as any[]) m.set(c.id, c);
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items as any[]).filter((i) => {
      if (categoryFilter && i.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (
        (i.name || "").toLowerCase().includes(q) ||
        (i.sku || "").toLowerCase().includes(q) ||
        (i.description || "").toLowerCase().includes(q)
      );
    });
  }, [items, search, categoryFilter]);

  const totalPicked = picks.reduce((acc, p) => acc + p.quantity, 0);
  const totalCost = picks.reduce(
    (acc, p) => acc + (p.item.defaultCost || 0) * p.quantity,
    0,
  );

  const addPick = (item: any) => {
    setPicks((arr) => {
      const existing = arr.find((p) => p.item.id === item.id);
      if (existing) {
        return arr.map((p) =>
          p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }
      return [
        ...arr,
        {
          item: {
            id: item.id,
            name: item.name,
            unit: item.unit,
            defaultCost: item.defaultCost,
            categoryId: item.categoryId,
          },
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (id: string, q: number) => {
    if (!Number.isFinite(q) || q <= 0) return;
    setPicks((arr) => arr.map((p) => (p.item.id === id ? { ...p, quantity: q } : p)));
  };

  const removePick = (id: string) => {
    setPicks((arr) => arr.filter((p) => p.item.id !== id));
  };

  const handleInsert = () => {
    if (picks.length === 0) return;
    onInsert(picks);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[210] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Insert from Inventory
                </h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  Pick items + quantities. Each becomes a new invoice line.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                title="Close"
              >
                <X size={16} className="text-current" />
              </button>
            </div>

            {/* Search + category filter */}
            <div className="px-5 py-3 border-b border-border shrink-0 space-y-2">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-current pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search inventory by name, SKU, or description…"
                  className="w-full pl-8 pr-3 py-2 bg-muted/40 border border-transparent rounded-lg text-[12px] font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-border focus:bg-background transition-all"
                />
              </div>

              {(categories as any[]).length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <Filter size={11} className="text-muted-foreground/60 text-current shrink-0" />
                  <CategoryChip
                    active={!categoryFilter}
                    onClick={() => setCategoryFilter(null)}
                    label="All"
                    color={null}
                  />
                  {(categories as any[]).map((c) => (
                    <CategoryChip
                      key={c.id}
                      active={categoryFilter === c.id}
                      onClick={() => setCategoryFilter(c.id)}
                      label={c.name}
                      color={c.color}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {(items as any[]).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/60 px-6 py-12">
                  <Boxes size={28} className="text-current opacity-40 mb-3" />
                  <p className="text-[11px] font-bold uppercase tracking-widest">
                    No inventory yet
                  </p>
                  <p className="text-[10px] font-medium mt-1 max-w-sm">
                    Build your catalog at{" "}
                    <a href="/inventory" className="text-primary underline font-black">
                      /inventory
                    </a>{" "}
                    to pick items here.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 italic">
                  No items match
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filtered.map((item: any) => {
                    const cat = categoryById.get(item.categoryId);
                    const tint = cat?.color ? COLOR_TINT[cat.color] : COLOR_TINT.slate;
                    const picked = picks.find((p) => p.item.id === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addPick(item)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 bg-muted/20 hover:bg-muted/40 border rounded-lg transition-all text-left",
                          picked
                            ? "border-primary/40"
                            : "border-border/50 hover:border-primary/30",
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                            tint,
                          )}
                        >
                          <Boxes size={13} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-black truncate">
                              {item.name}
                            </span>
                            {item.sku && (
                              <span className="text-[9px] font-mono font-bold text-muted-foreground/70 px-1.5 py-0.5 bg-muted/60 rounded shrink-0">
                                {item.sku}
                              </span>
                            )}
                            {cat && (
                              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                {cat.name}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                            {item.unit}
                            {item.defaultCost != null && ` · ${fmtNaira(item.defaultCost)}`}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                            picked
                              ? "bg-primary/10 text-primary"
                              : "bg-foreground text-background",
                          )}
                        >
                          {picked ? (
                            <>
                              <Check size={10} className="text-current" /> Added · ×{picked.quantity}
                            </>
                          ) : (
                            <>
                              <Plus size={10} className="text-current" /> Add
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Picks tray + footer */}
            {picks.length > 0 && (
              <div className="border-t border-border bg-muted/10 shrink-0 max-h-[35%] flex flex-col">
                <div className="px-5 py-2.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">
                  <span>To insert ({picks.length})</span>
                  <span className="font-mono tabular-nums">
                    {totalPicked} unit{totalPicked === 1 ? "" : "s"}
                    {totalCost > 0 && ` · ~${fmtNaira(totalCost)}`}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                  {picks.map((p) => (
                    <div
                      key={p.item.id}
                      className="flex items-center gap-2 px-2 py-1.5 bg-card rounded-md border border-border/50"
                    >
                      <span className="text-[11px] font-black truncate flex-1">{p.item.name}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={p.quantity}
                        onChange={(e) => updateQuantity(p.item.id, Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-muted/40 border border-transparent rounded-md text-xs text-center tabular-nums focus:outline-none focus:border-border"
                      />
                      <span className="text-[10px] font-bold text-muted-foreground/70 w-10 text-left">
                        {p.item.unit}
                      </span>
                      <button
                        onClick={() => removePick(p.item.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={11} className="text-current" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border shrink-0">
              <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                Item names, units &amp; default costs auto-fill into the matching invoice columns.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsert}
                  disabled={picks.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  <Check size={11} className="text-current" />
                  Insert {picks.length > 0 ? `${picks.length} ` : ""}line{picks.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────

const CategoryChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  color: string | null;
}> = ({ active, onClick, label, color }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shrink-0",
      active
        ? "bg-foreground text-background border-foreground"
        : "bg-card text-muted-foreground hover:text-foreground border-border hover:border-foreground/30",
    )}
  >
    {color && (
      <span
        className={cn("w-1.5 h-1.5 rounded-full", COLOR_TINT[color] || COLOR_TINT.slate)}
      />
    )}
    {label}
  </button>
);
