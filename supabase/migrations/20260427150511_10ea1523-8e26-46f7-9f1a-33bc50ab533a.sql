
-- 2. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','admin','group_admin')),
  ADD COLUMN IF NOT EXISTS group_id uuid;

-- 3. Groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_groups_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FK from profiles.group_id to groups
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;

-- 4. group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('group_admin','student')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);

-- 5. Security definer helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_group_admin_of(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = auth.uid()
      AND role = 'group_admin'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_admin_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_admin_of(uuid) TO authenticated;

-- Helper: list group ids the current user belongs to (also avoids recursion)
CREATE OR REPLACE FUNCTION public.current_user_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_group_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_group_ids() TO authenticated;

-- 6. Trigger: when a user is granted group_admin role, auto-create their group
CREATE OR REPLACE FUNCTION public.handle_group_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_group_id uuid;
  user_name text;
BEGIN
  IF NEW.role = 'group_admin' THEN
    SELECT COALESCE(full_name, email, 'New') INTO user_name
      FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;

    INSERT INTO public.groups (name, created_by)
    VALUES (COALESCE(user_name, 'New') || '''s Group', NEW.user_id)
    RETURNING id INTO new_group_id;

    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (new_group_id, NEW.user_id, 'group_admin')
    ON CONFLICT (group_id, user_id) DO NOTHING;

    UPDATE public.profiles
       SET role = 'group_admin', group_id = new_group_id
     WHERE user_id = NEW.user_id;

  ELSIF NEW.role = 'admin' THEN
    UPDATE public.profiles SET role = 'admin' WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_role_insert
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.handle_group_admin_role();

-- Trigger: when a privileged role is removed, downgrade profiles.role
CREATE OR REPLACE FUNCTION public.handle_user_role_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IN ('admin','group_admin') THEN
    -- Recompute: prefer admin > group_admin > user
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'admin') THEN
      UPDATE public.profiles SET role = 'admin' WHERE user_id = OLD.user_id;
    ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'group_admin') THEN
      UPDATE public.profiles SET role = 'group_admin' WHERE user_id = OLD.user_id;
    ELSE
      UPDATE public.profiles SET role = 'user' WHERE user_id = OLD.user_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_user_role_delete
AFTER DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.handle_user_role_delete();

-- 7. RLS policies for groups
CREATE POLICY "Members and admins can view groups"
ON public.groups FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR id IN (SELECT public.current_user_group_ids())
);

CREATE POLICY "Group admins and site admins can update groups"
ON public.groups FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(id)
);

CREATE POLICY "Site admins can insert groups"
ON public.groups FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Site admins can delete groups"
ON public.groups FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 8. RLS policies for group_members
CREATE POLICY "Users can view their own membership"
ON public.group_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Group admins and site admins can view members"
ON public.group_members FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);

CREATE POLICY "Group admins can add students; site admins can add anyone"
ON public.group_members FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR (public.is_group_admin_of(group_id) AND role = 'student')
);

CREATE POLICY "Group admins and site admins can update members"
ON public.group_members FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);

CREATE POLICY "Group admins and site admins can remove members"
ON public.group_members FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);
