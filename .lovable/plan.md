# Add purchasing options to the Video Library

Surface subscription CTAs directly on `/videos` so visitors can subscribe to a category from the same screen where they're browsing it, instead of having to leave for `/pricing`.

## Where the CTAs appear

1. **Top-level category cards** (the grid shown when no category is selected, or when drilling into a parent that still has children)
   - Below the existing title/description, add a small price block:
     `From $X.XX/mo · $Y.YY/yr` and two buttons: **Subscribe Monthly** / **Subscribe Yearly**.
   - Buttons are rendered inside the card but stop click propagation so the card itself still drills into the category.
   - If the user already has access (full plan or this category), show a single muted **"You have access"** pill instead.
   - If no entitlement exists for that category, no price block is rendered (card looks like today).

2. **Category detail header** (when the user has drilled into a top-level category, including its leaf views)
   - Add a banner above the videos/subcategory grid:
     `Subscribe to {Category Name}` + monthly/yearly buttons + "What's included" line.
   - Same access/entitlement rules as above.
   - Banner is dismissible per session for users who don't intend to buy.

3. **Leaf empty/locked state**
   - If a leaf category shows videos and the user lacks access, the existing video cards already gate playback. We only add the subscribe banner above; no change to `VideoCard`.

## Data sources (no schema changes)

- `subscription_entitlements` filtered to `audience = 'individual'`, `access_type = 'category'` — gives monthly/yearly `stripe_price_id` + `unit_amount` per top-level `category_id`.
- Also fetch the user's `subscriptions` (active/trialing) and join against entitlements to know which categories they already have access to (plus `access_type='full'` → access to all).
- Group access via `group_members` + `group_purchases` is left as-is; if the user already has video access through their group, we hide the CTA.

For categories deeper than top-level, we walk up to the top-level ancestor (using `parent_id`) to find the matching entitlement — the banner inside `Industrial → Electrical` still offers the Industrial subscription.

## Checkout flow

Reuse the existing `create-checkout` edge function (already used by `/pricing`):

- Unauthenticated → redirect to `/auth?mode=signup&redirect=/videos?path=...`.
- Authenticated → `supabase.functions.invoke("create-checkout", { body: { priceId } })` and `window.location.href = data.url`.
- On return from Stripe success, the user lands back on the same category view with access unlocked.

No changes needed to `create-checkout`, `check-subscription`, or any database function.

## Files to change

- `src/pages/Videos.tsx`
  - New queries: `subscription_entitlements` (already public-readable) and the user's `subscriptions`.
  - Helpers: `topLevelAncestorId(catId)`, `entitlementFor(catId, interval)`, `userHasCategoryAccess(catId)`.
  - Pass entitlement props into the new components below.
- `src/components/videos/CategoryPriceBlock.tsx` *(new, small)*
  - Renders the two-button price block used inside category cards.
- `src/components/videos/CategorySubscribeBanner.tsx` *(new, small)*
  - Renders the banner above the drill-down view.
- `src/lib/checkout.ts` *(new, tiny shared helper)*
  - `startCategoryCheckout(priceId, returnPath)` — extracted from `Pricing.tsx` so both pages share one implementation. Refactor `Pricing.tsx` to use it (no behavior change there).

## Edge cases

- Entitlement missing for a category → no CTA shown (silent).
- User has `access_type='full'` subscription → show "You have access" everywhere; never offer category-only buttons.
- User has only the monthly version of a category → still show yearly as an upgrade option (button label: "Switch to yearly"). Out of scope if it complicates: keep both as plain "Subscribe" for v1.
- Currency is fixed to USD as in Pricing.tsx — no FX handling.
- Loading states: per-button spinner via `loadingPriceId`, identical to Pricing.tsx.

## Out of scope

- Group/seat purchases from the Video Library (still only on `/pricing`).
- Coupons / promo codes on the Video Library.
- Per-video one-off purchases.
- Changing the entitlement schema or adding new prices.
