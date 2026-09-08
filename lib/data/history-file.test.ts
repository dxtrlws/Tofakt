import { describe, expect, it } from "vitest";
import {
  historyToCsv,
  MAX_IMPORT_EVENTS,
  parseHistoryFile,
} from "./history-file";

const sample = {
  watchedAt: "2026-09-07T12:00:00.000Z",
  title: "Chad Powers",
  showTitle: "Chad Powers",
  kind: "episode" as const,
  seasonNumber: 1,
  episodeNumber: 4,
  seconds: 1800,
  tmdbId: 123,
  tofaHistoryId: "h1",
  completionPercent: 100,
  isComplete: true,
  dedupeKey: "history-1",
};

describe("parseHistoryFile", () => {
  it("reads a Watchlog export", () => {
    const events = parseHistoryFile({
      source: "watchlog",
      exportedAt: "2026-09-07T12:00:00.000Z",
      events: [sample],
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("Chad Powers");
    expect(events[0]?.dedupeKey).toBe("history-1");
  });

  it("accepts a bare events array", () => {
    expect(parseHistoryFile([sample])).toHaveLength(1);
  });

  it("synthesizes a dedupe key when missing", () => {
    const { dedupeKey: _drop, ...row } = sample;
    expect(parseHistoryFile([row])[0]?.dedupeKey).toContain("import:");
  });

  it("rejects an empty file", () => {
    expect(() => parseHistoryFile({ source: "watchlog", events: [] })).toThrow(
      /No plays/,
    );
  });

  it("rejects more than the import cap", () => {
    const events = Array.from({ length: MAX_IMPORT_EVENTS + 1 }, () => sample);
    expect(() => parseHistoryFile({ events })).toThrow(/capped/);
  });
});

describe("historyToCsv", () => {
  it("quotes titles with commas", () => {
    const csv = historyToCsv([{ ...sample, title: "Foo, Bar" }]);
    expect(csv).toContain('"Foo, Bar"');
    expect(csv.split("\n")[0]).toContain("watched_at");
  });
});
