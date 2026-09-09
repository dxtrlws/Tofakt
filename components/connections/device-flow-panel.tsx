"use client";

import { useEffect, useState } from "react";
import {
  type ConnectionActionState,
  pollDeviceFlow,
} from "@/lib/connections/actions";

export function DeviceFlowPanel({
  flow,
  onDone,
}: {
  flow: NonNullable<ConnectionActionState["flow"]>;
  onDone: () => void;
}) {
  const [message, setMessage] = useState("Waiting for approval…");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const result = await pollDeviceFlow(flow.id);
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      if (
        result.info === "tofa connected." ||
        result.info === "Trakt connected."
      ) {
        onDone();
        return;
      }
      setMessage(result.info ?? "Waiting for approval…");
    };
    const id = window.setInterval(() => {
      void tick();
    }, Math.max(flow.interval, 1) * 1000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [flow.id, flow.interval, onDone]);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-overlay p-4">
      <p className="text-ui leading-[18px] text-fg">
        Open the link and approve this app. This page waits until that finishes.
      </p>
      <p className="font-headline text-title-sm font-semibold tracking-title-sm">
        {flow.userCode}
      </p>
      <a
        className="text-ui text-accent"
        href={flow.verificationUrl}
        rel="noreferrer"
        target="_blank"
      >
        {flow.verificationUrl}
      </a>
      {flow.qrDataUrl ? (
        // biome-ignore lint/performance/noImgElement: QR is a data URL from the device flow
        <img
          alt="Device flow QR code"
          className="h-[168px] w-[168px] rounded-md bg-bg-inverse"
          height={168}
          src={flow.qrDataUrl}
          width={168}
        />
      ) : null}
      <p className="text-meta text-fg-muted">{error ?? message}</p>
    </div>
  );
}
