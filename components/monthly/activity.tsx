import type { MonthReview } from "@/lib/stats/month";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthActivity({ review }: { review: MonthReview }) {
  const maxDay = Math.max(...review.daily, 1);
  return (
    <section className="flex flex-col gap-8 px-4 md:px-8 pt-10">
      <div className="flex flex-col gap-4">
        <h2 className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
          Daily activity
        </h2>
        <div
          aria-label={`Daily plays for ${review.name}. Peak ${maxDay} ${maxDay === 1 ? "play" : "plays"} in a day.`}
          className="flex h-32 items-end gap-1"
          role="img"
        >
          {review.daily.map((count, index) => (
            <div
              className={`min-w-0 grow basis-0 rounded-sm ${
                count === 0 ? "bg-bg-overlay" : "bg-chart-1"
              }`}
              key={`d-${index + 1}`}
              style={{
                height: count === 0 ? 4 : Math.max(8, (count / maxDay) * 128),
              }}
              title={`${count} ${count === 1 ? "play" : "plays"}`}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-bg-raised p-5">
          <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
            Hours
          </p>
          <p className="pt-2 text-stat font-semibold leading-8 tracking-display text-fg">
            {review.hoursPerActiveDay}
          </p>
          <p className="text-meta leading-meta text-fg-muted">per active day</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-raised p-5">
          <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
            Plays
          </p>
          <p className="pt-2 text-stat font-semibold leading-8 tracking-display text-fg">
            {review.playsPerActiveDay}
          </p>
          <p className="text-meta leading-meta text-fg-muted">per active day</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
          Hours by day
        </h2>
        <div
          aria-label="Hours watched by weekday across weeks of the month"
          className="overflow-x-auto"
          role="img"
        >
          <div className="flex gap-3">
            <div className="flex flex-col justify-between py-0.5 text-label text-fg-muted">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="flex gap-1">
              {review.heatmapHours[0]?.map((_, week) => (
                <div
                  className="flex flex-col gap-1"
                  key={`week-${String(week)}`}
                >
                  {WEEKDAYS.map((day) => {
                    const row = WEEKDAYS.indexOf(day);
                    const hours = review.heatmapHours[row]?.[week] ?? 0;
                    return (
                      <span
                        className={`size-4 rounded-sm ${heatClass(hours)}`}
                        key={`${day}-${String(week)}`}
                        title={`${hours.toFixed(1)} hours`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function heatClass(hours: number): string {
  if (hours <= 0) {
    return "bg-bg-overlay";
  }
  if (hours < 1) {
    return "bg-accent-dim";
  }
  if (hours < 3) {
    return "bg-accent-muted";
  }
  return "bg-accent";
}
