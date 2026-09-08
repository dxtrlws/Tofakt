import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { setupAdmin } from "@/lib/auth/actions";
import { getSessionUser, needsSetup } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!needsSetup()) {
    if (await getSessionUser()) {
      redirect("/");
    }
    redirect("/login");
  }

  return (
    <AuthShell
      title="Create the admin"
      copy="One local account. This is not Trakt or tofa. The password never leaves this machine."
    >
      <AuthForm action={setupAdmin} mode="setup" />
    </AuthShell>
  );
}
