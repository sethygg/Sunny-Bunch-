import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const shop = sqliteTable('shop', { id: text('id').primaryKey(), revision: integer('revision').notNull(), lastOperation: text('last_operation').notNull(), content: text('content').notNull(), updatedAt: text('updated_at').notNull() });
export const products = sqliteTable('products', { id: text('id').primaryKey(), name: text('name').notNull(), description: text('description').notNull(), image: text('image').notNull(), priceCents: integer('price_cents').notNull(), subscriptionPriceCents: integer('subscription_price_cents').notNull(), published: integer('published').notNull(), stock: integer('stock'), updatedAt: text('updated_at').notNull() });
export const proposals = sqliteTable('proposals', { id: text('id').primaryKey(), baseRevision: integer('base_revision').notNull(), changes: text('changes').notNull(), summary: text('summary').notNull(), source: text('source').notNull(), status: text('status').notNull(), actor: text('actor').notNull(), createdAt: text('created_at').notNull(), appliedAt: text('applied_at') }, t => [index('idx_proposals_status_created').on(t.status,t.createdAt)]);
export const audit = sqliteTable('audit', { id: text('id').primaryKey(), actor: text('actor').notNull(), action: text('action').notNull(), before: text('before_data').notNull(), after: text('after_data').notNull(), createdAt: text('created_at').notNull() });
export const inventoryMovements = sqliteTable('inventory_movements', { id: text('id').primaryKey(), proposalId: text('proposal_id').notNull(), productId: text('product_id').notNull(), before: integer('before_quantity'), after: integer('after_quantity').notNull(), reason: text('reason').notNull(), actor: text('actor').notNull(), createdAt: text('created_at').notNull() }, t=>[index('idx_inventory_product_created').on(t.productId,t.createdAt)]);
export const orders = sqliteTable('orders', { id: text('id').primaryKey(), providerPaymentId: text('provider_payment_id').unique(), providerSubscriptionId: text('provider_subscription_id'), customerEmail: text('customer_email').notNull(), totalCents: integer('total_cents').notNull(), currency: text('currency').notNull(), paymentStatus: text('payment_status').notNull(), fulfillmentStatus: text('fulfillment_status').notNull(), items: text('items').notNull(), createdAt: text('created_at').notNull() }, t=>[index('idx_orders_created').on(t.createdAt)]);
export const subscriptions = sqliteTable('subscriptions', { id: text('id').primaryKey(), providerSubscriptionId: text('provider_subscription_id').unique(), customerEmail: text('customer_email').notNull(), status: text('status').notNull(), items: text('items').notNull(), nextBillingAt: text('next_billing_at'), createdAt: text('created_at').notNull() });

export const schoolPartners = sqliteTable('school_partners', {
  id: text('id').primaryKey(), code: text('code').notNull().unique(), name: text('name').notNull(), program: text('program').notNull(),
  contactEmail: text('contact_email').notNull(), status: text('status').notNull(), revision: integer('revision').notNull(),
  lastOperation: text('last_operation').notNull(), referralVisits: integer('referral_visits').notNull().default(0),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull()
});
export const schoolReferrals = sqliteTable('school_referrals', {
  tokenHash: text('token_hash').primaryKey(), partnerId: text('partner_id').notNull().references(()=>schoolPartners.id),
  policy: text('policy').notNull(), createdAt: text('created_at').notNull(), expiresAt: text('expires_at').notNull()
}, t=>[index('idx_school_referrals_expiry').on(t.expiresAt)]);
export const schoolSubscriptionAttributions = sqliteTable('school_subscription_attributions', {
  subscriptionId: text('subscription_id').primaryKey().references(()=>subscriptions.id), partnerId: text('partner_id').references(()=>schoolPartners.id),
  districtName: text('district_name'), programName: text('program_name'), referralHash: text('referral_hash'),
  policy: text('policy').notNull(), createdAt: text('created_at').notNull()
}, t=>[index('idx_school_subscriptions_partner').on(t.partnerId)]);
export const schoolOrderAttributions = sqliteTable('school_order_attributions', {
  orderId: text('order_id').primaryKey().references(()=>orders.id), partnerId: text('partner_id').references(()=>schoolPartners.id),
  subscriptionId: text('subscription_id').references(()=>subscriptions.id), districtName: text('district_name'), programName: text('program_name'),
  referralHash: text('referral_hash'), policy: text('policy').notNull(), createdAt: text('created_at').notNull()
}, t=>[index('idx_school_orders_partner').on(t.partnerId)]);
