
# Goal

Let users buy a subscription that unlocks **all videos** (existing) **or** a single **top-level category** (new), monthly or annual. Group purchases get the same option.

The data model already supports this — `subscription_entitlements` has `access_type='category'` and a `category_id` column, and `user_has_video_access` already expands ancestors and matches category entitlements. So this is mostly: (1) seed entitlements for the new Stripe prices, (2) update the Pricing page UI, (3) make sure `check-subscription` and group checkout pass the chosen price through.

# 1. Seed `subscription_entitlements` for the new category prices

For each top-level category (Buildings & Trades, Computers, Cosmetology, Criminal Justice, Health Science, HVAC, Industrial, Mobile Equipment, Utility Line Technician, Welding) you've created Monthly + Annual Stripe products. We need the **price IDs** for each. Two options:

- **A.** You paste the 20 price IDs (10 categories × monthly/annual) and I insert them via migration.
- **B.** I add an **Admin → Entitlements** page that lists every Stripe price the project knows about and lets an admin map each to: `audience` (individual / group / both), `billing_interval`, `access_type` (full / category), and `category_id`. This is reusable forever and avoids hardcoding.

Recommend **B** plus a one-time helper to bulk-import. Each row inserted will have `audience='individual'` AND a parallel `audience='group'` row (same price, same category) so the same Stripe price works for individual and group purchases — matching how the existing all-access prices are seeded.

# 2. Pricing page (`src/pages/Pricing.tsx`)

Restructure into two sections:

- **All-Access** — current Monthly / Annual / School cards, unchanged.
- **Single-Category Plans** — a new section with a category picker (dropdown or grid of 10 cards). When a category is selected, show Monthly and Annual buttons that call `create-checkout` with that category's price ID. Same UX for the "Buy for a Group" dialog: add a "Plan scope" select (All categories / specific category) before the Monthly/Annual select.

The `PRICE_IDS` const becomes a structured map:

```ts
const PRICE_IDS = {
  full:    { monthly: "price_…", annual: "price_…" },
  byCategory: {
    [categoryId]: { monthly: "price_…", annual: "price_…" },
    …
  }
}
```

This map is hydrated at build time from the Admin entitlements (or hardcoded if we go with option A). The page fetches `categories` (parent_id IS NULL) to render names/slugs.

# 3. Checkout edge functions

- `create-checkout` (individual): already accepts an arbitrary `priceId` — no change needed.
- `create-group-checkout`: already accepts `priceId` — verify it forwards correctly and that `verify-group-purchase` records the chosen `priceId` into `group_purchases.product_id` (the column `user_has_video_access` joins on). If not, fix that mapping so category group purchases resolve correctly.

# 4. Access resolution

`user_has_video_access` already handles category entitlements (full vs category, recursive ancestor check). No DB function changes required once entitlements are seeded.

# 5. UI surfaces that show subscription status

- **Account page** — display subscription's product name + scope ("All categories" or the category name). Pull from joined `subscription_entitlements` + `categories`.
- **VideoCard / VideoDetail** — current logic uses `user_has_video_access` RPC, which already returns the right answer per video. No change beyond confirming the upgrade CTA copy ("Subscribe to unlock Welding videos").

# 6. `check-subscription` edge function

Already syncs the active Stripe subscription's `price_id` into `public.subscriptions`. As long as the new category prices have entitlement rows, access will resolve correctly. No code change required.

# Open questions

1. **Option A vs B above** — admin UI, or paste price IDs once?
2. **Pricing display** — what are the per-category monthly/annual prices? Same $49.99 / $39.99 as all-access, or cheaper? Needed for the cards.
3. Should the all-access plan visually be marketed as the "best value" upgrade from a single category, with a simple comparison? (Recommend yes — small comparison strip under the category section.)

# Out of scope

- Refactoring `pathways` (already deprecated per project memory).
- Webhook-driven subscription sync.
- Prorated upgrades from category → all-access (Stripe Customer Portal handles this manually for now).
