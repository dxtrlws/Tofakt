export function YearEmpty({
  year,
  connected,
}: {
  year: number;
  connected: boolean;
}) {
  return (
    <section className="flex flex-col items-start gap-3 px-4 md:px-8 pt-20">
      <span className="size-7 shrink-0 rounded-full border border-accent-muted bg-accent-dim" />
      <h2 className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
        {connected
          ? `No Trakt plays in ${year}`
          : "Connect Trakt to load this year"}
      </h2>
      <p className="max-w-[480px] text-body leading-body text-fg-muted">
        {connected
          ? "Year in review is built from your Trakt history. It stays quiet until there is a play."
          : "Yearly numbers come from your Trakt history, not tofa. Connect Trakt in Settings to see them."}
      </p>
    </section>
  );
}
