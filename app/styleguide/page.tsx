import { AppShell } from "@/components/layout/app-shell";
import { StyleGuide } from "@/components/styleguide/guide";
import { requireUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

export default async function StyleguidePage() {
  const user = await requireUser();

  return (
    <AppShell username={user.username}>
      <main className="flex flex-1 flex-col" id="main-content" tabIndex={-1}>
        <StyleGuide />
      </main>
    </AppShell>
  );
}
