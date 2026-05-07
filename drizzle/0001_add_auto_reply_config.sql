CREATE TABLE `auto_reply_config` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`interval_minutes` integer DEFAULT 10 NOT NULL,
	`last_run_at` integer,
	`last_success_at` integer,
	`last_error` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`comment_limit` integer DEFAULT 3 NOT NULL,
	`days_back` integer DEFAULT 3 NOT NULL,
	`dry_run` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_reply_config_user_id_unique` ON `auto_reply_config` (`user_id`);