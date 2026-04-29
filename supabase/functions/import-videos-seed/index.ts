// One-shot importer for video seed data. Requires admin caller.
// Delete this function after running.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";
import data from "./data.json" with { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Row {
  title: string;
  slug: string;
  description: string;
  category_id_new: number;
  yt: string | null;
  vm: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Not authenticated");

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Admin role required");

    const rows = data as Row[];
    let videosUpserted = 0;
    let sourcesInserted = 0;
    let videosSkipped = 0;
    let thumbnailsSet = 0;
    const errors: string[] = [];

    for (const r of rows) {
      if (!r.slug) {
        videosSkipped++;
        continue;
      }
      const thumbnail_url = r.yt
        ? `https://i.ytimg.com/vi/${r.yt}/hqdefault.jpg`
        : null;

      // Upsert video by slug. Set thumbnail when we have a yt id.
      const upsertPayload: Record<string, unknown> = {
        title: r.title,
        slug: r.slug,
        description: r.description,
        category_id_new: r.category_id_new,
        is_active: true,
        is_free: false,
      };
      if (thumbnail_url) upsertPayload.thumbnail_url = thumbnail_url;

      const { data: vid, error: vErr } = await supabase
        .from("videos")
        .upsert(upsertPayload, { onConflict: "slug" })
        .select("id")
        .single();

      if (vErr || !vid) {
        errors.push(`${r.slug}: ${vErr?.message ?? "no id"}`);
        continue;
      }
      videosUpserted++;
      if (thumbnail_url) thumbnailsSet++;

      // Only fill missing: skip if this video already has any source rows.
      const { count: existingCount, error: cErr } = await supabase
        .from("video_sources")
        .select("id", { count: "exact", head: true })
        .eq("video_id", vid.id);
      if (cErr) {
        errors.push(`${r.slug} count: ${cErr.message}`);
        continue;
      }
      if ((existingCount ?? 0) > 0) {
        videosSkipped++;
        continue;
      }

      const sources: Array<Record<string, unknown>> = [];
      if (r.yt) {
        sources.push({
          video_id: vid.id,
          video_url: `https://www.youtube.com/watch?v=${r.yt}`,
          is_preview: true,
          kind: "youtube",
        });
      }
      if (r.vm) {
        sources.push({
          video_id: vid.id,
          video_url: `https://vimeo.com/${r.vm}`,
          is_preview: false,
          kind: "vimeo",
        });
      }
      if (sources.length) {
        const { error: sErr } = await supabase.from("video_sources").insert(sources);
        if (sErr) errors.push(`${r.slug} sources: ${sErr.message}`);
        else sourcesInserted += sources.length;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        videos_inserted: videosInserted,
        sources_inserted: sourcesInserted,
        errors: errors.slice(0, 20),
        error_count: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
