import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Home", id: "home" },
  { href: "/history", label: "History", id: "history" },
  { href: "/monthly", label: "Monthly", id: "monthly" },
  { href: "/year", label: "Year", id: "year" },
  { href: "/settings/connections", label: "Settings", id: "settings" },
] as const;

export function AppShell({
  username,
  current,
  children,
}: {
  username: string;
  current?: "home" | "settings" | "history" | "monthly" | "year";
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-col pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="flex h-[34px] shrink-0 items-center justify-between bg-bg-nav px-4 md:h-16 md:border-b md:border-border md:bg-bg-nav/72 md:px-6">
        <div className="flex items-center gap-2 md:gap-7">
          <Link className="flex items-center gap-2 md:gap-2.5" href="/">
            <span className="size-[18px] shrink-0 rounded-sm bg-accent md:h-[22px] md:w-[22px]" />
            <span className="text-ui font-semibold leading-[18px] text-fg md:text-[18px] md:leading-body md:tracking-title">
              watchlog
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.id === current;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-ui leading-[18px] ${
                    active
                      ? "bg-bg-overlay-strong font-medium text-fg"
                      : "font-medium text-fg-muted"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <p className="text-meta leading-meta text-fg-muted md:hidden">
          {username}
        </p>
        <div className="hidden items-center gap-2 rounded-full border border-border bg-bg-overlay px-3 py-1 pr-2.5 md:flex">
          <span className="size-2 shrink-0 rounded-full bg-status-ok" />
          <span className="text-meta font-medium leading-meta text-fg">
            {username}
          </span>
        </div>
      </header>
      {children}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-border bg-bg-nav px-3 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {NAV.map((item) => {
          const active = item.id === current;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`text-label leading-label ${
                active
                  ? "font-semibold text-accent"
                  : "font-medium text-fg-muted"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
