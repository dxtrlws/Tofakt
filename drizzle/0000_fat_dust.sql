CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`detail_json` text
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`base_url` text,
	`server_id` text,
	`auth_method` text,
	`access_token_enc` text,
	`refresh_token_enc` text,
	`expires_at` integer,
	`account_label` text,
	`capabilities_json` text,
	`last_verified_at` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`id` text PRIMARY KEY NOT NULL,
	`tmdb_id` integer,
	`name` text NOT NULL,
	`kind` text
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`scheduled_for` integer,
	`started_at` integer,
	`finished_at` integer,
	`cursor_json` text,
	`stats_json` text,
	`error` text,
	`items_processed` integer,
	`items_total` integer,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`scheduled_for` integer,
	`started_at` integer,
	`finished_at` integer,
	`cursor_json` text,
	`stats_json` text,
	`error` text,
	`items_processed` integer,
	`items_total` integer
);
--> statement-breakpoint
CREATE TABLE `media_genres` (
	`media_item_id` text NOT NULL,
	`genre_id` text NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`tofa_media_id` text,
	`tmdb_id` integer,
	`imdb_id` text,
	`tvdb_id` integer,
	`trakt_id` integer,
	`title` text NOT NULL,
	`sort_title` text,
	`year` integer,
	`runtime_seconds` integer,
	`show_tmdb_id` integer,
	`show_title` text,
	`season_number` integer,
	`episode_number` integer,
	`artwork_url` text,
	`tofa_library_id` text,
	`metadata_synced_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_items_tofa_media_id` ON `media_items` (`tofa_media_id`);--> statement-breakpoint
CREATE TABLE `provider_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`media_item_id` text NOT NULL,
	`region` text NOT NULL,
	`provider_id` integer,
	`provider_name` text NOT NULL,
	`logo_path` text,
	`monetization_type` text NOT NULL,
	`captured_at` integer NOT NULL,
	`is_manual_override` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`media_item_id` text NOT NULL,
	`source` text NOT NULL,
	`rating` integer NOT NULL,
	`rated_at` integer,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_records` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_event_id` text NOT NULL,
	`target` text DEFAULT 'trakt' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`skip_reason` text,
	`remote_id` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`last_error_code` text,
	`last_error_message` text,
	`next_attempt_at` integer,
	`synced_at` integer,
	FOREIGN KEY (`watch_event_id`) REFERENCES `watch_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_records_watch_event` ON `sync_records` (`watch_event_id`);--> statement-breakpoint
CREATE INDEX `sync_records_status_next` ON `sync_records` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `trakt_history_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`trakt_history_id` integer,
	`kind` text,
	`tmdb_id` integer,
	`imdb_id` text,
	`tvdb_id` integer,
	`season_number` integer,
	`episode_number` integer,
	`watched_at_utc` integer,
	`action` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trakt_history_tmdb_watched` ON `trakt_history_snapshot` (`tmdb_id`,`watched_at_utc`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `watch_events` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`dedupe_strategy` text DEFAULT 'tofa_history_id' NOT NULL,
	`media_item_id` text,
	`tofa_history_id` text,
	`tofa_user_id` text,
	`watched_at_utc` integer NOT NULL,
	`timestamp_convention` text,
	`duration_watched_seconds` integer,
	`completion_percent` integer,
	`is_complete` integer DEFAULT false NOT NULL,
	`device_name` text,
	`ingested_at` integer NOT NULL,
	`raw_json` text,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_events_dedupe_key` ON `watch_events` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `watch_events_watched_at` ON `watch_events` (`watched_at_utc`);--> statement-breakpoint
CREATE INDEX `watch_events_media_item` ON `watch_events` (`media_item_id`);