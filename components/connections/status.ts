export function statusClass(status: string): string {
  if (status === "ok") {
    return "text-status-ok";
  }
  if (status === "warn") {
    return "text-status-warn";
  }
  if (status === "down") {
    return "text-status-down";
  }
  return "text-status-unknown";
}

export function statusDotClass(status: string): string {
  if (status === "ok") {
    return "bg-status-ok";
  }
  if (status === "warn") {
    return "bg-status-warn";
  }
  if (status === "down") {
    return "bg-status-down";
  }
  return "bg-status-unknown";
}

export function statusLabel(status: string, fallback: string): string {
  if (status === "ok") {
    return fallback;
  }
  if (status === "warn") {
    return fallback || "Needs setup";
  }
  if (status === "down") {
    return "Unreachable";
  }
  return "Unknown";
}
