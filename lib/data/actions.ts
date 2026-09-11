"use server";

import { revalidatePath } from "next/cache";
import { assertSameOrigin } from "../auth/csrf";
import { requireUser } from "../auth/require";
import type { Provider } from "../connections/types";
import { timezone } from "../ingest/run";
import type { ActionFlash } from "../toast/flash";
import { reply } from "../toast/persist";
import { clearSyncRecords, forgetProvider, wipeLocalHistory } from "./danger";
import {
  cancelImportPreview,
  confirmImport,
  parseHistoryFile,
  stashImportPreview,
} from "./history-file";
import { saveDataPrefs } from "./prefs";

export type DataActionState = ActionFlash;

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

async function guard() {
  await requireUser();
  return assertSameOrigin();
}

function confirmed(form: FormData, phrase: string): boolean {
  return String(form.get("confirm") ?? "").trim() === phrase;
}

function refresh() {
  revalidatePath("/settings/data");
  revalidatePath("/settings/connections");
  revalidatePath("/history");
  revalidatePath("/");
  revalidatePath("/monthly");
  revalidatePath("/year");
  revalidatePath("/settings/about");
  revalidatePath("/settings/logs");
}

export async function saveDataPrefsAction(
  _prev: DataActionState | undefined,
  form: FormData,
): Promise<DataActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const zone = String(form.get("timezone") ?? "");
  const weekStarts = String(form.get("weekStarts"));
  const countPartials = String(form.get("countPartials")) === "on";
  saveDataPrefs({
    timezone: zone || timezone(),
    weekStarts: weekStarts === "monday" ? "monday" : "sunday",
    countPartials,
  });
  return reply({ info: "Data preferences saved." }, refresh);
}

export async function previewImportAction(
  _prev: DataActionState | undefined,
  form: FormData,
): Promise<DataActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return reply({ error: "Choose a Watchlog JSON export first." });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return reply({ error: "That file is larger than 20 MB." });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    return reply({ error: "Import expects a Watchlog JSON export." });
  }
  try {
    const count = stashImportPreview(parseHistoryFile(parsed));
    return reply(
      {
        info: `${count} ${count === 1 ? "play" : "plays"} ready to import. Confirm below to write them. Existing plays are skipped.`,
      },
      refresh,
    );
  } catch (err) {
    return reply({
      error: err instanceof Error ? err.message : "Could not read that file.",
    });
  }
}

export async function confirmImportAction(
  _prev: DataActionState | undefined,
  _form?: FormData,
): Promise<DataActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  try {
    const result = confirmImport();
    return reply(
      {
        info: `Imported ${result.inserted} ${result.inserted === 1 ? "play" : "plays"}. Skipped ${result.skipped} already stored.`,
      },
      refresh,
    );
  } catch (err) {
    return reply({
      error: err instanceof Error ? err.message : "Import failed.",
    });
  }
}

export async function cancelImportAction(
  _prev: DataActionState | undefined,
  _form?: FormData,
): Promise<DataActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  cancelImportPreview();
  return reply({ info: "Import cancelled." }, refresh);
}

export async function clearSyncAction(
  _prev: DataActionState | undefined,
  form: FormData,
): Promise<DataActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  if (!confirmed(form, "Clear sync records")) {
    return { error: "Type Clear sync records to confirm." };
  }
  const count = clearSyncRecords();
  return reply(
    {
      info: `Cleared ${count} sync records. Local history is intact. Trakt was not changed.`,
    },
    refresh,
  );
}

export async function wipeLocalAction(
  _prev: DataActionState | undefined,
  form: FormData,
): Promise<DataActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  if (!confirmed(form, "Clear all local data")) {
    return { error: "Type Clear all local data to confirm." };
  }
  wipeLocalHistory();
  return reply(
    {
      info: "Local watch history is gone. Connections and login stay. Trakt was not changed.",
    },
    refresh,
  );
}

export async function forgetConnectionAction(
  _prev: DataActionState | undefined,
  form: FormData,
): Promise<DataActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  if (!confirmed(form, "Forget a connection")) {
    return { error: "Type Forget a connection to confirm." };
  }
  const provider = String(form.get("provider"));
  if (provider !== "tofa" && provider !== "trakt" && provider !== "tmdb") {
    return { error: "Pick a connection to forget." };
  }
  forgetProvider(provider as Provider);
  return reply(
    {
      info: `Forgot ${provider}. Stored tokens are gone. Trakt history stays.`,
    },
    refresh,
  );
}
