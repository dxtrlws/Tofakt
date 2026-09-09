export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function fetchJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<{
  status: number;
  json: unknown;
  text: string;
  headers: Record<string, string>;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "watchlog/0.1.1",
        ...init.headers,
      },
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return { status: response.status, json, text, headers };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamError("Timed out talking to the remote service.", 504);
    }
    throw new UpstreamError("Could not reach the remote service.", 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBytes(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<{ status: number; bytes: Buffer; contentType: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "watchlog/0.1.1",
        ...init.headers,
      },
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      bytes,
      contentType: response.headers.get("content-type"),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamError("Timed out talking to the remote service.", 504);
    }
    throw new UpstreamError("Could not reach the remote service.", 502);
  } finally {
    clearTimeout(timer);
  }
}
