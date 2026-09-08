import Link from "next/link";
import type {
  HistoryKindFilter,
  HistoryStateFilter,
} from "@/lib/history/query";

export function HistoryFilters({
  kind,
  state,
  q,
}: {
  kind: HistoryKindFilter;
  state: HistoryStateFilter;
  q: string;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 px-4 pt-5 md:px-8">
      <Pill href={href({ kind: "all", state, q })} active={kind === "all"}>
        All
      </Pill>
      <Pill
        href={href({ kind: "movies", state, q })}
        active={kind === "movies"}
      >
        Movies
      </Pill>
      <Pill href={href({ kind: "tv", state, q })} active={kind === "tv"}>
        TV
      </Pill>
      <span className="inline-block h-5 w-px shrink-0 bg-border" />
      <Pill
        href={href({ kind, state: "synced", q })}
        active={state === "synced"}
      >
        Synced
      </Pill>
      <Pill
        href={href({ kind, state: "pending", q })}
        active={state === "pending"}
      >
        Pending
      </Pill>
      <Pill
        href={href({ kind, state: "failed", q })}
        active={state === "failed"}
      >
        Failed
      </Pill>
      <Pill
        href={href({ kind, state: "unmatched", q })}
        active={state === "unmatched"}
      >
        Unmatched
      </Pill>
      <Pill
        href={href({ kind, state: "skipped", q })}
        active={state === "skipped"}
      >
        Not synced
      </Pill>
      <div className="grow basis-0" />
      <form action="/history" className="w-full shrink-0 sm:w-[240px]">
        {kind !== "all" ? (
          <input name="kind" type="hidden" value={kind} />
        ) : null}
        {state !== "pending" ? (
          <input name="state" type="hidden" value={state} />
        ) : null}
        <input
          className="w-full rounded-md border border-border bg-bg-raised px-3.5 py-2 text-ui leading-[18px] text-fg outline-none placeholder:text-fg-muted"
          defaultValue={q}
          name="q"
          placeholder="Search titles"
          aria-label="Search titles"
          type="search"
        />
      </form>
    </div>
  );
}

function href(opts: {
  kind: HistoryKindFilter;
  state: HistoryStateFilter;
  q: string;
}): string {
  const params = new URLSearchParams();
  if (opts.kind !== "all") {
    params.set("kind", opts.kind);
  }
  if (opts.state !== "pending") {
    params.set("state", opts.state);
  }
  if (opts.q) {
    params.set("q", opts.q);
  }
  const qs = params.toString();
  return qs ? `/history?${qs}` : "/history";
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      className={`rounded-full px-3.5 py-2 text-ui leading-[18px] ${
        active
          ? "bg-bg-overlay-strong font-semibold text-fg"
          : "font-medium text-fg-muted"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}
