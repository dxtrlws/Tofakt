"use client";

import { useState } from "react";

export function CopyReport({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-ui font-medium leading-[18px] text-fg"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      type="button"
    >
      {copied ? "Copied" : "Copy report"}
    </button>
  );
}
