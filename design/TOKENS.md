# Watchlog design tokens

Phase 0 extraction. No application code. Values come from the `design-*` / `Design-*` screenshots (tofa’s own UI). The `monthinrecview*.png` files are **information architecture only** — they do not contribute color, type, radius, or density.

Screenshots are 3804×2085. Measurements below are halved to a ~1902×1042 logical desktop and then rounded to the 4px grid the chrome already sits on.

---

## Source map

| File | Used for |
|---|---|
| `design.png`, `design-homescreen2.png` | Home chrome: nav, hero overlay, poster radius, progress-bar accent, density of media rows |
| `Design-allmedia.png` | Browse chrome: filter pills, active teal fill, grid gutters, letter-index, card captions |
| `Design-movies.png`, `Design-tvshows.png` | Detail chrome: glass metadata bars, pill buttons, episode-card highlight ring, circular avatars |
| `Design-settings.png`, `design-settings2.png` | Dashboard chrome: true page background (no hero art), sidebar, raised cards, status green, gold “needs attention” hairline, empty-success banner |
| `monthinrecview.png` … `monthinrecview7.png` | **Content only.** What a monthly/yearly review must *say*, not how it looks. |

Sampled from chrome, not from posters: `#03141C` page ground, `#0D1B23` raised, `#4CC7B6` accent, `#B8864D` gold hairline, `#0B4F3B` local/online green.

---

## Mood

**Nocturnal teal** — deep water at night, instrument glass, a single mint phosphor.

This is what the screenshots are, not a reinterpretation. The Trakt month-in-review purple is ignored.

---

## Color

Recorded as OKLCH with hex fallback. All UI color goes through these names. No raw hex in components.

### Background layers

| Token | Role | OKLCH | Hex |
|---|---|---|---|
| `--color-bg-base` | Page / app shell | `oklch(0.180 0.029 229.1)` | `#03141C` |
| `--color-bg-nav` | Top bar, sidebar | `oklch(0.183 0.033 225.1)` | `#01151D` |
| `--color-bg-raised` | Cards, list rows, inputs | `oklch(0.213 0.025 234.7)` | `#0D1B23` |
| `--color-bg-overlay` | Popovers, menus, glass bars | `oklch(0.256 0.028 238.5)` | `#16252F` |
| `--color-bg-overlay-strong` | Hover / selected chip | `oklch(0.309 0.038 236.6)` | `#1C3341` |
| `--color-bg-inverse` | Primary button fill (rare; Play is this in tofa) | `oklch(0.914 0.002 325.6)` | `#E3E2E3` |

Hero/detail screens sit on `--color-bg-base` with artwork fading into it. Settings/dashboard screens are `--color-bg-base` with no artwork — that is the true ground.

### Foreground / text

| Token | Role | OKLCH | Hex |
|---|---|---|---|
| `--color-fg` | Primary text, titles | `oklch(0.985 0.002 230)` | `#F5F7F8` |
| `--color-fg-muted` | Secondary / metadata | `oklch(0.634 0.014 202.8)` | `#818D8E` |
| `--color-fg-subtle` | Tertiary, placeholders, axis labels | `oklch(0.461 0.025 219.0)` | `#495C62` |
| `--color-fg-on-accent` | Text on teal fills | `oklch(0.180 0.029 229.1)` | `#03141C` |
| `--color-fg-on-inverse` | Text on light buttons | `oklch(0.180 0.029 229.1)` | `#03141C` |

`--color-fg` is slightly cooler/whiter than the sampled `#E3E2E3` so body text hits WCAG 2.2 AA on `--color-bg-base` (contrast ≈ 14:1). Sampled `#E3E2E3` is kept as `--color-bg-inverse`.

### Accent / brand

| Token | Role | OKLCH | Hex |
|---|---|---|---|
| `--color-accent` | Brand, progress, active nav, “all caught up” | `oklch(0.757 0.111 182.5)` | `#4CC7B6` |
| `--color-accent-hover` | Hover on accent | `oklch(0.685 0.101 187.6)` | `#3DAEA5` |
| `--color-accent-muted` | Selected rings, track fills | `oklch(0.493 0.075 181.7)` | `#236F64` |
| `--color-accent-dim` | Accent at ~16% on base (pills, banners) | `oklch(0.280 0.045 190)` | `#0A3A3A` |

