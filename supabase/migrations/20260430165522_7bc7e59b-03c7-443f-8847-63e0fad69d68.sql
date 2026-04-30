INSERT INTO public.subscription_entitlements (audience, stripe_price_id, access_type, billing_interval) VALUES
  ('individual','price_1SAaic4McSnLev84NI7X3yoJ','full','month'),
  ('individual','price_1SAalG4McSnLev84jn52Eac4','full','year'),
  ('group','price_1SAaic4McSnLev84NI7X3yoJ','full','month'),
  ('group','price_1SAalG4McSnLev84jn52Eac4','full','year')
ON CONFLICT DO NOTHING;