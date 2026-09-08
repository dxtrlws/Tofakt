"use client";

import { useEffect, useRef, useState } from "react";

export type PrefSelectOption = { value: string; label: string };

export function PrefSelect({
  label,
  name,
  value,
  options,
  onChange,
  submitOnChange = false,
  className = "",
  menuClassName = "min-w-[12.5rem]",
}: {
  label: string;
  name: string;
  value: string;
  options: PrefSelectOption[];
  onChange?: (value: string) => void;
  submitOnChange?: boolean;
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const currentLabel =
    options.find((option) => option.value === value)?.label ?? value;
  const scrollMenu = options.length > 8;

  useEffect(() => {
    if (!open) {
      return;
    }
    selectedRef.current?.scrollIntoView({ block: "nearest" });
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      className={`relative flex min-w-0 items-center ${open ? "z-50" : "z-0"} ${className}`}
      ref={rootRef}
    >
      <input name={name} ref={inputRef} type="hidden" value={value} />
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className="flex min-w-0 items-center justify-end gap-2 rounded-md px-3 py-2 text-ui leading-[18px] text-fg outline-none"
        onClick={() => setOpen((next) => !next)}
        ref={triggerRef}
        type="button"
      >
        <span className="min-w-0 truncate">{currentLabel}</span>
        <svg
          aria-hidden="true"
          className="size-3 shrink-0 text-fg-muted"
          fill="none"
          viewBox="0 0 12 12"
        >
          <path
            d="M2.5 4.25 6 7.75 9.5 4.25"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      {open ? (
        <div
          className={`absolute right-0 top-[calc(100%+6px)] z-50 overflow-x-hidden rounded-md border border-border bg-bg-overlay-strong py-2 ${
            scrollMenu ? "max-h-64 overflow-y-auto" : ""
          } ${menuClassName}`}
          role="listbox"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                aria-selected={selected}
                className={`flex w-full px-4 py-2.5 text-left text-ui leading-[18px] ${
                  selected
                    ? "bg-accent-dim text-fg"
                    : "text-fg hover:bg-bg-overlay-strong"
                }`}
                key={option.value}
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.value = option.value;
                  }
                  onChange?.(option.value);
                  setOpen(false);
                  if (submitOnChange) {
                    inputRef.current?.form?.requestSubmit();
                  }
                }}
                ref={selected ? selectedRef : undefined}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}
