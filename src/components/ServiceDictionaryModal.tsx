import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  X,
  Edit2,
  Check,
} from "../lib/icons/lucide";
import { cn } from "../lib/utils";
import {
  serviceDictionary,
  type ServiceDictionaryEntry,
} from "../lib/service-dictionary";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Full-screen modal for maintaining the Service Dictionary.
 *
 * UX:
 *   - "Add entry" card at top — three inputs (title, unit, price) + button.
 *     Title autofocuses when the modal opens so users can type immediately.
 *   - Search input filters the table by title as you type.
 *   - Table rows have inline edit (pencil icon) and delete (trash icon).
 *     Editing a row replaces the cells with inputs; Enter or ✓ saves,
 *     Esc or ✗ cancels.
 *   - Empty state shows BookOpen icon + "Your dictionary is empty" copy.
 *
 * Styling matches the TemplatePickerModal pattern:
 *   - fixed overlay with backdrop-blur
 *   - centered card, rounded-3xl, shadow-2xl
 *   - font-black uppercase tracking-widest labels
 *   - primary accent on the add button
 */
export const ServiceDictionaryModal: React.FC<Props> = ({
  isOpen,
  onClose,
}) => {
  const [entries, setEntries] = useState<ServiceDictionaryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // New-entry form state
  const [newTitle, setNewTitle] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Row-edit state — holds the draft values for the row currently in edit mode
  const [draft, setDraft] = useState<{
    title: string;
    unit: string;
    price: string;
  }>({ title: "", unit: "", price: "" });

  // Load + subscribe to dictionary changes (e.g. another tab adding entries)
  useEffect(() => {
    if (!isOpen) return;
    setEntries(serviceDictionary.getAll());
    const unsubscribe = serviceDictionary.onChange(() => {
      setEntries(serviceDictionary.getAll());
    });
    return unsubscribe;
  }, [isOpen]);

  // Autofocus the title input when the modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 100);
    } else {
      // Reset form state when the modal closes
      setNewTitle("");
      setNewUnit("");
      setNewPrice("");
      setQuery("");
      setEditingId(null);
    }
  }, [isOpen]);

  // Esc to close (unless actively editing a row — let Esc cancel the edit)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, editingId, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.unit || "").toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q),
    );
  }, [entries, query]);

  const handleAdd = () => {
    const title = newTitle.trim();
    const price = parseFloat(newPrice);
    if (!title) return;
    if (isNaN(price)) return;
    serviceDictionary.add({
      title,
      price,
      unit: newUnit.trim() || undefined,
    });
    setEntries(serviceDictionary.getAll());
    setNewTitle("");
    setNewUnit("");
    setNewPrice("");
    titleRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    serviceDictionary.delete(id);
    setEntries(serviceDictionary.getAll());
  };

  const startEdit = (entry: ServiceDictionaryEntry) => {
    setEditingId(entry.id);
    setDraft({
      title: entry.title,
      unit: entry.unit || "",
      price: String(entry.price),
    });
  };

  const saveEdit = (id: string) => {
    const price = parseFloat(draft.price);
    serviceDictionary.update(id, {
      title: draft.title.trim(),
      unit: draft.unit.trim() || undefined,
      price: isNaN(price) ? 0 : price,
    });
    setEntries(serviceDictionary.getAll());
    setEditingId(null);
  };

  if (!isOpen) return null;

  const formatPrice = (n: number) => `₦${Math.round(n).toLocaleString()}`;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border/40 bg-muted/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <BookOpen size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                Service Dictionary
              </h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60 mt-0.5">
                Reusable services & products for BOQ autocomplete
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Add entry form */}
        <div className="p-6 border-b border-border/40 bg-muted/5 shrink-0">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-3">
            Add New Entry
          </label>
          <div className="flex gap-3">
            <input
              ref={titleRef}
              type="text"
              placeholder="Service or product title (e.g. Porcelain floor tiles 60×60)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-all"
            />
            <input
              type="text"
              placeholder="Unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="w-24 px-3 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-all"
            />
            <input
              type="number"
              placeholder="Price ₦"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="w-36 px-3 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-all tabular-nums"
            />
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || !newPrice.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Search + count */}
        <div className="px-6 py-3 border-b border-border/40 bg-muted/5 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 flex-1 bg-card border border-border rounded-xl px-4 py-2">
            <Search size={14} className="text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter entries..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-foreground placeholder:text-muted-foreground/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
            {filtered.length} of {entries.length}
          </span>
        </div>

        {/* Table body */}
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
              <BookOpen size={40} className="mb-4 opacity-40" />
              <p className="text-xs font-black uppercase tracking-widest">
                Your dictionary is empty
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">
                Add your first entry above
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
              <Search size={32} className="mb-3 opacity-40" />
              <p className="text-xs font-black uppercase tracking-widest">
                No matches for "{query}"
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border/40">
                  <th className="text-left px-6 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Title
                  </th>
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-24">
                    Unit
                  </th>
                  <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-36">
                    Price
                  </th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const isEditing = editingId === entry.id;
                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        "border-b border-border/20 group hover:bg-muted/20 transition-colors",
                        isEditing && "bg-primary/5",
                      )}
                    >
                      <td className="px-6 py-3 text-xs font-semibold text-foreground">
                        {isEditing ? (
                          <input
                            type="text"
                            value={draft.title}
                            onChange={(e) =>
                              setDraft({ ...draft, title: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(entry.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-full px-2 py-1 bg-card border border-primary/50 rounded text-xs font-semibold outline-none"
                            autoFocus
                          />
                        ) : (
                          entry.title
                        )}
                      </td>
                      <td className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {isEditing ? (
                          <input
                            type="text"
                            value={draft.unit}
                            onChange={(e) =>
                              setDraft({ ...draft, unit: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(entry.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-full px-2 py-1 bg-card border border-primary/50 rounded text-xs outline-none"
                          />
                        ) : (
                          entry.unit || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-black text-foreground text-right tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            value={draft.price}
                            onChange={(e) =>
                              setDraft({ ...draft, price: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(entry.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-full px-2 py-1 bg-card border border-primary/50 rounded text-xs text-right outline-none tabular-nums"
                          />
                        ) : (
                          formatPrice(entry.price)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(entry.id)}
                                className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-all"
                                title="Save"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(entry)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                title="Edit"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-border/40 bg-muted/5 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Tip: When editing a BOQ description, matching entries will appear
            as suggestions — picking one auto-fills its price.
          </p>
        </div>
      </div>
    </div>
  );
};
