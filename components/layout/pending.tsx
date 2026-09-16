/**
 * Fallbacks for the review sections that wait on TMDB.
 *
 * Each one mirrors the layout of the section it stands in for, so the page does
 * not jump when the real content streams in, and carries a live-region caption
 * saying what is still being fetched.
 */

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton block ${className}`}
      style={style}
    />
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="busy-spinner size-3 shrink-0 animate-spin"
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

export function PendingNote({ label }: { label: string }) {
  return (
    <output className="flex items-center gap-2 text-meta leading-meta text-fg-muted">
      <Spinner />
      {label}
    </output>
  );
}

export function PosterRailPending({ heading }: { heading: string }) {
  return (
    <section className="flex flex-col gap-4 px-4 md:px-8 pt-10">
      <h2 className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
        {heading}
      </h2>
      <PendingNote label="Loading artwork from TMDB…" />
      <div className="flex gap-4 overflow-hidden">
        {RAIL.map((slot) => (
          <div className="flex w-[168px] shrink-0 flex-col gap-2.5" key={slot}>
            <Skeleton className="h-[252px] w-[168px] rounded-lg border border-border" />
            <Skeleton className="h-3.5 w-28 rounded-sm" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function MomentPending({
  label,
  size = "feature",
}: {
  label: string;
  size?: "feature" | "ranked";
}) {
  const featured = size === "feature";
  return (
    <section className="relative mx-4 mt-5 flex items-end gap-3 overflow-hidden md:mx-8 md:mt-10 md:rounded-xl md:border md:border-border">
      <div
        className={`relative flex min-h-0 w-full items-end gap-3 md:p-6 ${
          featured ? "md:min-h-[280px] md:gap-8" : "md:min-h-[200px] md:gap-6"
        }`}
      >
        <Skeleton
          className={`shrink-0 rounded-md md:rounded-lg ${
            featured
              ? "h-[108px] w-[72px] md:h-[222px] md:w-[148px]"
              : "h-[108px] w-[72px] md:h-[168px] md:w-[112px]"
          }`}
        />
        <div className="flex min-w-0 grow basis-0 flex-col gap-2 pb-1">
          <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
            {label}
          </p>
          <Skeleton className="h-7 w-52 max-w-full rounded-sm md:h-10 md:w-80" />
          <Skeleton className="h-3.5 w-40 max-w-full rounded-sm" />
          <PendingNote label="Loading artwork from TMDB…" />
        </div>
      </div>
    </section>
  );
}

export function RankedListPending({ label }: { label: string }) {
  return (
    <div className="flex w-full flex-col">
      <MomentPending label={label} />
      {RANKED.map((slot, index) => (
        <MomentPending
          key={slot}
          label={String(index + 2).padStart(2, "0")}
          size="ranked"
        />
      ))}
    </div>
  );
}

export function Top10Pending({ title }: { title: string }) {
  return (
    <section className="flex w-full flex-col gap-5 px-4 md:px-8 pt-10">
      <h2 className="whitespace-pre-line font-headline text-title font-semibold leading-[1.05] tracking-title text-fg md:text-stat md:leading-stat">
        {title}
      </h2>
      <PendingNote label="Loading artwork from TMDB…" />
      <div className="flex w-full flex-col gap-5 lg:flex-row">
        {COLUMNS.map((column) => (
          <div
            className="flex min-w-0 grow basis-0 flex-col gap-3"
            key={column}
          >
            {RANKED.map((slot) => (
              <div
                className="flex w-full items-center gap-3 rounded-md bg-accent-dim px-3 py-[10px]"
                key={slot}
              >
                <Skeleton className="h-14 w-10 shrink-0 rounded-sm" />
                <div className="flex min-w-0 grow basis-0 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-40 max-w-full rounded-sm" />
                  <Skeleton className="h-3 w-24 max-w-full rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function NamedBarsPending({
  eyebrow,
  title,
  countLabel,
}: {
  eyebrow?: string;
  title: string;
  countLabel: string;
}) {
  return (
    <section className="flex flex-col gap-8 px-4 md:px-8 pt-10">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          {eyebrow ? (
            <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="whitespace-pre-line font-headline text-title font-semibold leading-[1.05] tracking-title text-fg md:text-stat md:leading-stat">
            {title}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1 pb-1">
          <Skeleton className="h-10 w-12 rounded-sm" />
          <p className="text-meta leading-meta text-fg-muted">{countLabel}</p>
        </div>
      </div>
      <PendingNote label={`Loading ${countLabel} from TMDB…`} />
      <div className="flex flex-col gap-4">
        {BARS.map((slot, index) => (
          <div className="flex flex-col gap-2" key={slot}>
            <Skeleton className="h-3.5 w-32 rounded-sm" />
            {/* Staggered widths read as a bar chart rather than a block. */}
            <Skeleton
              className="h-3 rounded-full"
              style={{ width: `${String(90 - index * 14)}%` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

const RAIL = ["a", "b", "c", "d", "e", "f"];
const RANKED = ["a", "b", "c", "d", "e"];
const COLUMNS = ["left", "right"];
const BARS = ["a", "b", "c", "d", "e"];
