# Sunnybunch Store Studio

Custom storefront and private store administration on Sites, Cloudflare Workers and D1. Public storefront: `/`. Private owner workspace: `/admin`.

## Implemented

- Persistent two-flavor catalog: product name, description, USD one-time and subscription prices, publication state.
- Stock counted in outer pouches, with explicit unconfigured opening stock and immutable adjustment history.
- Homepage announcement, introduction and mission copy stored in D1 and rendered on the storefront.
- Owner-only management API. Sign in with ChatGPT, then match the server-side owner allowlist.
- Typed proposals from owner forms or AI assistants, exact before/after review, atomic apply, stale-revision protection, idempotent retries, audit history.
- Browser-native AI tools to read store context and stage changes. Applying changes is deliberately not exposed as an AI tool. Compatible browser support is required; copying a store brief and pasting structured proposals is the fallback.
- Existing product bag, subscription selection and 30-day cadence preserved. Current defaults: $30.00 one-time; $24.99 subscription, plus shipping. Each pouch: 25 × 20 g sachets, eight gummies per sachet.

## Owner setup

Set production `ADMIN_OWNER_EMAIL` through Sites runtime environment settings. Use the email attached to the founder's ChatGPT sign-in. The application fails closed if this variable is missing. No other signed-in user can read or change admin records. Identity comes from the trusted Sites dispatcher; never host this Worker behind a proxy that accepts caller-supplied `oai-authenticated-user-*` headers.

Visit `/admin`, sign in, and select **Initialize Sunnybunch** once. This writes the approved catalog and mission copy into D1. It does not fabricate inventory, orders, customers, subscriptions or donations. Record opening stock through Inventory. Refresh before creating a proposal based on another owner's recent edits.

Local preview uses the starter's simulated `seedy@sites.test` identity. `.dev.vars` is ignored and must never be committed or copied to production environment settings.

## Payments are not implemented or active

Orders and subscriptions have persisted schemas and read-only empty-state admin surfaces, but no payment provider is connected and no checkout, renewal, fulfillment, refund, customer account or customer portal integration has been implemented. Checkout remains disabled in the UI and there is no charge endpoint. No screenshot or administrative action counts as proof of a paid order.

Next commerce milestone requires a Stripe account, confirmed shipping territory/rates, tax settings, customer policies and opening inventory. Implement and validate hosted Checkout, immutable price/order snapshots, atomic reservations, verified durable webhook processing, payment/order reconciliation, renewal stock handling, and authenticated customer subscription management before enabling sales.

Stripe design notes: recurring prices must use interval=day and interval_count=30. Subscription Checkout shipping needs a supported recurring-shipping design; do not assume one-time `shipping_options` works for subscriptions. Mixed carts have initial-only items and recurring items. Do not promise portal changes for multi-product subscriptions without implementing the supported flows.

Official references: https://docs.stripe.com/api/checkout/sessions/create ; https://docs.stripe.com/api/prices/create ; https://docs.stripe.com/webhooks ; https://docs.stripe.com/customer-management

## AI proposal format

Read current store revision first. Currency is integer cents. Product IDs are fixed. Changes are allowlisted; no SQL, HTML execution, authentication edits or payment-status writes are accepted.

```json
{
  "id": "a freshly generated UUID; reuse only when retrying this same proposal",
  "baseRevision": 1,
  "summary": "Update a product description",
  "source": "ai",
  "changes": [
    {"type": "update_product", "id": "raspberry", "patch": {"description": "Your proposed wording"}}
  ]
}
```

Supported changes: `update_product`, `set_inventory`, `adjust_inventory`, `update_content`. All inventory changes require a reason. The admin JSON fallback asks for `summary` and `changes` and supplies the current revision. The model-context tool schema carries the complete structured contract. There is no separate in-page AI chat service or model API key configured.

## Development and validation

- `npm run dev -- --hostname 127.0.0.1`
- `npm run db:generate` after schema changes; generated migrations are deployed with Sites.
- `npx tsc --noEmit`
- `node --test tests/backend.test.mjs tests/store.test.mjs`
- `node tests/http-smoke.mjs` against an isolated local preview. This initializes local data and records a test inventory count; never point it at production.

Backend tests execute the production repository SQL against in-memory SQLite through a D1-compatible transaction adapter, including concurrent revisions and rollback. HTTP smoke checks test the local Workers/D1 integration and simulated sign-in. They do not verify real hosted ChatGPT login or browser rendering. Browser-native AI tool execution remains unverified where the host does not expose a model-context test environment.

The initial admin lists show recent data: 50 proposals and 100 audit, inventory, order and subscription records. Pagination, full data export/backups, additional staff roles, order fulfillment operations, merchandising beyond the two launch SKUs and production billing remain future work. This is the first operational management backend, not feature parity with Shopify.
