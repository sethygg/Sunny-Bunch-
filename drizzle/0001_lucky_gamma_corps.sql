CREATE TABLE `school_order_attributions` (
	`order_id` text PRIMARY KEY NOT NULL,
	`partner_id` text,
	`subscription_id` text,
	`district_name` text,
	`program_name` text,
	`referral_hash` text,
	`policy` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `school_partners`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_school_orders_partner` ON `school_order_attributions` (`partner_id`);--> statement-breakpoint
CREATE TABLE `school_partners` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`program` text NOT NULL,
	`contact_email` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer NOT NULL,
	`last_operation` text NOT NULL,
	`referral_visits` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_partners_code_unique` ON `school_partners` (`code`);--> statement-breakpoint
CREATE TABLE `school_referrals` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`policy` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `school_partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_school_referrals_expiry` ON `school_referrals` (`expires_at`);--> statement-breakpoint
CREATE TABLE `school_subscription_attributions` (
	`subscription_id` text PRIMARY KEY NOT NULL,
	`partner_id` text,
	`district_name` text,
	`program_name` text,
	`referral_hash` text,
	`policy` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `school_partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_school_subscriptions_partner` ON `school_subscription_attributions` (`partner_id`);