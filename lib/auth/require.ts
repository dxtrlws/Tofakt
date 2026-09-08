import { redirect } from "next/navigation";
import { getSessionUser, needsSetup } from "./session";

export async function requireUser() {
  if (needsSetup()) {
    redirect("/setup");
  }
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
