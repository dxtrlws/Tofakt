export function RouteSkeleton() {
  return (
    <div className="flex min-h-full flex-col pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="flex h-[34px] shrink-0 items-center justify-between bg-bg-nav px-4 md:h-16 md:border-b md:border-border md:px-6">
        <div className="flex items-center gap-2">
          <span className="size-[18px] rounded-sm bg-accent" />
          <span className="h-3.5 w-20 rounded-sm bg-bg-overlay-strong" />
        </div>
        <span className="h-3 w-16 rounded-sm bg-bg-overlay" />
      </div>
      <div className="flex flex-1 flex-col gap-4 px-4 pt-4 md:px-8 md:pt-8">
        <div className="flex gap-2">
          <span className="h-16 grow rounded-md border border-border bg-bg-raised" />
          <span className="h-16 grow rounded-md border border-border bg-bg-raised" />
        </div>
        <span className="h-3 w-32 rounded-sm bg-bg-overlay" />
        <div className="flex gap-4 overflow-hidden">
          <span className="h-[210px] w-[140px] shrink-0 rounded-lg bg-bg-raised" />
          <span className="h-[210px] w-[140px] shrink-0 rounded-lg bg-bg-raised" />
        </div>
        <span className="mt-4 h-3 w-40 rounded-sm bg-bg-overlay" />
        <span className="h-8 w-48 rounded-sm bg-bg-overlay-strong" />
        <span className="h-3 w-56 rounded-sm bg-bg-overlay" />
      </div>
      <nav
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-border bg-bg-nav px-3 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <span className="h-3 w-8 rounded-sm bg-bg-overlay-strong" />
        <span className="h-3 w-10 rounded-sm bg-bg-overlay" />
        <span className="h-3 w-12 rounded-sm bg-bg-overlay" />
        <span className="h-3 w-7 rounded-sm bg-bg-overlay" />
        <span className="h-3 w-12 rounded-sm bg-bg-overlay" />
      </nav>
    </div>
  );
}
