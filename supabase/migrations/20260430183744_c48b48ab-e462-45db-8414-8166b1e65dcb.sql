-- Replace the permissive UPDATE policy with one that prevents role changes by group admins.
DROP POLICY IF EXISTS "Group admins and site admins can update members" ON public.group_members;

-- Group admins can update rows in their group, but the role column change is blocked by trigger below.
CREATE POLICY "Group admins can update members (no role change)"
ON public.group_members
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_group_admin_of(group_id))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_group_admin_of(group_id));

-- Trigger to enforce that only site admins can change the role column.
CREATE OR REPLACE FUNCTION public.protect_group_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role to bypass.
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only site admins can change a group member''s role';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_group_member_role_trg ON public.group_members;
CREATE TRIGGER protect_group_member_role_trg
BEFORE UPDATE ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.protect_group_member_role();