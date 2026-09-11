import type { ReactNode } from "react";
import {
  fieldClass,
  ghostBtn,
  outlineBtn,
  primaryBtn,
} from "@/components/connections/setup";
import { SyncBadge } from "@/components/history/sync-badge";

const BACKGROUNDS = [
  { token: "bg-base", className: "bg-bg-base", hex: "#03141C" },
  { token: "bg-nav", className: "bg-bg-nav", hex: "#01151D" },
  { token: "bg-raised", className: "bg-bg-raised", hex: "#0D1B23" },
  { token: "bg-overlay", className: "bg-bg-overlay", hex: "#16252F" },
  {
    token: "bg-overlay-strong",
    className: "bg-bg-overlay-strong",
    hex: "#1C3341",
  },
  { token: "bg-inverse", className: "bg-bg-inverse", hex: "#E3E2E3" },
] as const;

const FOREGROUNDS = [
  { token: "fg", className: "bg-fg", hex: "#F5F7F8" },
  { token: "fg-muted", className: "bg-fg-muted", hex: "#818D8E" },
  { token: "fg-subtle", className: "bg-fg-subtle", hex: "#495C62" },
  { token: "fg-on-accent", className: "bg-fg-on-accent", hex: "#03141C" },
] as const;

const ACCENTS = [
  { token: "accent", className: "bg-accent", hex: "#4CC7B6" },
  { token: "accent-hover", className: "bg-accent-hover", hex: "#3DAEA5" },
  { token: "accent-muted", className: "bg-accent-muted", hex: "#236F64" },
  { token: "accent-dim", className: "bg-accent-dim", hex: "#0A3A3A" },
] as const;

const SYNC = [
  { token: "sync-synced", className: "bg-sync-synced", status: "synced" },
  { token: "sync-pending", className: "bg-sync-pending", status: "pending" },
  { token: "sync-skipped", className: "bg-sync-skipped", status: "skipped" },
  { token: "sync-failed", className: "bg-sync-failed", status: "failed" },
  {
    token: "sync-unmatched",
    className: "bg-sync-unmatched",
    status: "unmatched",
  },
] as const;

const STATUS = [
  { token: "status-ok", className: "bg-status-ok", label: "ok" },
  { token: "status-warn", className: "bg-status-warn", label: "warn" },
  { token: "status-down", className: "bg-status-down", label: "down" },
  {
    token: "status-unknown",
    className: "bg-status-unknown",
    label: "unknown",
  },
] as const;

const CHARTS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
] as const;

const TYPE_SAMPLES = [
  {
    label: "display · 56/60 · Outfit 700",
    className:
      "font-headline text-display font-bold leading-display tracking-display",
    sample: "September",
  },
  {
    label: "stat · 40/44 · Outfit 650",
    className:
      "font-headline text-stat font-semibold leading-stat tracking-display",
    sample: "142",
  },
  {
    label: "title · 32/38 · Outfit 650",
    className:
      "font-headline text-title font-semibold leading-title tracking-title",
    sample: "History",
  },
  {
    label: "title-sm · 22/28 · Outfit 600",
    className:
      "font-headline text-title-sm font-semibold leading-title-sm tracking-title-sm",
    sample: "Continue watching",
  },
  {
    label: "body · 15/22 · Inter 400",
    className: "text-body leading-body",
    sample: "Reviews stay quiet until there is a play.",
  },
  {
    label: "ui · 14/20 · Inter 500",
    className: "text-ui font-medium leading-ui",
    sample: "Run sync now",
  },
  {
    label: "meta · 12/16 · Inter 500",
    className: "text-meta font-medium leading-meta tracking-meta",
    sample: "S02E07 · 42m · Sep 8, 2026",
  },
  {
    label: "label · 11/14 · Inter 600 caps",
    className:
      "text-label font-semibold uppercase leading-label tracking-label text-fg-muted",
    sample: "Plays",
  },
] as const;

const RADII = [
  { token: "sm", className: "rounded-sm", value: "6px" },
  { token: "md", className: "rounded-md", value: "10px" },
  { token: "lg", className: "rounded-lg", value: "14px" },
  { token: "xl", className: "rounded-xl", value: "20px" },
  { token: "full", className: "rounded-full", value: "999px" },
] as const;

const SPACES = [
  { token: "1", size: "4px", className: "w-1" },
  { token: "2", size: "8px", className: "w-2" },
  { token: "3", size: "12px", className: "w-3" },
  { token: "4", size: "16px", className: "w-4" },
  { token: "5", size: "24px", className: "w-6" },
  { token: "6", size: "32px", className: "w-8" },
  { token: "8", size: "48px", className: "w-12" },
] as const;

