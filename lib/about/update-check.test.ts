import { afterEach, describe, expect, it } from "vitest";
import { UpstreamError } from "../net/fetch-json";
import {
  checkForGithubUpdate,
  readUpdateCheckEnv,
  resetUpdateCheckCache,
  type UpdateCheckEnv,
  type UpdateCheckHost,
} from "./update-check";

const env: UpdateCheckEnv = {
  disabled: false,
  apiBase: "http://github.test",
  repo: "dxtrlws/Tofakt-",
};

function jsonResult(
  status: number,
  json: unknown,
  headers: Record<string, string> = {},
) {
  return {
    status,
    json,
    text: JSON.stringify(json),
    headers,
  };
}

function host(
  responses: Array<{ url: string; result: ReturnType<typeof jsonResult> }>,
  extra?: Partial<UpdateCheckEnv>,
): UpdateCheckHost {
  return {
    now: () => 1_000,
    env: { ...env, ...extra },
    fetchJson: async (url: string) => {
      const next = responses.shift();
      if (!next) {
        throw new Error(`unexpected fetch ${url}`);
      }
      expect(url).toBe(next.url);
      return next.result;
    },
  };
}

afterEach(() => {
  resetUpdateCheckCache();
});

describe("readUpdateCheckEnv", () => {
  it("defaults to the Watchlog GitHub repo", () => {
    expect(readUpdateCheckEnv({})).toEqual({
      disabled: false,
      apiBase: "https://api.github.com",
      repo: "dxtrlws/Tofakt-",
      token: undefined,
    });
  });

  it("accepts a token and ignores a malformed repo override", () => {
    expect(
      readUpdateCheckEnv({
        WATCHLOG_GITHUB_TOKEN: " ghp_secret ",
        WATCHLOG_GITHUB_REPO: "https://evil.example",
        WATCHLOG_DISABLE_UPDATE_CHECK: "1",
      }),
    ).toMatchObject({
      disabled: true,
      repo: "dxtrlws/Tofakt-",
      token: "ghp_secret",
    });
  });
});

describe("checkForGithubUpdate", () => {
  it("skips the lookup when disabled", async () => {
    const result = await checkForGithubUpdate("0.2.1", {
      env: { ...env, disabled: true },
      fetchJson: async () => {
        throw new Error("should not fetch");
      },
    });
    expect(result).toBeNull();
  });

  it("reports a newer GitHub release", async () => {
    const result = await checkForGithubUpdate(
      "0.2.1",
      host([
        {
          url: "http://github.test/repos/dxtrlws/Tofakt-/releases/latest",
          result: jsonResult(200, {
            tag_name: "v0.2.2",
            html_url: "https://github.com/dxtrlws/Tofakt-/releases/tag/v0.2.2",
            prerelease: false,
            draft: false,
          }),
        },
      ]),
    );
    expect(result).toMatchObject({
      kind: "available",
      label: "0.2.2 available",
      href: "https://github.com/dxtrlws/Tofakt-/releases/tag/v0.2.2",
    });
    expect(result?.detail).toContain("ghcr.io/dxtrlws/watchlog:0.2.2");
  });

  it("reports up to date when the installed version matches", async () => {
    const result = await checkForGithubUpdate(
      "0.2.2",
      host([
        {
          url: "http://github.test/repos/dxtrlws/Tofakt-/releases/latest",
          result: jsonResult(200, { tag_name: "v0.2.2" }),
        },
      ]),
    );
    expect(result?.kind).toBe("current");
    expect(result?.label).toBe("Up to date");
  });

  it("falls back to tags when no GitHub release exists", async () => {
    const result = await checkForGithubUpdate(
      "0.1.0",
      host(
        [
          {
            url: "http://github.test/repos/dxtrlws/Tofakt-/releases/latest",
            result: jsonResult(404, { message: "Not Found" }),
          },
          {
            url: "http://github.test/repos/dxtrlws/Tofakt-/tags?per_page=30",
            result: jsonResult(200, [
              { name: "v0.1.7" },
              { name: "v0.2.0" },
              { name: "notes" },
            ]),
          },
        ],
        { token: "ghp_ok" },
      ),
    );
    expect(result).toMatchObject({
      kind: "available",
      label: "0.2.0 available",
    });
  });

  it("asks for a token when the private repo 404s without one", async () => {
    const result = await checkForGithubUpdate(
      "0.2.1",
      host([
        {
          url: "http://github.test/repos/dxtrlws/Tofakt-/releases/latest",
          result: jsonResult(404, { message: "Not Found" }),
        },
      ]),
    );
    expect(result?.kind).toBe("needs_auth");
    expect(result?.label).toBe("Private repo");
  });

  it("reuses a cached GitHub response", async () => {
    let fetches = 0;
    const shared: UpdateCheckHost = {
      now: () => 1_000,
      env,
      fetchJson: async () => {
        fetches += 1;
        return jsonResult(200, { tag_name: "v0.2.2" });
      },
    };
    await checkForGithubUpdate("0.2.1", shared);
    const second = await checkForGithubUpdate("0.2.1", shared);
    expect(fetches).toBe(1);
    expect(second?.kind).toBe("available");
  });

  it("degrades when GitHub is unreachable", async () => {
    const result = await checkForGithubUpdate("0.2.1", {
      now: () => 1_000,
      env,
      fetchJson: async () => {
        throw new UpstreamError("Could not reach the remote service.", 502);
      },
    });
    expect(result).toEqual({ kind: "error", label: "Couldn't check" });
  });
});
