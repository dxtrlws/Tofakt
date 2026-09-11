"use client";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`busy-spinner size-3 shrink-0 animate-spin ${className}`}
      fill="none"
      viewBox="0 0 12 12"
    >
      <circle
        cx="6"
        cy="6"
        opacity="0.25"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6 1.5A4.5 4.5 0 0 1 10.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function BusyLabel({
  busy,
  idle,
  pending,
}: {
  busy: string;
  idle: string;
  pending: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {pending ? <Spinner /> : null}
      {pending ? busy : idle}
    </span>
  );
}
