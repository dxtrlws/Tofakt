import type { ReactNode } from "react";

export const fieldClass =
  "w-full rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui text-fg outline-none";
export const ghostBtn =
  "rounded-md px-3.5 py-2 text-ui font-medium leading-[18px] text-fg-muted";
export const outlineBtn =
  "rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui font-medium leading-[18px] text-fg disabled:cursor-not-allowed disabled:opacity-40";
export const primaryBtn =
  "rounded-md bg-accent px-3.5 py-2 text-ui font-medium leading-[18px] text-fg-on-accent disabled:cursor-not-allowed disabled:opacity-40";

export function SavedSecret({ label }: { label: string }) {
  return <p className="text-ui text-fg">{label} · ••••••••</p>;
}

export function NextStep({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-border bg-bg-overlay px-3 py-2.5 text-ui leading-[18px] text-fg">
      {children}
    </p>
  );
}
