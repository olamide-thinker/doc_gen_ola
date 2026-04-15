import React, { useState, useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import { formatDate } from "../lib/documentUtils";
import type { ServiceDictionaryEntry } from "../lib/service-dictionary";
import { Sparkles } from "../lib/icons/lucide";

export interface EditableProps {
  value: string | number;
  onSave: (val: string | number) => void;
  className?: string;
  multiline?: boolean;
  numeric?: boolean;
  isCurrency?: boolean;
  isDate?: boolean;
  readOnly?: boolean;
  onChange?: (val: string | number) => void;
  /**
   * Optional getter for autocomplete suggestions. Called on every keystroke
   * with the current input value; returns matching entries (already ranked/
   * limited by the caller). When provided, a floating suggestion panel is
   * rendered below the input.
   */
  getSuggestions?: (query: string) => ServiceDictionaryEntry[];
  /**
   * Called when the user picks a suggestion from the dropdown. Parent is
   * responsible for updating any dependent cells (e.g. a neighbouring
   * price column in a BOQ row).
   */
  onPickSuggestion?: (entry: ServiceDictionaryEntry) => void;
}

export const Editable: React.FC<EditableProps> = ({
  value,
  onSave,
  className,
  multiline = false,
  numeric = false,
  isCurrency = false,
  isDate = false,
  readOnly = false,
  onChange,
  getSuggestions,
  onPickSuggestion,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [suggestions, setSuggestions] = useState<ServiceDictionaryEntry[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPicking, setIsPicking] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Recompute suggestions whenever the input changes while editing
  useEffect(() => {
    if (!isEditing || !getSuggestions) {
      setSuggestions([]);
      return;
    }
    const q = typeof tempValue === "string" ? tempValue : String(tempValue);
    setSuggestions(getSuggestions(q));
    setActiveIdx(0);
  }, [tempValue, isEditing, getSuggestions]);

  const handleSave = () => {
    // Skip the save path if we're in the middle of picking a suggestion —
    // onBlur fires before the mousedown handler, which would otherwise
    // overwrite the picked value with the unpicked draft.
    if (isPicking) return;
    setIsEditing(false);
    if (tempValue !== value) {
      let finalValue = tempValue;
      if (numeric && typeof tempValue === "string") {
        // Strip everything except digits, dots, and minus signs
        finalValue = tempValue.replace(/[^0-9.-]/g, "");
      }
      onSave(numeric ? Number(finalValue) || 0 : finalValue);
    }
  };

  const handlePickSuggestion = (entry: ServiceDictionaryEntry) => {
    // Commit the title as the cell value and let the parent fill any
    // dependent cells (price, unit) in a single synchronous batch so we
    // don't leave the editor in a half-updated state.
    setTempValue(entry.title);
    onSave(entry.title);
    onPickSuggestion?.(entry);
    setIsEditing(false);
    setIsPicking(false);
    setSuggestions([]);
  };

  let displayValue = value === undefined || value === "" ? (numeric ? 0 : "--") : value;
  if (numeric && isCurrency && !isEditing) {
    displayValue = Number(value).toLocaleString();
  } else if (isDate && !isEditing) {
    displayValue = formatDate(value as string);
  }

  if (!readOnly && isEditing) {
    const commonClasses = `w-full box-border bg-amber-50/90 border border-amber-400 outline-none text-[#212121] transition-all p-1 ${className}`;

    if (multiline) {
      return (
        <div className="relative w-full">
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className={cn(commonClasses, "resize-none overflow-hidden block")}
            value={tempValue}
            onChange={(e) => {
              const val = e.target.value;
              setTempValue(val);
              onChange?.(val);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          <SuggestionPanel
            suggestions={suggestions}
            activeIdx={activeIdx}
            onPick={handlePickSuggestion}
            onHover={setActiveIdx}
            setIsPicking={setIsPicking}
          />
        </div>
      );
    }
    return (
      <div className="relative w-full">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={isDate ? "date" : "text"}
          className={cn(commonClasses, "h-full")}
          value={tempValue}
          onChange={(e) => {
            const val = e.target.value;
            setTempValue(val);
            onChange?.(val);
          }}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (suggestions.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => (i + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx(
                  (i) => (i - 1 + suggestions.length) % suggestions.length,
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                handlePickSuggestion(suggestions[activeIdx]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setSuggestions([]);
                return;
              }
            }
            if (e.key === "Enter") handleSave();
          }}
        />
        <SuggestionPanel
          suggestions={suggestions}
          activeIdx={activeIdx}
          onPick={handlePickSuggestion}
          onHover={setActiveIdx}
          setIsPicking={setIsPicking}
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={() => !readOnly && setIsEditing(true)}
      className={cn(
        "cursor-pointer hover:bg-amber-50/40 rounded transition-colors w-full h-full min-h-[1em] flex items-center",
        className,
      )}
    >
      <span className={cn("block w-full", multiline && "whitespace-pre-wrap")}>
        {displayValue}
      </span>
    </div>
  );
};

/**
 * Floating suggestion dropdown shown under the description input while the
 * user is typing. Rendered only when there are matches — otherwise returns
 * null so the cell height stays stable.
 */
const SuggestionPanel: React.FC<{
  suggestions: ServiceDictionaryEntry[];
  activeIdx: number;
  onPick: (entry: ServiceDictionaryEntry) => void;
  onHover: (idx: number) => void;
  setIsPicking: (v: boolean) => void;
}> = ({ suggestions, activeIdx, onPick, onHover, setIsPicking }) => {
  if (suggestions.length === 0) return null;
  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] max-h-64 overflow-y-auto"
      onMouseDown={(e) => {
        // Prevent the input's onBlur from firing before the click handler
        e.preventDefault();
        setIsPicking(true);
      }}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-100 bg-slate-50/80">
        <Sparkles size={10} className="text-primary" />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          Service Dictionary · {suggestions.length}{" "}
          {suggestions.length === 1 ? "match" : "matches"}
        </span>
      </div>
      <ul>
        {suggestions.map((entry, idx) => (
          <li
            key={entry.id}
            onMouseEnter={() => onHover(idx)}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(entry);
            }}
            className={cn(
              "px-3 py-2 cursor-pointer flex items-center justify-between gap-3 transition-colors",
              idx === activeIdx ? "bg-primary/10" : "hover:bg-slate-50",
            )}
          >
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  "text-[12px] font-semibold text-slate-800 truncate",
                  idx === activeIdx && "text-primary",
                )}
              >
                {entry.title}
              </div>
              {entry.unit && (
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  per {entry.unit}
                </div>
              )}
            </div>
            <div className="text-[11px] font-black text-slate-700 tabular-nums whitespace-nowrap">
              ₦{Math.round(entry.price).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
