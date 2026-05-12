
ALTER TABLE public.subscription_entitlements
  ADD COLUMN IF NOT EXISTS unit_amount integer,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS label text;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_entitlements_price_audience_uidx
  ON public.subscription_entitlements (stripe_price_id, audience);
