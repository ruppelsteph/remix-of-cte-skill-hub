## Add category images to `public/categories/` for GitHub access

### Step 1 — Restore the 36 images
Copy the 36 category images from `/mnt/documents/categories/` (already exported there) into `public/categories/<slug>.jpg`. Filenames will exactly match the S3 keys (e.g. `public/categories/industrial.jpg`, `public/categories/hvac-basics.jpg`).

Files like:
- `public/categories/industrial.jpg`
- `public/categories/buildings-trades.jpg`
- `public/categories/cosmetology.jpg`
- ... (all 36 slugs from `KNOWN_CATEGORY_SLUGS` in `src/pages/Videos.tsx`)

### Step 2 — No code changes required
`src/pages/Videos.tsx` already loads images from S3 via `S3_BASE`. The `public/categories/` files are purely a GitHub-accessible mirror for you to download and bulk-upload to S3. They are not bundled by Vite (the `public/` folder is served as-is and only fetched if referenced).

### Step 3 — How you'll use them
Once synced to GitHub, you can:
- Browse to `public/categories/` in your repo and download individual files, or
- `git clone` the repo and drag the entire `public/categories/` folder into the S3 console upload dialog (set Content-Type `image/jpeg` and Cache-Control `public, max-age=31536000, immutable` in the Properties step).

### Notes
- Slight bundle/repo size increase (~36 jpgs in `public/`) but zero JS bundle impact.
- If you later decide you don't want them in the repo after S3 is populated, we can delete `public/categories/` in one step.
