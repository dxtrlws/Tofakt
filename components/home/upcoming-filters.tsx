import Link from "next/link";
import type { ReactNode } from "react";
import type { UpcomingFilter } from "@/lib/home/upcoming";
import { upcomingFilterLabel } from "@/lib/home/upcoming";

export function UpcomingFilters({ filter }: { filter: UpcomingFilter }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-headline text-title-sm font-semibold leading-title-sm tracking-title-sm text-fg">
          Upcoming
        </h2>
        <p className="text-meta font-medium leading-meta text-accent">
          {upcomingFilterLabel(filter)}
        </p>
      </div>
      <div className="flex h-9 items-center rounded-full border border-border bg-bg-raised p-[3px]">
        <FilterIcon
          active={filter === "all"}
          href="/"
          label="All upcoming episodes"
        >
          <rect
            fill="none"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
            width="18"
            x="3"
            y="5"
          />
          <path
            d="M8 5V3M16 5V3"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </FilterIcon>
        <FilterIcon
          active={filter === "premieres"}
          href="/?upcoming=premieres"
          label="Season premieres"
        >
          <path
            d="M3 9h18v11H3V9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M3 9l4-5h4l-4 5h4l4-5h4l-4 5"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </FilterIcon>
        <FilterIcon
          active={filter === "finales"}
          href="/?upcoming=finales"
          label="Season finales"
        >
          <rect
            fill="none"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
            width="16"
            x="4"
            y="5"
          />
          <path
            d="M4 5h4v3.5H4V5Zm4 3.5h4V12H8V8.5Zm4-3.5h4v3.5h-4V5Zm4 3.5h4V12h-4V8.5ZM4 12h4v3.5H4V12Zm8 0h4v3.5h-4V12Z"
            fill="currentColor"
          />
        </FilterIcon>
      </div>
    </div>
  );
}

function FilterIcon({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={`flex h-[30px] w-[42px] shrink-0 items-center justify-center rounded-full ${
        active ? "bg-accent text-fg-on-accent" : "text-fg-muted"
      }`}
      href={href}
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="16"
        viewBox="0 0 24 24"
        width="16"
      >
        {children}
      </svg>
    </Link>
  );
}
