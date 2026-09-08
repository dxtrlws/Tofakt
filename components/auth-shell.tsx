import type { ReactNode } from "react";

function Mark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-[22px] w-[22px] rounded-sm bg-accent" />
      <span className="text-title-sm font-semibold leading-title-sm tracking-title-sm text-fg">
        watchlog
      </span>
    </div>
  );
}

export function AuthShell({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main
        className="flex flex-1 items-center justify-center px-4 py-10 md:px-6 md:py-16"
        id="main-content"
        tabIndex={-1}
      >
        <section className="flex w-full max-w-[420px] flex-col gap-5 rounded-lg border border-border bg-bg-raised p-6 md:p-10">
          <Mark />
          <h1 className="font-headline text-title font-bold leading-title tracking-title text-fg">
            {title}
          </h1>
          <p className="text-ui leading-ui text-fg-muted">{copy}</p>
          {children}
        </section>
      </main>
    </>
  );
}
