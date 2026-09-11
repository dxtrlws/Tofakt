import { takeToastCookie } from "@/lib/toast/persist";
import { Toaster } from "./toaster";

export function ToastSeedHost() {
  return <Toaster seed={takeToastCookie()} />;
}
