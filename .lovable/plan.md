# Improve the Subscription Entitlements admin UX

Replace the raw "paste a price ID" form with a Stripe-aware picker, and add a one-screen bulk sync so all 20 new category prices can be mapped in a single sitting.

## 1. New edge function: `list-stripe-prices`

Admin-only (verifies JWT + `has_role(uid, 'admin')`). Calls Stripe REST `GET /v1/prices?expand[]=data.product&active=true&limit=100` (paginates with `starting_after` if needed) using `fetch` per project memory — no Stripe SDK.

Returns a slim payload:
```ts
{
  prices: Array<{
    price_id: string;
    product_id: string;
    product_name: string;
    product_description: string | null;
    nickname: string | null;
    unit_amount: number | null;     // cents
    currency: string;
    interval: 'month' | 'year' | null;
    metadata: Record<string, string>;
  }>
}
```

Cached client-side for the session; a "Refresh from Stripe" button refetches.

## 2. Single-row dialog: Stripe-aware picker

In `AdminEntitlements.tsx`, replace the "Stripe price ID" `Input` with a searchable combobox (shadcn `Command` inside `Popover`) grouped by product:

```
Welding
  ├─ Monthly · $9.99/mo            ✓ mapped
  └─ Annual  · $99.99/yr
HVAC
  ├─ Monthly · $9.99/mo
  └─ Annual  · $99.99/yr
All-Access
  ├─ Monthly · $49.99/mo            ✓ mapped
  └─ Annual  · $479.99/yr           ✓ mapped
```

On select, auto-fill (and lock with an "edit override" toggle):
- `billing_interval` ← `interval`
- `unit_amount` ← `unit_amount`
- `currency` ← `currency`
- `label` ← `nickname || product_name`

The admin only chooses:
- **Access type** — Full library / Single category
- **Category** (if category) — pre-selected when `product.metadata.category_id` exists or product name fuzzy-matches a top-level category name
- **Audience** — Individual & Group (default) / Individual / Group

A "Enter price ID manually" fallback link preserves the current flow if Stripe is unreachable.

## 3. Bulk "Sync from Stripe" mapper

A new top-of-table button **Sync from Stripe** opens a full-screen `Dialog` (or `Sheet`) showing every active Stripe price as a row:

```
[ ✓ ] Welding — Monthly      $9.99/mo   [Access ▾] [Category ▾] [Audience ▾]   ✓ mapped
[ ✓ ] Welding — Annual       $99.99/yr  [Access ▾] [Category ▾] [Audience ▾]
[   ] HVAC — Monthly         $9.99/mo   [Access ▾] [Category ▾] [Audience ▾]
…
```

Behavior:
- Already-mapped prices are pre-checked and dimmed (read-only) with a "✓ mapped" badge.
- Unmapped prices are unchecked by default; checking one enables its row controls.
- **Smart defaults** for unmapped rows:
  - `access_type` = `category` if product name matches a top-level category, else `full`
  - `category_id` = best name match (or `product.metadata.category_id` if Stripe metadata is set)
  - `audience` = both (mirrored)
  - `billing_interval` / `unit_amount` / `currency` / `label` come from Stripe
- **Bulk action bar** at the top: "Set audience for all" / "Set access type for all" to fast-fill obvious cases.
- **Save all** does a single `upsert` on `subscription_entitlements` with `onConflict: 'stripe_price_id,audience'`. For mirrored audience, two rows per price are written.
- Toast summary: "Mapped 18 new prices. 2 unchanged."

## 4. Table cosmetic polish

- Show **product name** as the primary cell, with the `price_…` ID demoted to a small monospace subtitle.
- Add a "Stale" badge if a row's `stripe_price_id` is no longer returned by Stripe (`active: false` or deleted).
- Tooltip on the price ID showing "Open in Stripe" deep link (`https://dashboard.stripe.com/prices/{id}`).

## 5. Optional: stamp `category_id` into Stripe metadata

When a category mapping is saved (single or bulk), the edge function can `POST /v1/products/{id}` with `metadata[category_id]={id}`. Future re-imports then auto-map without guessing. Behind a checkbox in the bulk dialog: "Also write category to Stripe product metadata".

## Technical details

**Files**
- New: `supabase/functions/list-stripe-prices/index.ts` — Deno fetch to Stripe REST, JWT + admin check, paginated.
- New: `src/components/admin/StripePriceCombobox.tsx` — reusable picker (shadcn Command/Popover).
- New: `src/components/admin/AdminEntitlementsBulkSync.tsx` — full bulk mapper dialog.
- Edited: `src/components/admin/AdminEntitlements.tsx` — wire combobox into existing dialog, add "Sync from Stripe" button, show product name, stale badge.

**No DB migrations required.** Existing `subscription_entitlements` schema (with `unit_amount`, `currency`, `label`, unique `(stripe_price_id, audience)`) already supports everything.

**No changes to** `create-checkout`, `create-group-checkout`, `verify-group-purchase`, or `user_has_video_access` — they continue to read entitlements unchanged.

## Out of scope

- Editing prices/products in Stripe from the admin (read-only except the optional metadata write).
- Webhook-driven sync. Refresh remains manual via the button.
- Auto-archiving entitlements when a Stripe price becomes inactive (we just badge them "Stale").