### Borders and glass

| Token | Role | OKLCH | Hex |
|---|---|---|---|
| `--color-border` | Default hairline | `oklch(0.309 0.038 236.6 / 0.55)` | `#1C3341` at 55% |
| `--color-border-strong` | Focused / selected card | `oklch(0.757 0.111 182.5 / 0.7)` | `#4CC7B6` at 70% |
| `--color-glass` | Translucent control fill | `oklch(0.256 0.028 238.5 / 0.62)` | `#16252F` at 62% |
| `--color-scrim` | Hero bottom fade | `oklch(0.180 0.029 229.1 / 0.86)` | `#03141C` at 86% |

Elevation in this system is **border + tinted fill**, not drop shadow. Match the settings cards and the glass search/metadata bars.

### Semantic — sync states (§7.3)

Each state has a color, a fill, and must also ship an icon + label. Color alone is not enough.

| State | Token | Color | Fill | Icon direction |
|---|---|---|---|---|
| **Synced** | `--color-sync-synced` | `oklch(0.757 0.111 182.5)` `#4CC7B6` | `#4CC7B6` at 12% | check in circle |
| **Pending** | `--color-sync-pending` | `oklch(0.72 0.09 230)` `#5BA8C9` | same at 12% | clock / queue |
| **Not synced** | `--color-sync-skipped` | `oklch(0.634 0.014 202.8)` `#818D8E` | `#818D8E` at 12% | minus in circle |
| **Failed** | `--color-sync-failed` | `oklch(0.62 0.18 25)` `#E0543A` | same at 12% | warning |
| **Unmatched** | `--color-sync-unmatched` | `oklch(0.657 0.096 68.4)` `#B8864D` | `#B8864D` at 12% | question / link-off |

- Synced borrows the brand teal (same as tofa’s “all caught up” / progress).
- Unmatched borrows the gold hairline from Hygiene “Unknown titles”.
- Failed is a **softened** coral, not the poster-red `#F11E1B`. **Addition.**
- Pending is a cooler cyan so it does not collide with teal. **Addition.**
- Not synced is the existing muted metadata gray — the app *chose* not to.

Connection health (tofa / Trakt / TMDB) reuses:

| Token | Hex | Source |
|---|---|---|
| `--color-status-ok` | `#3DAEA5` | local/online family; brighter than sampled `#0B4F3B` so it reads at 8px |
| `--color-status-warn` | `#B8864D` | gold hairline |
| `--color-status-down` | `#E0543A` | same as failed |
| `--color-status-unknown` | `#495C62` | muted |

### Chart palette (8 hues, dark-mode first)

Pulled from chrome + the few non-poster accents in the dashboard (teal, cyan, gold, slate-violet). Recalibrated so adjacent bars stay distinguishable on `#03141C`.

| Token | OKLCH | Hex | Use |
|---|---|---|---|
| `--color-chart-1` | `oklch(0.757 0.111 182.5)` | `#4CC7B6` | primary series / hours |
| `--color-chart-2` | `oklch(0.72 0.09 230)` | `#5BA8C9` | secondary / plays |
| `--color-chart-3` | `oklch(0.657 0.096 68.4)` | `#B8864D` | third / movies |
| `--color-chart-4` | `oklch(0.70 0.08 280)` | `#8B86C1` | TV / slate-violet from sampled `#3D4264` lifted |
| `--color-chart-5` | `oklch(0.74 0.10 145)` | `#6FBF8A` | genre |
| `--color-chart-6` | `oklch(0.78 0.12 85)` | `#D4B45A` | genre |
| `--color-chart-7` | `oklch(0.68 0.12 20)` | `#D97860` | genre |
| `--color-chart-8` | `oklch(0.62 0.04 220)` | `#6A7B84` | “other” / not streaming |

Heatmap (calendar): `--color-bg-raised` → `--color-accent-dim` → `--color-accent-muted` → `--color-accent`. Four steps, not a rainbow.

---

## Typography

