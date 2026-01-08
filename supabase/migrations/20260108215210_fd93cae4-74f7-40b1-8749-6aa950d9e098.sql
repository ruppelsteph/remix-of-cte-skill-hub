-- Add product_name column to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS product_name text;