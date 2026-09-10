import { MonthMomentCard } from "@/components/monthly/first-play";
import type { MonthRanked as RankedTitle } from "@/lib/stats/month";

export function MonthTopFive({
  label,
  items,
}: {
  label: string;
  items: RankedTitle[];
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex w-full flex-col">
      {items.slice(0, 5).map((item, index) => (
        <MonthMomentCard
          accent={index === 0}
          className={
            index === 0
              ? undefined
              : "relative mx-4 mt-5 flex items-end gap-3 overflow-hidden md:mx-8 md:mt-8 md:rounded-xl md:border md:border-border"
          }
          heading={index === 0 ? "h2" : "h3"}
          key={item.title}
          label={index === 0 ? label : String(index + 1).padStart(2, "0")}
          moment={{
            title: item.title,
            line: item.note,
            when: hoursLine(item.hoursLabel),
            artworkUrl: item.artworkUrl,
            backdropUrl: item.backdropUrl,
          }}
          size={index === 0 ? "feature" : "ranked"}
          unmatched={item.unmatched}
        />
      ))}
    </div>
  );
}

function hoursLine(hoursLabel: string): string {
  return hoursLabel === "1" ? "1 hour" : `${hoursLabel} hours`;
}
