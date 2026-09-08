"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "../db";
import { users } from "../db/schema";
import { isAuthDisabled } from "../env";
import { logger } from "../logger";
import { assertSameOrigin } from "./csrf";
import { hashPassword, verifyPassword } from "./password";
import { takeToken } from "./rate-limit";
import {
  clearSessionCookie,
  countUsers,
  createSession,
  destroySession,
  setSessionCookie,
} from "./session";

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(200),
});

function clientKey(headerList: Headers): string {
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "local"
  );
}

export async function setupAdmin(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  if (isAuthDisabled()) {
    redirect("/");
  }

  const originError = await assertSameOrigin();
  if (originError) {
    return originError;
  }

  const headerList = await headers();
  const limit = takeToken(`setup:${clientKey(headerList)}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return { error: "Too many attempts. Wait a few minutes." };
  }

  if (countUsers() > 0) {
    return { error: "An admin already exists. Sign in instead." };
  }

  const parsed = credentialsSchema
    .extend({
      confirmPassword: z.string(),
    })
    .safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

  if (!parsed.success) {
    return {
      error:
        "Username 2–32 letters, numbers, or underscores, and a password of at least 8 characters.",
    };
  }
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const id = randomUUID();
  getDb()
    .insert(users)
    .values({
      id,
      username: parsed.data.username,
      passwordHash: await hashPassword(parsed.data.password),
      createdAt: new Date(),
    })
    .run();

  const token = await createSession(id);
  await setSessionCookie(token);
  logger.info({ username: parsed.data.username }, "Admin account created");
  redirect("/");
}

export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  if (isAuthDisabled()) {
    redirect("/");
  }

  const originError = await assertSameOrigin();
  if (originError) {
    return originError;
  }

  const headerList = await headers();
  const limit = takeToken(`login:${clientKey(headerList)}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return { error: "Too many attempts. Wait a few minutes." };
  }

  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Invalid username or password." };
  }

  const user = getDb()
    .select()
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .get();

  if (
    !user ||
    !(await verifyPassword(user.passwordHash, parsed.data.password))
  ) {
    return { error: "Invalid username or password." };
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect("/");
}

export async function logout(): Promise<void> {
  const originError = await assertSameOrigin();
  if (originError) {
    redirect("/login");
  }
  await destroySession();
  await clearSessionCookie();
  redirect("/login");
}
