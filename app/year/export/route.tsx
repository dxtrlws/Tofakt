import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require";
import { timezone } from "@/lib/ingest/run";
import { parseYearParam } from "@/lib/stats/period";
import { loadYearBundle } from "@/lib/stats/year";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const year = parseYearParam(
    url.searchParams.get("year"),
    new Date(),
    timezone(),
  );
  const format = url.searchParams.get("format") === "png" ? "png" : "json";
  const { review, rows } = await loadYearBundle(year);
  if (format === "png") {
    return new ImageResponse(
      <YearCard
        days={review.fullDaysLabel}
        hours={review.hoursLabel}
        live={review.live}
        month={review.busiestMonth?.name ?? "—"}
        plays={review.plays}
        year={review.year}
      />,
      {
        width: 1200,
        height: 630,
        headers: {
          "content-disposition": `attachment; filename="watchlog-${year}.png"`,
        },
      },
    );
  }
  return NextResponse.json(
    {
      year: review.year,
      source: "trakt",
      plays: review.plays,
      hours: review.hoursLabel,
      fullDays: review.fullDaysLabel,
      busiestMonth: review.busiestMonth,
      newShare: review.newShare,
      rewatchShare: review.rewatchShare,
      first: review.first,
      last: review.last,
      binge: review.binge,
      busiestDay: review.busiestDay,
      months: review.months.map((month) => ({
        key: month.key,
        plays: month.plays,
        hours: month.hours,
      })),
      topShows: review.topShows,
      topMovies: review.topMovies,
      tvGenres: review.tvGenres,
      movieGenres: review.movieGenres,
      tvNetworks: review.tvNetworks,
      movieStudios: review.movieStudios,
      tvServices: review.tvServices,
      movieServices: review.movieServices,
      events: rows.map((row) => ({
        watchedAt: row.watchedAt.toISOString(),
        title: row.title,
        showTitle: row.showTitle,
        kind: row.kind,
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
        seconds: row.seconds,
      })),
    },
    {
      headers: {
        "content-disposition": `attachment; filename="watchlog-${year}.json"`,
      },
    },
  );
}

function YearCard({
  year,
  plays,
  hours,
  days,
  month,
  live,
}: {
  year: number;
  plays: number;
  hours: string;
  days: string;
  month: string;
  live: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#1c2a32",
        color: "#f4f7f8",
        padding: "64px 72px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            color: "#5dccb8",
            fontSize: 18,
            letterSpacing: 2,
          }}
        >
          WATCHLOG · YEAR IN REVIEW
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            marginTop: 12,
          }}
        >
          {year}
        </div>
        <div style={{ display: "flex", color: "#8aa0a8", fontSize: 28 }}>
          The equivalent of {days}
          {live ? " · live year so far" : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 48 }}>
        <CardStat label="Plays" value={String(plays)} />
        <CardStat label="Hours" value={hours} />
        <CardStat label="Busiest month" value={month} />
      </div>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          color: "#8aa0a8",
          fontSize: 18,
          letterSpacing: 2,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{ display: "flex", fontSize: 48, fontWeight: 600, marginTop: 8 }}
      >
        {value}
      </div>
    </div>
  );
}
