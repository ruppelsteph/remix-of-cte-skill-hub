## Switch category images to S3 (us-east-1, bucket `cte-email-assets`)

### Step 1 — Export 36 images for you to upload
Copy `src/assets/category-*.jpg` into `/mnt/documents/categories/` and surface them as artifacts so you can download them and drag-and-drop into the S3 console upload dialog (set Content-Type `image/jpeg` and Cache-Control `public, max-age=31536000, immutable` in the Properties step).

### Step 2 — Update `src/pages/Videos.tsx`
- Remove all 36 `import xxxImg from "@/assets/category-*.jpg"` lines.
- Remove `CATEGORY_IMAGE_BY_SLUG` map.
- Add:
  ```ts
  const S3_BASE = "https://cte-email-assets.s3.us-east-1.amazonaws.com/categories";
  const KNOWN_CATEGORY_SLUGS = new Set([ /* the 36 slugs */ ]);
  const imageUrlForSlug = (slug: string) =>
    KNOWN_CATEGORY_SLUGS.has(slug) ? `${S3_BASE}/${slug}.jpg` : null;
  ```
- Update `imageForCategory` to walk the parent chain using `imageUrlForSlug`.
- Add `onError` handler on `<img>` to hide broken images (the `FolderOpen` icon placeholder remains visible underneath via conditional rendering).

### Step 3 — Delete local assets
Delete the 36 `src/assets/category-*.jpg` files to shrink the bundle.

### Fallback
If S3 returns 403/CORS or a slug has no image uploaded yet, the `onError` handler hides the `<img>` and the existing `FolderOpen` placeholder shows — no broken layout.

### After approval
Switch to default mode and apply.
