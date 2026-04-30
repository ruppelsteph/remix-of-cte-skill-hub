// Refreshes status / current_period_end on group_purchases rows for a given group
// by re-fetching the underlying Stripe subscriptions. Callable by the group admin or a site admin.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SYNC-GROUP-SUB] ${step}${d}`);
};

const STRIPE_BASE = "https://api.stripe.com/v1";

async function stripeGet(path: string, key: string): Promise<any> {
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Stripe ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function epochToISO(value: unknown): string | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isFinite(n)) return null;
  const ms = n < 1e11 ? n * 1000 : n < 1e14 ? n : Math.floor(n / 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: u, error: ue } = await auth.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !u.user) throw new Error("Not authenticated");
    const user = u.user;

    const body = await req.json().catch(() => ({}));
    const groupId: string | undefined = body?.groupId;
    if (!groupId) throw new Error("groupId is required");

    // Authorization: site admin or group_admin of this group.
    const [{ data: adminRow }, { data: membership }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
      admin.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).maybeSingle(),
    ]);
    if (!adminRow && membership?.role !== "group_admin") {
      throw new Error("Not authorized");
    }

    const { data: purchases, error: pe } = await admin
      .from("group_purchases")
      .select("id, stripe_subscription_id")
      .eq("group_id", groupId);
    if (pe) throw new Error(pe.message);

    const updates: Array<Record<string, unknown>> = [];
    for (const p of purchases ?? []) {
      if (!p.stripe_subscription_id) continue;
      try {
        const sub = await stripeGet(`/subscriptions/${p.stripe_subscription_id}`, stripeKey);
        const update = {
          status: sub.status,
          current_period_end: epochToISO(sub.current_period_end),
          cancel_at_period_end: !!sub.cancel_at_period_end,
        };
        await admin.from("group_purchases").update(update).eq("id", p.id);
        updates.push({ id: p.id, ...update });
      } catch (err) {
        log("Skip purchase sync", { id: p.id, err: (err as Error).message });
      }
    }

    log("Synced", { groupId, count: updates.length });
    return new Response(JSON.stringify({ synced: true, updates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