**Family.** The screenshots are a geometric neo-grotesk. Exact webfont is not identifiable from pixels.

- **UI / body:** `Inter` (available locally and on Google Fonts). Closest match to the chrome.
- **Display (review headlines only):** `Outfit` at 600–700. Slightly more geometric so month names can carry weight without looking like a dashboard number. **Addition** — Inter remains the fallback.

Do not use a serif. Do not use the Trakt review’s condensed display face.

### Scale (px / line-height px)

Not a 1.25 modular scale. This is what the chrome actually does: a large display, a solid page title, then a tight jump into UI sizes.

| Token | Size | Line-height | Weight | Tracking | Where |
|---|---|---|---|---|---|
| `--text-display` | 56px | 60px | 700 | `-0.03em` | Month name, year-in-review hero |
| `--text-title` | 32px | 38px | 650 | `-0.02em` | Page titles (“Hygiene”, “History”) |
| `--text-title-sm` | 22px | 28px | 600 | `-0.015em` | Section titles (“Continue Watching”) |
| `--text-body` | 15px | 22px | 400 | `0` | Synopses, help text |
| `--text-ui` | 14px | 20px | 500 | `0` | Nav, buttons, list titles |
| `--text-meta` | 12px | 16px | 500 | `0.02em` | Year, runtime, `S02E07`, timestamps |
| `--text-label` | 11px | 14px | 600 | `0.08em` | ALL-CAPS overlines (`VIDEO`, `PLAYS`) |
| `--text-stat` | 40px | 44px | 650 | `-0.03em` | Headline numbers |

Caps labels in the settings/detail chrome are 11px, wide tracking, weight 600 — not 12px body shrunk.

Tabular lining numerals for every stat and timestamp (`font-variant-numeric: tabular-nums`).

---

## Spacing and radius

**Base unit:** 4px. Most layout uses 8 / 12 / 16 / 24 / 32 / 48.

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Badge padding, hairline offsets |
| `--space-2` | 8px | Icon gaps, chip padding |
| `--space-3` | 12px | Compact row padding |
| `--space-4` | 16px | Default card padding, poster caption gap |
| `--space-5` | 24px | Section padding, filter-row gap |
| `--space-6` | 32px | Page gutter (desktop) |
| `--space-8` | 48px | Between major review sections |
| `--space-10` | 64px | Hero-to-content |

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Badges, score chips |
| `--radius-md` | 10px | Buttons, inputs, filter chips |
| `--radius-lg` | 14px | Cards, posters, episode tiles |
| `--radius-xl` | 20px | Review hero / first-play panel |
| `--radius-full` | 999px | Nav pills, avatars, search field |

The language is **soft, not round-for-its-own-sake**. Posters and cards are `--radius-lg`. Search and profile status are fully pill. Buttons on detail pages are `--radius-md`, not capsules.

---

## Elevation

No material-style shadows.

1. **Hairline border** (`--color-border`) on raised surfaces.
2. **One step up in background** (base → raised → overlay).
3. **Glass**: `--color-glass` + `backdrop-filter: blur(16px)` on nav, search, metadata bars, floating action rows.
4. **Accent ring** (2px `--color-accent`) for the one selected thing (active episode card, active filter).
5. **Gold hairline** on a “needs a decision” card, as in Hygiene unknown titles.

Optional shadow, only on floating overlays: `0 8px 24px oklch(0.12 0.03 230 / 0.45)`. Do not put it on every card.

---

## Motion

Nothing in the screenshots implies bounce or long fades.

| Token | Value |
|---|---|
| `--duration-fast` | 150ms |
| `--duration-default` | 200ms |
| `--ease-default` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

Hover: 150ms background/border. Page-section enter: 200ms opacity + 4px translateY. Progress bars and job indicators: linear, no easing. Reduce-motion: opacity only.

---

## Density

Two densities, both visible in the source:

- **Cinema** (Home, reviews): large posters, 24–48px between sections, one thing in focus. This is the monthly/yearly review.
- **Ledger** (History, Settings): 12–16px row padding, 8px gutters, more text per viewport. This is the settings dashboard.

