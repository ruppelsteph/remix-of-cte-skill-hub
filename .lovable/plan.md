# Why you're seeing the full video

Your account (`ruppelpublishing@gmail.com`) is **not** an admin. The reason you have access is a **stale row** in `public.subscriptions`:

- Stripe (source of truth) returns **0 subscriptions** for your customer (`cus_TkwlZNU0You1VA`) — see the latest `check-subscription` logs: `"No active or trialing subscription found"`.
- But `public.subscriptions` still has a row for you with `status='active'`, `price_id=price_1SAaic4McSnLev84NI7X3yoJ`, `current_period_end=NULL`, last updated 2026-01-09.
- That price has a `subscription_entitlements` row with `audience='individual'`, `access_type='full'`.
- The DB function `user_has_video_access` checks the local `subscriptions` table (not Stripe), sees `status IN ('active','trialing')` with a `full` entitlement, and returns `true`.
- RLS policy `View full sources with access` then exposes the Vimeo source on `video_sources`, so the player loads the full video instead of the YouTube preview.

So the UI flag `isSubscribed` (computed live from Stripe in `check-subscription`) is `false`, but the server-side access check (RLS / RPC) trusts the stale DB row. They disagree, and the RLS path wins for video playback.

# Fix

Two changes, both server-side. No frontend changes required.

## 1. Make `check-subscription` write back to `public.subscriptions`

When the edge function runs, it already knows the truth from Stripe. Have it reconcile the local table for the current user:

- If Stripe returns an active/trialing subscription: upsert the row (status, price_id, product_id, current_period_end, cancel_at_period_end, etc.).
- If Stripe returns no active/trialing subscription: mark any local rows for this `user_id` whose status is `active` or `trialing` as `canceled` and clear `current_period_end` if it's in the past.

This runs whenever the user (or any client) calls `check-subscription`, which AuthContext does on login and on focus, so stale rows self-heal quickly.

## 2. Tighten `user_has_video_access` for individual subs

Defensive belt-and-suspenders so a stale row can't grant access even if step 1 hasn't run yet. Update the individual-subscription branch of the function to also require:

```
AND (s.current_period_end IS NULL OR s.current_period_end > now())
```

(This already exists for the group-purchase branch — we mirror it for `subscriptions`.) Rows with a NULL period end stay valid only while `status` is active/trialing; once step 1 flips them to canceled, they drop out.

Group access logic stays unchanged.

# Technical changes

- **Edge function** `supabase/functions/check-subscription/index.ts`
  - After computing `selectedSubscription`, use the existing service-role `supabaseClient` to:
    - On no active/trialing: `update public.subscriptions set status='canceled', updated_at=now() where user_id=$user and status in ('active','trialing')`.
    - On active/trialing: `upsert` into `public.subscriptions` keyed by `stripe_subscription_id` with the latest fields.
- **Migration** updating `public.user_has_video_access` to add the period-end guard on the individual subscription EXISTS clause.

# Out of scope

- No UI changes. `VideoCard`, `VideoDetail`, and `AuthContext` already behave correctly once `user_has_video_access` returns `false`.
- Webhook-based syncing (more robust long term) — not required to resolve this bug.
