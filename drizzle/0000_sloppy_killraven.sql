CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`before_data` text NOT NULL,
	`after_data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`product_id` text NOT NULL,
	`before_quantity` integer,
	`after_quantity` integer NOT NULL,
	`reason` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_product_created` ON `inventory_movements` (`product_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_payment_id` text,
	`customer_email` text NOT NULL,
	`total_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`payment_status` text NOT NULL,
	`fulfillment_status` text NOT NULL,
	`items` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_provider_payment_id_unique` ON `orders` (`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_created` ON `orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`image` text NOT NULL,
	`price_cents` integer NOT NULL,
	`subscription_price_cents` integer NOT NULL,
	`published` integer NOT NULL,
	`stock` integer,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`base_revision` integer NOT NULL,
	`changes` text NOT NULL,
	`summary` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`applied_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_proposals_status_created` ON `proposals` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `shop` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`last_operation` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_subscription_id` text,
	`customer_email` text NOT NULL,
	`status` text NOT NULL,
	`items` text NOT NULL,
	`next_billing_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_provider_subscription_id_unique` ON `subscriptions` (`provider_subscription_id`);