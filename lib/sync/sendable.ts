export function shouldPostRecord(input: {
  status: string;
  skipReason: string | null;
}): boolean {
  if (input.status === "synced" || input.status === "syncing") {
    return false;
  }
  if (input.skipReason === "user_ignored") {
    return false;
  }
  return true;
}
