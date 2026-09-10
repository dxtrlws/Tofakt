import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { settings } from "../db/schema";

export function getSettingJson<T>(key: string): T | undefined {
  const row = getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  if (!row) {
    return undefined;
  }
  try {
    return JSON.parse(row.valueJson) as T;
  } catch {
    return undefined;
  }
}

export function setSettingJson(key: string, value: unknown): void {
  const now = new Date();
  const encoded = JSON.stringify(value);
  const existing = getDb()
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  if (existing) {
    getDb()
      .update(settings)
      .set({ valueJson: encoded, updatedAt: now })
      .where(eq(settings.key, key))
      .run();
    return;
  }
  getDb()
    .insert(settings)
    .values({ key, valueJson: encoded, updatedAt: now })
    .run();
}
