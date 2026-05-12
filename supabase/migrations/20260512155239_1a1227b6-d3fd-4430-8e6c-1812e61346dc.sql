
UPDATE public.subscription_entitlements
   SET unit_amount = 4999, currency = 'usd'
 WHERE stripe_price_id = 'price_1SAaic4McSnLev84NI7X3yoJ' AND unit_amount IS NULL;

UPDATE public.subscription_entitlements
   SET unit_amount = 47999, currency = 'usd'
 WHERE stripe_price_id = 'price_1SAalG4McSnLev84jn52Eac4' AND unit_amount IS NULL;
