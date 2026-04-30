## Goal

Let a teacher / group admin buy a subscription for N students online. After payment they get a class coupon code (shareable link) that students redeem to create accounts. Each student inherits the same video/category access as the group's purchase, for as long as the group's subscription is active.

## What's already working

- `groups`, `group_members`, `group_purchases`, `group_coupon_codes`, `group_coupon_redemptions` tables with RLS.
- Edge functions: `create-group-checkout`, `verify-group-purchase`, `register-with-coupon`, `group-admin-students`.
- DB function `redeem_group_coupon(code, user_id)` atomically checks seat availability, inserts redemption, adds student to `group_members`, increments count.
- DB function `user_has_video_access(user, video)` already grants access via group membership when a matching `subscription_entitlements` row exists for the group's `product_id`.
- `GroupAdmin` page with `GroupAdminCoupons` and `GroupAdminStudents` tabs.
- Pricing page already has "Buy for a Group" button that opens a dialog (group name + seat count) and calls `create-group-checkout`.

## What's missing / needs work

1. **Subscription lifecycle for groups** — `group_purchases` only stores `stripe_session_id` + `product_id`. We never persist the Stripe subscription id, status, or `current_period_end`, so we can't enforce "same period of time as the group admin" or detect cancellations.
2. **Entitlements not seeded** — `subscription_entitlements` is empty for the group price IDs, so even paid groups grant no video access today.
3. **Shareable invite link** — coupon codes exist but there's no public `/join?code=XXX` URL to drop into an email or LMS.
4. **Auth UX for students** — `Auth.tsx` needs a coupon-code field (or dedicated `/join` page) that calls `register-with-coupon`.
5. **Email delivery** — after successful checkout the teacher sees the code on `/account`, but we don't email it. Optional but expected.
6. **Per-coupon seat caps** — coupon `max_redemptions` is set to the seat count of the most recent purchase. If a group buys more seats later we need a way to add a top-up (new coupon) or expand seats (expand `max_redemptions`).

## Plan

### 1. Persist group subscription state

Add columns to `group_purchases`:

- `stripe_subscription_id text`
- `status text default 'active'` — `active | past_due | canceled | incomplete`
- `current_period_end timestamptz`
- `cancel_at_period_end boolean default false`
- `seat_count int` — denormalized so coupons can match later

Update `verify-group-purchase` to:
- Retrieve the Checkout Session with `expand: ['subscription']`.
- Upsert the subscription id, status, and period end onto `group_purchases`.

Add a new edge function `sync-group-subscription` modeled after the existing `sync-subscription` for individuals. Called:
- Right after checkout success.
- When the group admin loads `/group-admin` (auto-refresh, debounce ~60s).
- Lazily when a student tries to play a gated video and the group's `current_period_end` is stale.

### 2. Gate student access by group subscription period

Update `user_has_video_access` so the group branch also requires the linked `group_purchases` row to be `status in ('active','trialing')` AND `current_period_end > now()`. Today it only checks that the row exists. This is the single change that delivers "same access for the same period of time as the group admin."

### 3. Seed entitlements

Insert two `subscription_entitlements` rows (audience='group', access_type='full') keyed to the existing monthly + annual group price IDs. Without these, `user_has_video_access` returns false even after a successful purchase.

If group plans ever support category-only access, add `audience='group', access_type='category', category_id=…` rows per category — the resolver already supports this.

### 4. Shareable invite link + dedicated /join page

Add a public route `/join` (and `/join/:code`) that:
- Pre-fills the coupon field from the URL.
- Shows the group name and "X seats remaining" (looked up via a new lightweight `GET` edge function `lookup-coupon` that returns only `{ groupName, seatsLeft, expiresAt, valid, reason }` — never sensitive data).
- Renders the email/password/full-name form and calls `register-with-coupon`.
- On success: shows "Check your email to verify, then sign in."

In `GroupAdminCoupons`, add a "Copy invite link" button next to "Copy code" that copies `${origin}/join/${code}`.

### 5. Improve teacher post-purchase experience

In `Account.tsx`, when redirected back with `?group_purchase=success&session_id=…`:
- Call `verify-group-purchase` (already does this).
- Show a success card with the generated coupon code, the invite link, seat count, and a "Copy" + "Email to students" button.
- Link to `/group-admin` for ongoing management.

Optionally email the teacher via a new `email-group-coupon` edge function (Resend-style template with the link). Mark this as nice-to-have; teacher already sees the code in-app.

### 6. Add coupon-code shortcut on the auth screen

In `Auth.tsx` (signup mode), add a small "Have a class code?" link that routes to `/join`. This avoids confusing existing direct signups while still giving students a discoverable path if they land on the main auth page.

### 7. Group admin self-service after purchase

In `GroupAdminCoupons`:
- Show subscription status badge (Active / Past due / Canceled, period end date) loaded from `group_purchases`.
- Disable "Regenerate" / "Toggle active" when the underlying subscription is no longer active.
- Add an "Expand seats" affordance that opens Stripe Customer Portal (existing `customer-portal` function works for any Stripe customer).

### 8. Tests / verification

- `register-with-coupon` already has rate limiting and rollback — re-verify with `supabase--curl_edge_functions` using a fresh code.
- After seeding entitlements, log in as a redeemed student and confirm `user_has_video_access(uid, video_id)` returns true via `read_query`.
- Cancel the group's Stripe subscription in test mode; confirm students lose access at period end.

## Technical notes (for implementer)

- New migration: `group_purchases` columns, plus an index on `(stripe_subscription_id)` and `(group_id, status)`.
- New migration: replace `user_has_video_access` body — the group branch becomes:
  ```sql
  JOIN public.group_purchases gp
    ON gp.group_id = gm.group_id
   AND gp.status IN ('active','trialing')
   AND (gp.current_period_end IS NULL OR gp.current_period_end > now())
  ```
  Keep the existing entitlement join.
- New migration: insert `subscription_entitlements` rows for the group monthly + annual price IDs.
- Edge functions follow project rules: Deno native `fetch` to Stripe REST (no SDK), use existing `corsHeaders` style, validate input with the same patterns used in `register-with-coupon`.
- Frontend new files: `src/pages/Join.tsx`, route in `App.tsx`, "Copy invite link" button in `GroupAdminCoupons`.
- No changes to `categories`, `videos`, or individual subscription flows.

## Out of scope for this plan

- Bulk CSV roster import.
- Per-student email invitations from inside the app (could be a follow-up using Resend).
- Group admin assigning specific subcategories to specific students — current model gives every redeemed student the same access as the group purchase.
