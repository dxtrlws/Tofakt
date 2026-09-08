import { randomUUID } from "node:crypto";

export type PendingDeviceFlow = {
  id: string;
  provider: "tofa" | "trakt";
  deviceCode: string;
  intervalMs: number;
  expiresAt: number;
  lastPollAt: number;
  userCode?: string;
  verificationUrl?: string;
  connectUrl?: string;
  serverId?: string;
  baseUrl?: string;
};

export type PendingFlowView = {
  id: string;
  userCode: string;
  verificationUrl: string;
  qrDataUrl: string | null;
  interval: number;
};

const pending = new Map<string, PendingDeviceFlow>();

export function savePendingFlow(
  flow: Omit<PendingDeviceFlow, "id" | "lastPollAt">,
): PendingDeviceFlow {
  const record: PendingDeviceFlow = {
    ...flow,
    id: randomUUID(),
    lastPollAt: 0,
  };
  pending.set(record.id, record);
  return record;
}

export function pendingFlowView(
  provider: PendingDeviceFlow["provider"],
): PendingFlowView | undefined {
  for (const flow of pending.values()) {
    if (flow.provider !== provider || !flow.userCode) {
      continue;
    }
    if (Date.now() > flow.expiresAt) {
      pending.delete(flow.id);
      continue;
    }
    return {
      id: flow.id,
      userCode: flow.userCode,
      verificationUrl: flow.verificationUrl ?? "",
      qrDataUrl: null,
      interval: Math.max(1, Math.round(flow.intervalMs / 1000)),
    };
  }
  return undefined;
}

export function getPendingFlow(id: string): PendingDeviceFlow | undefined {
  const flow = pending.get(id);
  if (!flow) {
    return undefined;
  }
  if (Date.now() > flow.expiresAt) {
    pending.delete(id);
    return undefined;
  }
  return flow;
}

export function deletePendingFlow(id: string): void {
  pending.delete(id);
}

export function markPolled(id: string, extraIntervalMs = 0): void {
  const flow = pending.get(id);
  if (!flow) {
    return;
  }
  flow.lastPollAt = Date.now();
  flow.intervalMs += extraIntervalMs;
}

export function shouldWait(flow: PendingDeviceFlow): number {
  const wait = flow.lastPollAt + flow.intervalMs - Date.now();
  return wait > 0 ? wait : 0;
}
