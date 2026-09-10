import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { login } from "@/lib/auth/actions";
import { getSessionUser, needsSetup } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (needsSetup()) {
    redirect("/setup");
  }
  if (await getSessionUser()) {
    redirect("/");
  }

  return (
    <AuthShell
      title="Sign in"
      copy="Local admin. Same machine, same password you set on first run."
    >
      <AuthForm action={login} mode="login" />
    </AuthShell>
  );
}
