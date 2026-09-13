import { z } from "zod";
import { logger } from "../logger";
import { fetchJson, UpstreamError } from "../net/fetch-json";
import {
  canonicalVersion,
  compareSemver,
  compareVersionStrings,
  parseSemver,
  type SemVer,
} from "./semver";

export const WATCHLOG_IMAGE = "ghcr.io/dxtrlws/watchlog";
export const WATCHLOG_GITHUB_REPO_DEFAULT = "dxtrlws/Tofakt-";

const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 4000;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const releaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string().optional(),
  prerelease: z.boolean().optional(),
  draft: z.boolean().optional(),
});

const tagsSchema = z.array(
  z.object({
    name: z.string(),
  }),
);

export type GithubUpdateKind =
  | "current"
  | "available"
  | "ahead"
  | "needs_auth"
  | "error";

export type GithubUpdate = {
  kind: GithubUpdateKind;
  label: string;
  latestVersion?: string;
  href?: string;
  detail?: string;
};

type RemoteOk = {
  status: "ok";
  version: string;
  href?: string;
  at: number;
};

type RemoteFail = {
  status: "needs_auth" | "error";
  at: number;
};

type Remote = RemoteOk | RemoteFail;

export type UpdateCheckEnv = {
  disabled: boolean;
  apiBase: string;
  repo: string;
  token?: string;
};

export type UpdateCheckHost = {
  fetchJson: typeof fetchJson;
  now: () => number;
  env: UpdateCheckEnv;
};

let cache: Remote | undefined;

export function resetUpdateCheckCache(): void {
  cache = undefined;
}

export function readUpdateCheckEnv(
  source: Record<string, string | undefined> = process.env,
): UpdateCheckEnv {
  const repoRaw = source.WATCHLOG_GITHUB_REPO?.trim();
  const repo =
    repoRaw && REPO_RE.test(repoRaw) ? repoRaw : WATCHLOG_GITHUB_REPO_DEFAULT;
  const api = source.WATCHLOG_GITHUB_API_URL?.trim().replace(/\/$/, "");
  const token =
    source.WATCHLOG_GITHUB_TOKEN?.trim() || source.GITHUB_TOKEN?.trim();
  return {
    disabled: source.WATCHLOG_DISABLE_UPDATE_CHECK === "1",
    apiBase: api || "https://api.github.com",
    repo,
    token: token || undefined,
  };
}

function githubHref(repo: string, tag: string, htmlUrl?: string): string {
  if (htmlUrl?.startsWith("https://github.com/")) {
    return htmlUrl;
  }
  return `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`;
}

function present(
  current: string,
  remote: Remote,
  image = WATCHLOG_IMAGE,
): GithubUpdate {
  if (remote.status === "ok") {
    const latest = remote.version;
    const order = compareVersionStrings(current, latest);
    if (order === "available") {
      return {
        kind: "available",
        label: `${latest} available`,
        latestVersion: latest,
        href: remote.href,
        detail: `Pull ${image}:${latest} (or :latest) and recreate the container.`,
      };
    }
    if (order === "ahead") {
      return {
        kind: "ahead",
        label: "Unreleased",
        latestVersion: latest,
        href: remote.href,
      };
    }
    return {
      kind: "current",
      label: "Up to date",
      latestVersion: latest,
      href: remote.href,
    };
  }
  if (remote.status === "needs_auth") {
    return {
      kind: "needs_auth",
      label: "Private repo",
      detail:
        "This GitHub repo is private. Set WATCHLOG_GITHUB_TOKEN on the container to check for new releases.",
    };
  }
  return {
    kind: "error",
    label: "Couldn't check",
  };
}

function headers(token?: string): HeadersInit {
  const next: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  if (token) {
    next.authorization = `Bearer ${token}`;
  }
  return next;
}

function pickLatestTag(names: string[]): string | undefined {
  let bestName: string | undefined;
  let best: SemVer | undefined;
  for (const name of names) {
    const version = parseSemver(name);
    if (!version) {
      continue;
    }
    if (!best || compareSemver(version, best) > 0) {
      best = version;
      bestName = name;
    }
  }
  return bestName ? canonicalVersion(bestName) : undefined;
}

function ttl(remote: Remote): number {
  return remote.status === "ok" ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
}

function defaultHost(): UpdateCheckHost {
  return {
    fetchJson,
    now: () => Date.now(),
    env: readUpdateCheckEnv(),
  };
}

async function fetchLatest(host: UpdateCheckHost): Promise<Remote> {
  const { apiBase, repo, token } = host.env;
  const at = host.now();
  try {
    const latest = await host.fetchJson(
      `${apiBase}/repos/${repo}/releases/latest`,
      { cache: "no-store", headers: headers(token) },
      TIMEOUT_MS,
    );
    if (latest.status === 200) {
      const parsed = releaseSchema.safeParse(latest.json);
      if (
        parsed.success &&
        !parsed.data.draft &&
        !parsed.data.prerelease &&
        parseSemver(parsed.data.tag_name)
      ) {
        const tag = parsed.data.tag_name;
        return {
          status: "ok",
          version: canonicalVersion(tag),
          href: githubHref(repo, tag, parsed.data.html_url),
          at,
        };
      }
    }
    if (latest.status === 404 && !token) {
      return { status: "needs_auth", at };
    }
    if (latest.status === 401 || latest.status === 403) {
      return { status: token ? "error" : "needs_auth", at };
    }
    if (latest.status === 404 || latest.status === 200) {
      const tags = await host.fetchJson(
        `${apiBase}/repos/${repo}/tags?per_page=30`,
        { cache: "no-store", headers: headers(token) },
        TIMEOUT_MS,
      );
      if (tags.status === 200) {
        const parsed = tagsSchema.safeParse(tags.json);
        const name = parsed.success
          ? pickLatestTag(parsed.data.map((row) => row.name))
          : undefined;
        if (name) {
          return {
            status: "ok",
            version: name,
            href: githubHref(repo, `v${name}`),
            at,
          };
        }
      }
      if (tags.status === 401 || tags.status === 403 || tags.status === 404) {
        return { status: token ? "error" : "needs_auth", at };
      }
    }
    return { status: "error", at };
  } catch (err) {
    if (!(err instanceof UpstreamError)) {
      logger.debug({ err, repo }, "GitHub update check failed");
    }
    return { status: "error", at };
  }
}

export async function checkForGithubUpdate(
  current: string,
  host?: Partial<UpdateCheckHost>,
): Promise<GithubUpdate | null> {
  const resolved: UpdateCheckHost = {
    ...defaultHost(),
    ...host,
    env: host?.env ?? readUpdateCheckEnv(),
  };
  if (resolved.env.disabled) {
    return null;
  }
  const now = resolved.now();
  if (!cache || now - cache.at >= ttl(cache)) {
    cache = await fetchLatest(resolved);
  }
  return present(current, cache);
}
