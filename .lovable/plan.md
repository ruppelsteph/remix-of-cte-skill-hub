# Provider + ID input for video sources

Make the admin Edit Video form accept either a full URL or just a YouTube/Vimeo ID, by introducing an explicit Provider selector. We normalize to a canonical URL **on save** so the existing player code keeps working unchanged.

## Why this approach

- The player in `src/pages/VideoDetail.tsx` already converts canonical YouTube/Vimeo URLs into embed URLs (`buildEmbedUrl`). If we store canonical URLs, no player changes are needed.
- Storing canonical URLs (not bare IDs) keeps `video_sources.video_url` self-describing, so any other consumer (exports, debugging, future players) still works.
- Provider is explicit, so a numeric Vimeo ID can't be confused with anything else.

## UI changes (`src/components/admin/AdminVideos.tsx`)

Replace the single "Video URL" input with two fields:

1. **Provider** — Select with options: `YouTube`, `Vimeo`, `Other (full URL)`.
2. **Video ID or URL** — Text input. Helper text adapts to provider:
   - YouTube: "Paste the video ID (e.g. `dQw4w9WgXcQ`) or a full YouTube URL"
   - Vimeo: "Paste the numeric ID (e.g. `123456789`) or a full Vimeo URL"
   - Other: "Paste the full embeddable URL"

When opening Edit on an existing video, detect the provider from the stored URL and pre-fill the field with the extracted ID (or the full URL for "Other").

## Save-time normalization

Before upserting into `video_sources`, normalize to a canonical URL:

```text
YouTube  -> https://www.youtube.com/watch?v=<ID>
Vimeo    -> https://vimeo.com/<ID>
Other    -> stored as entered (basic http(s) validation)
```

Extraction rules for the input field:

- **YouTube**: accept `dQw4w9WgXcQ` (11 chars, `[A-Za-z0-9_-]`), or extract ID from `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/embed/<id>`, `youtube.com/shorts/<id>`.
- **Vimeo**: accept all-digit ID, or extract from `vimeo.com/<digits>` and `player.vimeo.com/video/<digits>`.
- **Other**: must start with `http://` or `https://`, otherwise show a validation error and block save.

If extraction fails for YouTube/Vimeo, show an inline error ("Couldn't recognize that as a YouTube/Vimeo ID or URL") and block save.

## What does NOT change

- Database schema (`video_sources.video_url` stays a `text` column with full URLs).
- RLS policies.
- `VideoDetail.tsx` player and `buildEmbedUrl` (already handles canonical URLs).
- Edge functions / seed import.

## Files touched

- `src/components/admin/AdminVideos.tsx` — form fields, prefill-on-edit, normalization, validation.

## Out of scope (call out if you want them)

- Auto-fetching titles/thumbnails from YouTube/Vimeo oEmbed.
- Supporting additional providers (Wistia, Loom, direct MP4 metadata, etc.).
- Migrating already-stored URLs (existing rows are already canonical-ish and will continue to work).
