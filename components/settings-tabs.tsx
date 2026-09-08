import Link from "next/link";

const TABS = [
  { href: "/settings/connections", label: "Connections" },
  { href: "/settings/sync", label: "Sync" },
  { href: "/settings/data", label: "Data" },
  { href: "/settings/logs", label: "Logs" },
  { href: "/settings/about", label: "About" },
] as const;

export function SettingsTabs({ current }: { current: string }) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex w-full gap-2 overflow-x-auto px-4 pt-5 md:px-8"
    >
      {TABS.map((tab) => {
        const active = tab.href.endsWith(current);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-ui leading-[18px] ${
              active
                ? "bg-bg-overlay-strong font-semibold text-fg"
                : "font-medium text-fg-muted"
            }`}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
