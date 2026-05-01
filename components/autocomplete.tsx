"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AutocompleteOption {
  value: unknown;
  label: string;
  description?: string;
}

interface AutocompleteProps {
  value: string;
  onValueChange: (text: string) => void;
  onSelect: (option: AutocompleteOption) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  inputId?: string;
  dark?: boolean;
}

export function Autocomplete({
  value,
  onValueChange,
  onSelect,
  options,
  placeholder,
  inputId,
  dark,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "h-11 w-full rounded-md border px-3 text-sm focus:outline-none",
          dark
            ? "border-white/15 bg-white/5 text-white placeholder:text-white/40 focus:border-white/30"
            : "border-[var(--border-default)] bg-[var(--bg-surface)] text-foreground placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent-600)]",
        )}
      />
      {open && options.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-md border border-[var(--border-subtle)] bg-card shadow-[var(--shadow-md)]">
          {options.map((opt, i) => (
            <li key={i}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-foreground">{opt.label}</span>
                {opt.description && (
                  <span className="text-xs text-[var(--text-secondary)]">{opt.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
