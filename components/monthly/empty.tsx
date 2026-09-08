export function MonthEmpty({
  name,
  connected,
}: {
  name: string;
  connected: boolean;
}) {
  return (
    <section className="flex flex-col items-start gap-3 px-4 md:px-8 pt-20">
      <span className="size-7 shrink-0 rounded-full border border-accent-muted bg-accent-dim" />
      <h2 className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
        {connected
          ? `No Trakt plays in ${name}`
          : "Connect Trakt to load this month"}
      </h2>
      <p className="max-w-[480px] text-body leading-body text-fg-muted">
        {connected
          ? "Reviews stay quiet until there is a play. No zeroed charts, no empty heatmap."
          : "Monthly numbers come from your Trakt history. Connect Trakt in Settings to see them."}
      </p>
    </section>
  );
}
