import React, { useState, useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import { formatDate } from "../lib/documentUtils";

export interface EditableProps {
  value: string | number;
  onSave: (val: string | number) => void;
  className?: string;
  multiline?: boolean;
  numeric?: boolean;
  isCurrency?: boolean;
  isDate?: boolean;
  readOnly?: boolean;
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
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
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
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className={cn(commonClasses, "resize-none overflow-hidden block")}
          value={tempValue}
          onChange={(e) => {
            setTempValue(e.target.value);
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
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={isDate ? "date" : "text"}
        className={cn(commonClasses, "h-full")}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
        }}
      />
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
