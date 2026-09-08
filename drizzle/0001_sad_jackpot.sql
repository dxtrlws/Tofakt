ALTER TABLE `connections` ADD `extra_enc` text;--> statement-breakpoint
ALTER TABLE `connections` ADD `extra_json` text;--> statement-breakpoint
CREATE UNIQUE INDEX `connections_provider` ON `connections` (`provider`);