CREATE TABLE `charity_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_id` text NOT NULL,
	`partner_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`transfer_id`) REFERENCES `charity_transfers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `school_partners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_charity_allocations_partner` ON `charity_allocations` (`partner_id`);--> statement-breakpoint
CREATE INDEX `idx_charity_allocations_transfer` ON `charity_allocations` (`transfer_id`);--> statement-breakpoint
CREATE TABLE `charity_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`transferred_on` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`recipient` text NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`reversed_at` text,
	`reversal_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `charity_transfers_reference_unique` ON `charity_transfers` (`reference`);--> statement-breakpoint
ALTER TABLE `school_partners` ADD `kind` text DEFAULT 'school' NOT NULL;--> statement-breakpoint
ALTER TABLE `school_partners` ADD `intro` text DEFAULT '' NOT NULL;