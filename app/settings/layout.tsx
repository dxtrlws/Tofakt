import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  return (
    <AppShell current="settings" username={user.username}>
      <main className="flex flex-1 flex-col" id="main-content" tabIndex={-1}>
        <div className="flex flex-col gap-2 px-4 pt-6 md:px-8">
          <p className="text-label font-semibold uppercase leading-label tracking-label text-accent">
            Configuration
          </p>
          <h1 className="font-headline text-title font-bold leading-title tracking-title">
            Settings
          </h1>
        </div>
        {children}
      </main>
    </AppShell>
  );
}
