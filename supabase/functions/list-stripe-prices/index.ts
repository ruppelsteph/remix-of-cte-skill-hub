import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[LIST-STRIPE-PRICES] ${step}${details ? " - " + JSON.stringify(details) : ""}`);
};

interface StripePrice {
  id: string;
  active: boolean;
  unit_amount: number | null;
  currency: string;
  nickname: string | null;
  recurring: { interval: string } | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    metadata: Record<string, string>;
    active: boolean;
  } | string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Auth failed");

    const { data: isAdminData, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr) throw new Error(`Role check failed: ${roleErr.message}`);
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Paginate through Stripe prices
    const all: StripePrice[] = [];
    let startingAfter: string | null = null;
    for (let i = 0; i < 10; i++) {
      const params = new URLSearchParams({
        "active": "true",
        "limit": "100",
        "expand[]": "data.product",
      });
      if (startingAfter) params.set("starting_after", startingAfter);
      const res = await fetch(`https://api.stripe.com/v1/prices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Stripe error: ${t}`);
      }
      const json = await res.json();
      const data: StripePrice[] = json.data ?? [];
      all.push(...data);
      if (!json.has_more || data.length === 0) break;
      startingAfter = data[data.length - 1].id;
    }

    log("Fetched prices", { count: all.length });

    const prices = all.map((p) => {
      const product = typeof p.product === "string"
        ? { id: p.product, name: p.product, description: null, metadata: {}, active: true }
        : p.product;
      return {
        price_id: p.id,
        product_id: product.id,
        product_name: product.name,
        product_description: product.description,
        product_metadata: product.metadata ?? {},
        nickname: p.nickname,
        unit_amount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval ?? null,
      };
    });

    return new Response(JSON.stringify({ prices }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
