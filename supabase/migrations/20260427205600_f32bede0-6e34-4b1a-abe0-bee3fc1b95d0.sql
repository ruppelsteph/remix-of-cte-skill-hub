ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.categories SET is_active = false;

WITH roots AS (
  SELECT id FROM public.categories
   WHERE parent_id IS NULL
     AND slug IN ('industrial', 'buildings-trades', 'cosmetology')
),
tree AS (
  SELECT d.id
    FROM roots r
    CROSS JOIN LATERAL public.category_descendants(r.id) AS d
)
UPDATE public.categories c
   SET is_active = true
  FROM tree t
 WHERE c.id = t.id;