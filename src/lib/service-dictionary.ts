/**
 * Service Dictionary — a user-maintained lookup of services / products and
 * their prices. Used by the BOQ description cell autocomplete: type a few
 * letters of "porcelain floor tiles" and the matching entry + its price get
 * prefilled into the row.
 *
 * Storage: localStorage under `invsys_service_dictionary`.
 *   - Keeps the infrastructure light (no backend migration yet).
 *   - Mirrors the existing `invsys_templates` pattern in src/lib/api.ts.
 *   - A later iteration can move this to the backend and sync across
 *     team members by swapping these helpers without touching callers.
 */

export interface ServiceDictionaryEntry {
  id: string;
  title: string;
  price: number;
  unit?: string;        // "sqm", "pcs", "day", "lot"...
  category?: string;    // optional grouping tag — reserved for future filters
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "invsys_service_dictionary";

// Custom event so open UIs can refresh when a mutation happens elsewhere
// (e.g. the dictionary modal adds a row while the invoice editor is also
// mounted — the editor's suggestion list should pick up the new entry).
const CHANGE_EVENT = "service-dictionary:changed";

function readAll(): ServiceDictionaryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: ServiceDictionaryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* non-browser env — fine to skip */
  }
}

function makeId(): string {
  return `sd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const serviceDictionary = {
  getAll(): ServiceDictionaryEntry[] {
    return readAll();
  },

  add(input: {
    title: string;
    price: number;
    unit?: string;
    category?: string;
    notes?: string;
  }): ServiceDictionaryEntry {
    const now = new Date().toISOString();
    const entry: ServiceDictionaryEntry = {
      id: makeId(),
      title: input.title.trim(),
      price: Number(input.price) || 0,
      unit: input.unit?.trim() || undefined,
      category: input.category?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const all = readAll();
    all.unshift(entry);
    writeAll(all);
    return entry;
  },

  update(id: string, patch: Partial<Omit<ServiceDictionaryEntry, "id" | "createdAt">>): void {
    const all = readAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return;
    all[idx] = {
      ...all[idx],
      ...patch,
      price: patch.price !== undefined ? Number(patch.price) || 0 : all[idx].price,
      updatedAt: new Date().toISOString(),
    };
    writeAll(all);
  },

  delete(id: string): void {
    const next = readAll().filter((e) => e.id !== id);
    writeAll(next);
  },

  /**
   * Simple case-insensitive substring search, ranked by:
   *   1. Exact prefix match (score 3)
   *   2. Word-start match (score 2)
   *   3. Substring match (score 1)
   *
   * Returns up to `limit` entries (default 8 — enough for a dropdown
   * panel without scrolling, matches common IDE autocomplete UIs).
   */
  search(query: string, limit = 8): ServiceDictionaryEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = readAll();
    const scored: Array<{ entry: ServiceDictionaryEntry; score: number }> = [];
    for (const entry of all) {
      const title = entry.title.toLowerCase();
      if (!title.includes(q)) continue;
      let score = 1;
      if (title.startsWith(q)) score = 3;
      else if (new RegExp(`\\b${escapeRegex(q)}`).test(title)) score = 2;
      scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.entry);
  },

  /**
   * Subscribe to mutations — used by live components so suggestions stay
   * fresh while the dictionary modal is open.
   */
  onChange(handler: () => void): () => void {
    const cb = () => handler();
    window.addEventListener(CHANGE_EVENT, cb);
    // Also listen to cross-tab storage events so two tabs stay in sync
    const storageCb = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) handler();
    };
    window.addEventListener("storage", storageCb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", storageCb);
    };
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Given a table's column definitions, pick the column that represents the
 * unit price / rate of a BOQ row. Used by the description autocomplete to
 * decide where to write the suggested price.
 *
 * Heuristic (mirrors the templates shipped in src/lib/templates.ts):
 *   1. A numeric column whose label matches /rate|price|cost|amount|fee/i
 *      — matches "Rate (₦)", "Unit Cost (₦)", "Day Rate (₦)", "Amount (₦)"
 *   2. Fall back to the last numeric column BEFORE any formula column
 *      — in BOQ that's still E (Rate), in Design Fee it's D (Total)
 *   3. Fall back to the last numeric column in the table
 *   4. Return null if none — suggestion still updates the description only
 */
export function findPriceColumnId(columns: any[]): string | null {
  if (!Array.isArray(columns)) return null;
  const priceRegex = /rate|price|cost|amount|fee/i;
  for (const c of columns) {
    if (c?.type === "number" && priceRegex.test(c.label || "")) return c.id;
  }
  const firstFormulaIdx = columns.findIndex((c) => c?.type === "formula");
  const searchPool =
    firstFormulaIdx >= 0 ? columns.slice(0, firstFormulaIdx) : columns;
  const numberCols = searchPool.filter((c: any) => c?.type === "number");
  if (numberCols.length > 0) return numberCols[numberCols.length - 1].id;
  const anyNumber = columns.filter((c: any) => c?.type === "number");
  if (anyNumber.length > 0) return anyNumber[anyNumber.length - 1].id;
  return null;
}

/**
 * True when a column should trigger description-suggestion autocomplete.
 * Checks label keywords first (works across all shipped templates:
 * "Description", "Stage Description", "Item / Vendor", "Project Summary",
 * "Change Description", "Artisan Type", "Scope of Work") and falls back to
 * "the first text-type column" as a safety net for user-built tables.
 */
export function isDescriptionColumn(col: any, allColumns: any[]): boolean {
  if (!col || col.type !== "text") return false;
  const label = (col.label || "").toLowerCase();
  if (
    /description|item|scope|stage|service|change|summary|product|vendor/.test(
      label,
    )
  ) {
    return true;
  }
  // Fallback: first text-type column in the table
  const firstText = allColumns.find((c: any) => c?.type === "text");
  return firstText?.id === col.id;
}