Do not stretch cinema density across Settings. Do not crush the review into a table.

Desktop is a real layout (sidebar or top-nav + wide content), not a stretched phone. Mobile keeps the same tokens; gutted to a single column, posters 2-up, review sections stacked. Status strip stays at the top.

---

## Additions (not in the screenshots)

These states do not appear in the tofa chrome. Extended in the same spirit:

| Need | Decision |
|---|---|
| Focus ring | 2px `--color-accent` offset 2px; never remove on `:focus-visible` |
| Disabled | 40% opacity, `not-allowed`, no hover lift |
| Error text | `--color-sync-failed` + icon; don’t rely on the input border alone |
| Empty state | Same as Hygiene “All caught up”: accent icon, one sentence, no zeroed charts |
| Skeleton | `--color-bg-overlay` pulse 1.2s, no shimmer rainbow |
| Selection in History | `--color-accent-dim` row fill + accent left bar |
| App auth / login | Same shell as Settings; no marketing illustration |

---

## Review information architecture

Visuals stay nocturnal-teal. Content taken from `monthinrecview*.png` plus `app-instructions.md` §7.4 / §7.5.

### Monthly

1. Period chrome: month name, prev/next, compact year strip.
2. Headline: plays, hours, movies vs episodes, days active, delta vs previous month.
3. **First play** — date, time, title, artwork. Signature moment.
4. **Last play** — same treatment, smaller.
5. Poster strip of titles in the month (visual index, not a ranking).
6. Service breakdown labeled **“Where this is available (estimated)”** — never “where you watched.” Flatrate vs rent/buy vs “Not currently streaming.”
7. Genre bars, **movies and TV separate**. Toggle plays ↔ hours. Tooltip: a title counts fully in every genre.
8. Daily activity histogram (1–31) + most active day + most common hour.
9. Hours and plays sparkline cards with per-week and per-day averages.
10. Ranked most-watched shows, then movies: rank, plays, time watched, still + poster.
11. Ratings block only if a ratings source is connected; otherwise omit.
12. Calendar heatmap of hours.
13. Empty month: designed empty, not a grid of zeros.
14. Export JSON / CSV.

### Yearly

Twelve-month totals and per-month sparklines, top genres, top services, top shows and movies, hours in human units (“14 full days”), busiest month, busiest day, longest binge, first and last play, new vs rewatch, month-by-month narrative, shareable image + JSON.

Skip Trakt-specific bits from the reference shots: comments, lists, “VIP”, “Trakt Worldwide”, “Directed by”.

---

## Tailwind v4 `@theme`

Implemented in [`app/globals.css`](../app/globals.css). Live samples: [`/styleguide`](../app/styleguide/page.tsx). Names must match this file.

```css
@theme {
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-display: Outfit, Inter, ui-sans-serif, sans-serif;

  --color-bg-base: oklch(0.180 0.029 229.1);
  --color-bg-nav: oklch(0.183 0.033 225.1);
  --color-bg-raised: oklch(0.213 0.025 234.7);
  --color-bg-overlay: oklch(0.256 0.028 238.5);
  --color-accent: oklch(0.757 0.111 182.5);
  --color-fg: oklch(0.985 0.002 230);
  --color-fg-muted: oklch(0.634 0.014 202.8);
  /* …remainder as tables above */

  --text-display: 56px;
  --text-title: 32px;
  --text-ui: 14px;
  --text-meta: 12px;
  --text-stat: 40px;

  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-full: 999px;

  --ease-default: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

---

## Paper

Open file: [Tofu & Trakt](https://app.paper.design/file/01M1Y5NSEM81RM6T392BQ3EA1R/1-0). Currently empty. Screens to lock before Phase 2:

1. Tokens / primitives styleguide — **shipped in-app** at `/styleguide`
2. Home
3. History
4. Monthly review (desktop + mobile)
5. Year in review
6. Settings (Connections, Sync, Data, About)
7. Login / first-run
8. Empty, error, needs-attention, backfill-preview

App chrome is **not** tofa’s Home / Browse / Discover. Watchlog nav: Home, History, Monthly, Year, Settings. The styleguide is out of the primary nav (linked from Settings → About).
