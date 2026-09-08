import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["tofa", "trakt", "tmdb"] }).notNull(),
    status: text("status").notNull().default("unknown"),
    baseUrl: text("base_url"),
    serverId: text("server_id"),
    authMethod: text("auth_method"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    extraEnc: text("extra_enc"),
    extraJson: text("extra_json"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    accountLabel: text("account_label"),
    capabilitiesJson: text("capabilities_json"),
    lastVerifiedAt: integer("last_verified_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
  },
  (table) => [uniqueIndex("connections_provider").on(table.provider)],
);

export const mediaItems = sqliteTable(
  "media_items",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["movie", "episode"] }).notNull(),
    tofaMediaId: text("tofa_media_id"),
    tmdbId: integer("tmdb_id"),
    imdbId: text("imdb_id"),
    tvdbId: integer("tvdb_id"),
    traktId: integer("trakt_id"),
    title: text("title").notNull(),
    sortTitle: text("sort_title"),
    year: integer("year"),
    runtimeSeconds: integer("runtime_seconds"),
    showTmdbId: integer("show_tmdb_id"),
    showTitle: text("show_title"),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
    artworkUrl: text("artwork_url"),
    tofaLibraryId: text("tofa_library_id"),
    metadataSyncedAt: integer("metadata_synced_at", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("media_items_tofa_media_id").on(table.tofaMediaId)],
);

export const genres = sqliteTable("genres", {
  id: text("id").primaryKey(),
  tmdbId: integer("tmdb_id"),
  name: text("name").notNull(),
  kind: text("kind"),
});

export const mediaGenres = sqliteTable("media_genres", {
  mediaItemId: text("media_item_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  genreId: text("genre_id")
    .notNull()
    .references(() => genres.id, { onDelete: "cascade" }),
});

export const watchEvents = sqliteTable(
  "watch_events",
  {
    id: text("id").primaryKey(),
    dedupeKey: text("dedupe_key").notNull(),
    dedupeStrategy: text("dedupe_strategy")
      .notNull()
      .default("tofa_history_id"),
    mediaItemId: text("media_item_id").references(() => mediaItems.id),
    tofaHistoryId: text("tofa_history_id"),
    tofaUserId: text("tofa_user_id"),
    watchedAtUtc: integer("watched_at_utc", { mode: "timestamp_ms" }).notNull(),
    timestampConvention: text("timestamp_convention"),
    durationWatchedSeconds: integer("duration_watched_seconds"),
    completionPercent: integer("completion_percent"),
    isComplete: integer("is_complete", { mode: "boolean" })
      .notNull()
      .default(false),
    deviceName: text("device_name"),
    ingestedAt: integer("ingested_at", { mode: "timestamp_ms" }).notNull(),
    rawJson: text("raw_json"),
  },
  (table) => [
    uniqueIndex("watch_events_dedupe_key").on(table.dedupeKey),
    index("watch_events_watched_at").on(table.watchedAtUtc),
    index("watch_events_media_item").on(table.mediaItemId),
  ],
);

export const syncRecords = sqliteTable(
  "sync_records",
  {
    id: text("id").primaryKey(),
    watchEventId: text("watch_event_id")
      .notNull()
      .references(() => watchEvents.id, { onDelete: "cascade" }),
    target: text("target").notNull().default("trakt"),
    status: text("status", {
      enum: ["pending", "syncing", "synced", "skipped", "failed", "unmatched"],
    })
      .notNull()
      .default("pending"),
    skipReason: text("skip_reason"),
    remoteId: text("remote_id"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("sync_records_watch_event").on(table.watchEventId),
    index("sync_records_status_next").on(table.status, table.nextAttemptAt),
  ],
);

export const traktHistorySnapshot = sqliteTable(
  "trakt_history_snapshot",
  {
    id: text("id").primaryKey(),
    traktHistoryId: integer("trakt_history_id"),
    kind: text("kind"),
    tmdbId: integer("tmdb_id"),
    imdbId: text("imdb_id"),
    tvdbId: integer("tvdb_id"),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
    watchedAtUtc: integer("watched_at_utc", { mode: "timestamp_ms" }),
    action: text("action"),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("trakt_history_tmdb_watched").on(table.tmdbId, table.watchedAtUtc),
  ],
);

export const providerSnapshots = sqliteTable("provider_snapshots", {
  id: text("id").primaryKey(),
  mediaItemId: text("media_item_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  region: text("region").notNull(),
  providerId: integer("provider_id"),
  providerName: text("provider_name").notNull(),
  logoPath: text("logo_path"),
  monetizationType: text("monetization_type", {
    enum: ["flatrate", "rent", "buy", "ads", "free"],
  }).notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
  isManualOverride: integer("is_manual_override", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const ratings = sqliteTable("ratings", {
  id: text("id").primaryKey(),
  mediaItemId: text("media_item_id")
    .notNull()
    .references(() => mediaItems.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["trakt", "tofa"] }).notNull(),
  rating: integer("rating").notNull(),
  ratedAt: integer("rated_at", { mode: "timestamp_ms" }),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  cursorJson: text("cursor_json"),
  statsJson: text("stats_json"),
  error: text("error"),
  itemsProcessed: integer("items_processed"),
  itemsTotal: integer("items_total"),
});

export const jobRuns = sqliteTable("job_runs", {
  id: text("id").primaryKey(),
  jobId: text("job_id").references(() => jobs.id),
  type: text("type").notNull(),
  status: text("status").notNull(),
  scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  cursorJson: text("cursor_json"),
  statsJson: text("stats_json"),
  error: text("error"),
  itemsProcessed: integer("items_processed"),
  itemsTotal: integer("items_total"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  at: integer("at", { mode: "timestamp_ms" }).notNull(),
  actor: text("actor", { enum: ["system", "user"] }).notNull(),
  action: text("action").notNull(),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  detailJson: text("detail_json"),
});
