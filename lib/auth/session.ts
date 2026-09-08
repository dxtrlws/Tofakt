import { createHash, randomBytes } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";
import { env, isAuthDisabled } from "../env";

export const SESSION_COOKIE = "watchlog_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  username: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function countUsers(): number {
  return getDb().select({ n: count() }).from(users).get()?.n ?? 0;
}

export function needsSetup(): boolean {
  if (isAuthDisabled()) {
    return false;
  }
  return countUsers() === 0;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  getDb()
    .insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      createdAt: new Date(now),
      expiresAt: new Date(now + SESSION_TTL_MS),
    })
    .run();
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure =
    env().BASE_URL?.startsWith("https://") === true || proto === "https";
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb()
      .delete(sessions)
      .where(eq(sessions.id, hashToken(token)))
      .run();
  }
  await clearSessionCookie();
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isAuthDisabled()) {
    return { id: "auth-disabled", username: "local" };
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const row = getDb()
    .select({
      userId: users.id,
      username: users.username,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashToken(token)))
    .get();
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) {
      getDb()
        .delete(sessions)
        .where(eq(sessions.id, hashToken(token)))
        .run();
    }
    return null;
  }
  return { id: row.userId, username: row.username };
}
