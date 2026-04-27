## Plan: Add `group_admin` role with groups & group memberships

### Goal
Introduce a third role (`group_admin`) so a user can own a group and manage students inside it. No purchasing/coupons yet.

---

### 1. Database changes (single migration)

**a. Extend `app_role` enum**
- Add `'group_admin'` value to existing `app_role` enum (keeps `user_roles` table as the source of truth — same pattern as `admin`).

**b. Extend `profiles`**
- Add `role text not null default 'user'` with a CHECK constraint limiting values to `'user' | 'admin' | 'group_admin'`. This is a denormalized convenience field per the spec; authoritative role checks still go through `user_roles` + `has_role()`.
- Add `group_id uuid` (nullable) — points to the group a user belongs to (filled in for students and the owning group_admin).

**c. New table: `groups`**
```
id          uuid pk default gen_random_uuid()
name        text not null
created_by  uuid not null  -- references auth.users(id) implicitly (no FK to auth.users per Lovable rules)
created_at  timestamptz not null default now()
```
- Enable RLS.
- FK from `profiles.group_id` → `groups(id) on delete set null` added after table exists.

**d. New table: `group_members`**
```
id          uuid pk default gen_random_uuid()
group_id    uuid not null references public.groups(id) on delete cascade
user_id     uuid not null
role        text not null check (role in ('group_admin','student'))
created_at  timestamptz not null default now()
unique (group_id, user_id)
```
- Enable RLS.

**e. Helper security-definer function (avoids RLS recursion)**
```
public.is_group_admin_of(_group_id uuid)
  returns boolean
  language sql stable security definer set search_path = public
  as $$
    select exists (
      select 1 from public.group_members
      where group_id = _group_id
        and user_id = auth.uid()
        and role = 'group_admin'
    )
  $$;
```

**f. Trigger: when a user becomes `group_admin`**
- Trigger on `INSERT` into `public.user_roles` where `role = 'group_admin'`:
  1. Create a new row in `groups` with `name = 'New Group'` (placeholder, editable later) and `created_by = NEW.user_id`.
  2. Insert `(group_id, user_id, role='group_admin')` into `group_members`.
  3. Update the user's `profiles.role = 'group_admin'` and `profiles.group_id = <new group id>`.
- Mirror trigger to keep `profiles.role` in sync when an `admin` row is inserted/deleted from `user_roles` (so the convenience column stays accurate).

---

### 2. RLS policies

**`groups`**
- SELECT: members of the group OR admins.
  `is_group_admin_of(id) OR exists(select 1 from group_members where group_id = groups.id and user_id = auth.uid()) OR has_role(auth.uid(),'admin')`
- UPDATE: group_admin of the group OR site admin.
- INSERT: site admin only (group_admins get their group via the trigger, not a direct insert).
- DELETE: site admin only.

**`group_members`**
- SELECT (own membership): `user_id = auth.uid()`.
- SELECT (manage): `is_group_admin_of(group_id) OR has_role(auth.uid(),'admin')`.
- INSERT: `is_group_admin_of(group_id) OR has_role(auth.uid(),'admin')`, with check that the new row's role is `'student'` for group_admins (only site admins can add another `group_admin`).
- UPDATE / DELETE: `is_group_admin_of(group_id) OR has_role(auth.uid(),'admin')`.

(`profiles` policies stay as-is.)

---

### 3. Frontend changes (minimal — wiring only, no new pages yet)

- **`src/components/admin/AdminUsers.tsx`**
  - Widen `RoleRow.role` type to `'admin' | 'user' | 'group_admin'`.
  - Replace the single Demote/Promote button with a small role selector (user / admin / group_admin) that inserts/deletes the corresponding `user_roles` row. Selecting `group_admin` inserts the role; the DB trigger does the rest.
  - Show the role in the existing Role column (admin / group_admin / user badge).
- **`src/contexts/AuthContext.tsx`**
  - Add `isGroupAdmin: boolean` derived from a `has_role(_, 'group_admin')` check (parallel to `checkAdminRole`). Expose on context.
- **`src/integrations/supabase/types.ts`** is auto-generated — no manual edits.

No new routes/pages this round; group dashboard UI is out of scope per "Do not implement purchasing or coupons yet" and to keep the change small. We can add `/group` admin UI in a follow-up.

---

### 4. Out of scope (call out for later)
- A dedicated Group Admin dashboard (invite students, list members, rename group).
- Linking purchases/coupons to groups.
- Bulk seat assignment, billing per seat.

---

### Technical notes
- Roles authority remains `public.user_roles` + `has_role()` — no privilege checks read from `profiles.role`. The new `profiles.role` column is only for display convenience and is kept in sync by triggers.
- `group_id` on `profiles` is nullable; only set automatically for the group_admin's own group. Students get `group_id` populated when added to `group_members` (via trigger).
- Enum value addition (`alter type ... add value 'group_admin'`) must run in its own statement before being used — handled in the migration ordering.
