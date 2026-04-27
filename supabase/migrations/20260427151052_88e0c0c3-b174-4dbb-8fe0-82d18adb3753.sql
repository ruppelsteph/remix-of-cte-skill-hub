
CREATE TABLE IF NOT EXISTS public.group_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  product_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_purchases ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_group_purchases_group_id ON public.group_purchases(group_id);

-- Group admins and site admins can view their group's purchases
CREATE POLICY "Group admins and site admins can view group purchases"
ON public.group_purchases FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);

-- Inserts go through edge function (service role bypasses RLS); also allow group/site admins to insert
CREATE POLICY "Group admins and site admins can insert group purchases"
ON public.group_purchases FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR public.is_group_admin_of(group_id)
);

CREATE POLICY "Site admins can delete group purchases"
ON public.group_purchases FOR DELETE
USING (has_role(auth.uid(), 'admin'));