export function StyleGuide() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 pb-16 pt-6 md:px-8 md:pt-8">
      <header className="flex flex-col gap-3">
        <p className="text-label font-semibold uppercase leading-label tracking-label text-accent">
          Design system
        </p>
        <h1 className="font-headline text-title font-semibold leading-title tracking-title text-fg">
          Styleguide
        </h1>
        <p className="max-w-2xl text-body leading-body text-fg-muted">
          Nocturnal teal — deep water, instrument glass, one mint phosphor.
          Elevation is border + tinted fill, never drop shadows. Every swatch
          below is a live token from{" "}
          <code className="text-meta text-fg">app/globals.css</code>. Source of
          truth: <code className="text-meta text-fg">design/TOKENS.md</code>.
        </p>
      </header>

      <Section
        title="Principles"
        lead="Rules that keep the UI looking like Watchlog, not a dashboard kit."
      >
        <ul className="grid gap-3 md:grid-cols-2">
          {[
            [
              "Tokens only",
              "No hard-coded hex in components. Use Tailwind theme classes backed by CSS custom properties.",
            ],
            [
              "Border elevation",
              "Raised surfaces use hairline borders and a step up in background. Optional overlay shadow only on floating menus.",
            ],
            [
              "Cinema vs ledger",
              "Home and reviews breathe (24–48px). History and Settings stay dense (12–16px rows).",
            ],
            [
              "State is not color alone",
              "Sync and health always pair color with an icon and a label.",
            ],
          ].map(([title, body]) => (
            <li
              className="rounded-lg border border-border bg-bg-raised p-4"
              key={title}
            >
              <p className="text-ui font-semibold leading-[18px] text-fg">
                {title}
              </p>
              <p className="mt-1.5 text-meta leading-meta text-fg-muted">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Backgrounds" lead="Page ground → raised → overlay.">
        <SwatchGrid items={BACKGROUNDS} />
      </Section>

      <Section title="Foreground" lead="Primary, muted, subtle, and on-accent.">
        <SwatchGrid items={FOREGROUNDS} />
      </Section>

      <Section
        title="Accent"
        lead="Brand teal and its hover / muted / dim steps."
      >
        <SwatchGrid items={ACCENTS} />
      </Section>

      <Section
        title="Sync states"
        lead="Badges must stay color + icon + label. Never merge failed and not synced."
      >
        <div className="flex flex-wrap gap-3">
          {SYNC.map((item) => (
            <div className="flex flex-col gap-2" key={item.token}>
              <SyncBadge status={item.status} />
              <span className="text-meta leading-meta text-fg-subtle">
                {item.token}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {SYNC.map((item) => (
            <div
              className={`h-12 rounded-md border border-border ${item.className}`}
              key={`${item.token}-swatch`}
              title={item.token}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Connection status"
        lead="tofa / Trakt / TMDB health dots on Home and Settings."
      >
        <div className="flex flex-wrap gap-4">
          {STATUS.map((item) => (
            <div className="flex items-center gap-2.5" key={item.token}>
              <span className={`size-2.5 rounded-full ${item.className}`} />
              <span className="text-ui leading-[18px] text-fg">
                {item.label}
              </span>
              <span className="text-meta text-fg-subtle">{item.token}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Chart palette"
        lead="Eight dark-first hues. Heatmaps use accent steps, not this rainbow."
      >
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          {CHARTS.map((className, index) => (
            <div className="flex flex-col gap-1.5" key={className}>
              <div className={`h-14 rounded-md ${className}`} />
              <span className="text-meta text-fg-subtle">
                chart-{index + 1}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-1">
          {[
            "bg-bg-raised",
            "bg-accent-dim",
            "bg-accent-muted",
            "bg-accent",
          ].map((step, index) => (
            <div
              className={`h-8 grow rounded-sm ${step}`}
              key={step}
              title={`heatmap step ${index + 1}`}
            />
          ))}
        </div>
        <p className="mt-2 text-meta leading-meta text-fg-muted">
          Heatmap steps: raised → accent-dim → accent-muted → accent
        </p>
      </Section>

      <Section
        title="Typography"
        lead="Inter for UI/body. Outfit for display, titles, and headline stats."
      >
        <div className="flex flex-col gap-5 rounded-lg border border-border bg-bg-raised p-5">
          {TYPE_SAMPLES.map((row) => (
            <div className="flex flex-col gap-1" key={row.label}>
              <span className="text-meta leading-meta text-fg-subtle">
                {row.label}
              </span>
              <p className={`${row.className} text-fg`}>{row.sample}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-meta leading-meta text-fg-muted">
          Stats and timestamps use tabular numerals (
          <code className="text-fg">font-variant-numeric: tabular-nums</code>
          ).
        </p>
      </Section>

      <Section title="Radius" lead="Soft, not pill-for-its-own-sake.">
        <div className="flex flex-wrap items-end gap-4">
          {RADII.map((item) => (
            <div className="flex flex-col items-center gap-2" key={item.token}>
              <div
                className={`size-16 border border-border bg-bg-overlay ${item.className}`}
              />
              <span className="text-meta text-fg-muted">
                {item.token} · {item.value}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Spacing"
        lead="4px base. Layout mostly 8 / 12 / 16 / 24 / 32 / 48."
      >
        <div className="flex flex-col gap-2">
          {SPACES.map((item) => (
            <div className="flex items-center gap-3" key={item.token}>
              <span className="w-16 shrink-0 text-meta text-fg-subtle">
                space-{item.token}
              </span>
              <div className={`h-3 rounded-sm bg-accent ${item.className}`} />
              <span className="text-meta text-fg-muted">{item.size}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons" lead="Primary, outline, ghost, and disabled.">
        <div className="flex flex-wrap items-center gap-3">
          <button className={primaryBtn} type="button">
            Primary
          </button>
          <button className={outlineBtn} type="button">
            Outline
          </button>
          <button className={ghostBtn} type="button">
            Ghost
          </button>
          <button className={primaryBtn} disabled type="button">
            Disabled
          </button>
        </div>
      </Section>

      <Section title="Fields" lead="Overlay fill, hairline border, radius-md.">
        <div className="max-w-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-meta leading-meta text-fg-muted">Label</span>
            <input
              className={fieldClass}
              defaultValue="Sample value"
              readOnly
              type="text"
            />
          </label>
          <p className="mt-2 text-ui leading-ui text-sync-failed">
            Error text uses sync-failed + a sentence — not border color alone.
          </p>
        </div>
      </Section>

      <Section
        title="Surfaces"
        lead="Cards and needs-attention use border language, not shadows."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-bg-raised p-5">
            <p className="text-label font-semibold uppercase tracking-label text-fg-muted">
              Default card
            </p>
            <p className="mt-2 text-ui text-fg">border + bg-raised</p>
          </div>
          <div className="rounded-lg border border-border-strong bg-bg-raised p-5">
            <p className="text-label font-semibold uppercase tracking-label text-accent">
              Selected
            </p>
            <p className="mt-2 text-ui text-fg">border-strong accent ring</p>
          </div>
          <div className="rounded-lg border border-sync-unmatched/45 bg-bg-raised p-5">
            <p className="text-label font-semibold uppercase tracking-label text-sync-unmatched">
              Needs decision
            </p>
            <p className="mt-2 text-ui text-fg">
              Gold hairline, unmatched family
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Empty state"
        lead="Accent mark, one headline, one sentence. No zeroed charts."
      >
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-bg-raised p-6">
          <span className="size-7 shrink-0 rounded-full border border-accent-muted bg-accent-dim" />
          <h2 className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
            No Trakt plays in September
          </h2>
          <p className="max-w-[480px] text-body leading-body text-fg-muted">
            Reviews stay quiet until there is a play. No zeroed charts, no empty
            heatmap.
          </p>
        </div>
      </Section>

      <Section
        title="Motion"
        lead="Short, quiet. Respect prefers-reduced-motion."
      >
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ["duration-fast", "150ms", "Hover background / border"],
            ["duration-default", "200ms", "Section enter, toasts"],
            ["ease-default", "0.2, 0.8, 0.2, 1", "Cubic bezier for UI"],
          ].map(([token, value, use]) => (
            <div
              className="rounded-lg border border-border bg-bg-raised p-4"
              key={token}
            >
              <dt className="text-meta text-fg-subtle">{token}</dt>
              <dd className="mt-1 text-ui font-medium text-fg">{value}</dd>
              <dd className="mt-1 text-meta text-fg-muted">{use}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Focus" lead="Never remove the visible ring.">
        <button
          className={`${outlineBtn} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
          type="button"
        >
          Tab here — 2px accent, 2px offset
        </button>
      </Section>
    </div>
  );
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-headline text-title-sm font-semibold leading-title-sm tracking-title-sm text-fg">
          {title}
        </h2>
        <p className="text-meta leading-meta text-fg-muted">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function SwatchGrid({
  items,
}: {
  items: readonly { token: string; className: string; hex: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
      {items.map((item) => (
        <div className="flex flex-col gap-2" key={item.token}>
          <div
            className={`h-16 rounded-lg border border-border ${item.className}`}
          />
          <div className="flex flex-col">
            <span className="text-meta font-medium text-fg">{item.token}</span>
            <span className="text-meta text-fg-subtle">{item.hex}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
