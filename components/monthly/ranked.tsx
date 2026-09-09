import { YearTop10 } from "@/components/year/ranked";
import type { MonthRanked as RankedTitle } from "@/lib/stats/month";

export function MonthTopFive({
  title,
  items,
}: {
  title: string;
  items: RankedTitle[];
}) {
  return <YearTop10 headline items={items} limit={5} title={title} />;
}
