

## Plan: Extend the existing Admin Portal

Good news — most of what you described already exists at `/admin`. I'll outline what's there, what's missing, and what I'd add.

### What already works today
- **Admin route** at `/admin`, gated by the `admin` role in `public.user_roles`.
- **Videos tab**: list, **add**, **edit (including descriptions)**, delete, filter by pathway, toggle active/free.
- **Orders tab**: full Stripe order history with amount, status, refunds.
- **Customers tab**: Stripe customers with their subscription status and per-customer charges/refund/cancel actions.
- **Pathways tab**: full CRUD for pathways.

### What's missing vs. your request
1. **"All users"** — the current Customers tab only shows people who have a Stripe customer record. Users who signed up but never paid are invisible.
2. **"All subscriptions"** — subscriptions are buried inside the customer detail dialog. There's no top-level list of every subscription across the platform.

### What I'll add

**1. New "Users" tab** (replaces or sits alongside Customers)
- Lists every row in `public.profiles` joined with `user_roles` and `subscriptions`.
- Columns: Email, Full Name, Role (`user`/`admin`), Subscription status, Signed up.
- Search by email/name.
- Action: promote/demote admin role (insert/delete in `user_roles`).
- Read straight from the DB via the existing RLS policy `Admins can view all profiles` — no edge function needed.

**2. New "Subscriptions" tab**
- Top-level list of every row in `public.subscriptions`, joined with `profiles` for the user email.
- Columns: User email, Product, Status, Current period end, Cancel-at-period-end flag, Created.
- Filter by status (active / canceled / past_due / all).
- Row action "Cancel" reuses the existing `admin-cancel-subscription` edge function.
- Read via existing `Admins can view all subscriptions` RLS policy.

**3. Videos tab — minor polish for "edit descriptions"**
- The edit dialog already supports description editing, but I'll add an **inline "Quick edit description"** affordance (pencil icon next to the title in the table that opens a small dialog with just the description field), so admins don't have to open the full edit form for that common task.

### Tab layout after changes
`Users · Subscriptions · Orders · Videos · Pathways` (5 tabs; the existing 4-column grid becomes 5).

### Technical notes
- **No schema changes required.** All target tables (`profiles`, `user_roles`, `subscriptions`) already exist with admin-friendly RLS.
- **No new edge functions required.** Role promotion uses direct `user_roles` insert/delete (RLS already allows admins). Subscription cancel reuses `admin-cancel-subscription`.
- **Files to add**: `src/components/admin/AdminUsers.tsx`, `src/components/admin/AdminSubscriptions.tsx`.
- **Files to edit**: `src/pages/Admin.tsx` (add two tabs, swap grid to 5 cols), `src/components/admin/AdminVideos.tsx` (add quick-description-edit dialog).
- **Data freshness**: subscription rows in `public.subscriptions` are kept in sync by the existing `sync-subscription` / `check-subscription` edge functions.

### Out of scope (ask if you want them)
- Bulk video CSV import.
- Per-user video access grants UI (table `video_access` exists but has no admin UI yet).
- Pulling auth-only users (people who exist in `auth.users` but somehow missing a `profiles` row) — the `handle_new_user` trigger should make this a non-issue.

