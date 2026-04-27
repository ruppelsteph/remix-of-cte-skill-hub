import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Find groups where this user is group_admin
    const { data: adminMemberships, error: memErr } = await admin
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId)
      .eq("role", "group_admin");

    if (memErr) {
      return new Response(JSON.stringify({ error: memErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groupIds = (adminMemberships ?? []).map((m) => m.group_id);
    if (groupIds.length === 0) {
      return new Response(JSON.stringify({ students: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch student members for these groups
    const { data: students, error: stuErr } = await admin
      .from("group_members")
      .select("user_id, group_id, created_at, role")
      .in("group_id", groupIds)
      .eq("role", "student");

    if (stuErr) {
      return new Response(JSON.stringify({ error: stuErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentUserIds = (students ?? []).map((s) => s.user_id);
    let profilesMap: Record<string, { email: string; full_name: string | null }> = {};

    if (studentUserIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", studentUserIds);
      for (const p of profiles ?? []) {
        profilesMap[p.user_id] = { email: p.email, full_name: p.full_name };
      }
    }

    const result = (students ?? []).map((s) => ({
      user_id: s.user_id,
      group_id: s.group_id,
      joined_at: s.created_at,
      email: profilesMap[s.user_id]?.email ?? null,
      full_name: profilesMap[s.user_id]?.full_name ?? null,
    }));

    return new Response(JSON.stringify({ students: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
