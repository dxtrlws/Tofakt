CREATE TABLE `tmdb_title_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`poster` text,
	`backdrop` text,
	`networks_json` text DEFAULT '[]' NOT NULL,
	`companies_json` text DEFAULT '[]' NOT NULL,
	`network_orgs_json` text DEFAULT '[]' NOT NULL,
	`company_orgs_json` text DEFAULT '[]' NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `trakt_history_snapshot` ADD `show_tmdb_id` integer;--> statement-breakpoint
ALTER TABLE `trakt_history_snapshot` ADD `payload_json` text;--> statement-breakpoint
CREATE INDEX `trakt_history_watched` ON `trakt_history_snapshot` (`watched_at_utc`);