export const HISTORY_CHECK_COL =
  "flex w-9 shrink-0 items-center justify-center";
export const HISTORY_TIME_COL = "hidden w-[88px] shrink-0 md:block";
export const HISTORY_DURATION_COL = "hidden w-[72px] shrink-0 md:block";
export const HISTORY_BADGE_COL = "w-auto shrink-0 md:w-[120px]";
export const HISTORY_MENU_COL = "w-5 shrink-0";

const labelClass =
  "text-label font-semibold uppercase leading-label tracking-label text-fg-muted";

export function HistoryDayHeader({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center gap-4 px-3">
      <div className={HISTORY_CHECK_COL} />
      <div className="w-10 shrink-0" />
      <h2 className={`min-w-0 grow basis-0 ${labelClass}`}>{label}</h2>
      <p className={`${HISTORY_TIME_COL} ${labelClass}`}>Time</p>
      <p className={`${HISTORY_DURATION_COL} ${labelClass}`}>Duration</p>
      <div className={HISTORY_BADGE_COL} />
      <div className={HISTORY_MENU_COL} />
    </div>
  );
}
