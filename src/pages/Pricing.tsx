import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Loader2, Users, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Audience = "individual" | "group";
type Interval = "month" | "year";
type AccessType = "full" | "category";

interface Entitlement {
  id: string;
  stripe_price_id: string;
  audience: Audience;
  billing_interval: Interval;
  access_type: AccessType;
  category_id: number | null;
  unit_amount: number | null;
  currency: string | null;
  label: string | null;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}

const ALL_ACCESS_KEY = "__full__";

const formatMoney = (cents: number | null, currency: string | null) => {
  if (cents == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};

const Pricing = () => {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedScope, setSelectedScope] = useState<string>(ALL_ACCESS_KEY);

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupScope, setGroupScope] = useState<string>(ALL_ACCESS_KEY);
  const [groupInterval, setGroupInterval] = useState<Interval>("year");
  const [seatCount, setSeatCount] = useState<string>("25");
  const [submittingGroup, setSubmittingGroup] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [eRes, cRes] = await Promise.all([
        supabase.from("subscription_entitlements").select("*"),
        supabase.from("categories").select("id,name,slug,parent_id").eq("is_active", true).order("name"),
      ]);
      setEntitlements((eRes.data as Entitlement[]) ?? []);
      setCategories((cRes.data as Category[]) ?? []);
      setLoading(false);
    })();
  }, []);

  /** scopeKey -> { audience -> { interval -> entitlement } } */
  const scopeMap = useMemo(() => {
    const map = new Map<string, Record<Audience, Partial<Record<Interval, Entitlement>>>>();
    for (const e of entitlements) {
      const key = e.access_type === "full" ? ALL_ACCESS_KEY : String(e.category_id);
      if (!map.has(key)) map.set(key, { individual: {}, group: {} });
      map.get(key)![e.audience][e.billing_interval] = e;
    }
    return map;
  }, [entitlements]);

  const topCategories = categories.filter((c) => c.parent_id === null);
  const categoryName = (id: number) =>
    categories.find((c) => c.id === id)?.name ?? `Category #${id}`;

  // Scopes that have at least one individual category-entitlement
  const categoryScopes = topCategories
    .map((c) => ({
      category: c,
      monthly: scopeMap.get(String(c.id))?.individual.month,
      annual: scopeMap.get(String(c.id))?.individual.year,
    }))
    .filter((s) => s.monthly || s.annual);

  const fullAccess = scopeMap.get(ALL_ACCESS_KEY)?.individual ?? {};
  const fullMonthly = fullAccess.month;
  const fullAnnual = fullAccess.year;

  // Group scopes — anything with a group entitlement
  const groupScopeOptions = [
    {
      key: ALL_ACCESS_KEY,
      label: "All categories (full library)",
      monthly: scopeMap.get(ALL_ACCESS_KEY)?.group.month,
      annual: scopeMap.get(ALL_ACCESS_KEY)?.group.year,
    },
    ...topCategories.map((c) => ({
      key: String(c.id),
      label: c.name,
      monthly: scopeMap.get(String(c.id))?.group.month,
      annual: scopeMap.get(String(c.id))?.group.year,
    })),
  ].filter((s) => s.monthly || s.annual);

  const handleCheckout = async (priceId: string) => {
    setLoadingPriceId(priceId);
    const result = await startCategoryCheckout(priceId, "/pricing");
    if ("ok" in result && !result.ok && !("redirected" in result)) {
      toast({
        title: "Checkout Error",
        description: result.error,
        variant: "destructive",
      });
    }
    setLoadingPriceId(null);
  };

  const openGroupDialog = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate(`/auth?mode=signup&redirect=/pricing&plan=group`);
      return;
    }
    setGroupDialogOpen(true);
  };

  const handleGroupCheckout = async () => {
    const trimmed = groupName.trim();
    if (!trimmed) {
      toast({ variant: "destructive", title: "Group name required" });
      return;
    }
    const scope = groupScopeOptions.find((s) => s.key === groupScope);
    const ent = groupInterval === "month" ? scope?.monthly : scope?.annual;
    if (!ent) {
      toast({ variant: "destructive", title: "Plan unavailable", description: "Please pick a different interval." });
      return;
    }
    setSubmittingGroup(true);
    try {
      const seats = Math.max(1, Math.min(1000, parseInt(seatCount, 10) || 25));
      const { data, error } = await supabase.functions.invoke("create-group-checkout", {
        body: { priceId: ent.stripe_price_id, groupName: trimmed, seatCount: seats },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (error) {
      console.error("Group checkout error:", error);
      toast({
        variant: "destructive",
        title: "Checkout Error",
        description: error instanceof Error ? error.message : "Failed to start group checkout.",
      });
    } finally {
      setSubmittingGroup(false);
    }
  };

  const renderPlanButton = (ent: Entitlement | undefined, label: string) => {
    if (!ent) {
      return (
        <Button disabled variant="outline" className="w-full">
          Unavailable
        </Button>
      );
    }
    const isLoading = loadingPriceId === ent.stripe_price_id;
    return (
      <Button
        className="w-full"
        onClick={() => handleCheckout(ent.stripe_price_id)}
        disabled={loadingPriceId !== null}
      >
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : label}
      </Button>
    );
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-secondary py-16 lg:py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-secondary-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg max-w-2xl mx-auto text-secondary-foreground">
            Subscribe to the full CTE Skills library, or just the category you need.
          </p>
        </div>
      </section>

      {/* All-Access */}
      <section className="py-16 lg:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-foreground">All-Access</h2>
            <p className="text-muted-foreground mt-2">
              Every video, every category. Best value for learners exploring multiple pathways.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Monthly */}
              <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                <h3 className="text-xl font-semibold text-card-foreground mb-2">Monthly</h3>
                <p className="text-muted-foreground text-sm mb-6">For individuals exploring CTE</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-card-foreground">
                    {formatMoney(fullMonthly?.unit_amount ?? null, fullMonthly?.currency ?? "usd") ?? "—"}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["Access all videos", "All CTE categories", "New content monthly", "Cancel anytime"].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                {renderPlanButton(fullMonthly, "Get Started")}
              </div>

              {/* Annual */}
              <div className="bg-card rounded-2xl p-8 border-2 border-primary shadow-lg relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Best Value
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-2">Annual</h3>
                <p className="text-muted-foreground text-sm mb-6">Save with yearly billing</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-card-foreground">
                    {formatMoney(fullAnnual?.unit_amount ?? null, fullAnnual?.currency ?? "usd") ?? "—"}
                  </span>
                  <span className="text-muted-foreground">/year</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["Access all videos", "All CTE categories", "New content monthly", "Priority support", "Downloadable resources"].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                {renderPlanButton(fullAnnual, "Get Started")}
              </div>

              {/* School / District */}
              <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                <h3 className="text-xl font-semibold text-card-foreground mb-2">School / District</h3>
                <p className="text-muted-foreground text-sm mb-6">Multi-seat licenses for institutions</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-card-foreground">Custom</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["Unlimited student access", "Teacher admin dashboard", "Usage analytics & reports", "LMS integration support", "Dedicated account manager"].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/schools">Contact Sales</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Single-Category Plans */}
      {categoryScopes.length > 0 && (
        <section className="py-16 lg:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <Layers className="h-10 w-10 text-primary mx-auto mb-3" />
              <h2 className="text-3xl font-bold text-foreground">Single-Category Plans</h2>
              <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                Just need one category? Subscribe to a single category and unlock every video in it.
              </p>
            </div>

            {/* Category picker */}
            <div className="max-w-md mx-auto mb-8">
              <Label className="text-sm font-medium">Choose a category</Label>
              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryScopes.map((s) => (
                    <SelectItem key={s.category.id} value={String(s.category.id)}>
                      {s.category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected category cards */}
            {(() => {
              const selected = categoryScopes.find((s) => String(s.category.id) === selectedScope)
                ?? categoryScopes[0];
              if (!selected) return null;
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                  <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                      {selected.category.name}
                    </div>
                    <h3 className="text-xl font-semibold text-card-foreground mb-2">Monthly</h3>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-card-foreground">
                        {formatMoney(selected.monthly?.unit_amount ?? null, selected.monthly?.currency ?? "usd") ?? "—"}
                      </span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <ul className="space-y-2 mb-8 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />All {selected.category.name} videos</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />New content as added</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />Cancel anytime</li>
                    </ul>
                    {renderPlanButton(selected.monthly, "Subscribe Monthly")}
                  </div>

                  <div className="bg-card rounded-2xl p-8 border-2 border-primary shadow-lg relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Best Value
                    </div>
                    <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                      {selected.category.name}
                    </div>
                    <h3 className="text-xl font-semibold text-card-foreground mb-2">Annual</h3>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-card-foreground">
                        {formatMoney(selected.annual?.unit_amount ?? null, selected.annual?.currency ?? "usd") ?? "—"}
                      </span>
                      <span className="text-muted-foreground">/year</span>
                    </div>
                    <ul className="space-y-2 mb-8 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />All {selected.category.name} videos</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />New content as added</li>
                      <li className="flex items-start gap-2"><CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />Save vs monthly</li>
                    </ul>
                    {renderPlanButton(selected.annual, "Subscribe Annually")}
                  </div>
                </div>
              );
            })()}

            <p className="text-center text-sm text-muted-foreground mt-8">
              Want access to everything?{" "}
              <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-primary underline">
                See the all-access plans
              </a>{" "}
              for the best value across all categories.
            </p>
          </div>
        </section>
      )}

      {/* Buy for a Group */}
      {groupScopeOptions.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto bg-card rounded-2xl p-8 border border-border shadow-sm text-center">
              <Users className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="text-xl font-semibold text-card-foreground mb-2">Buy for a Group</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-xl mx-auto">
                Subscribing on behalf of a class, team, or cohort? Pick the full library or a single
                category, set up a group now, and add students later.
              </p>
              <Button onClick={openGroupDialog} disabled={submittingGroup}>
                <Users className="mr-2 h-4 w-4" />
                Buy for a Group
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Group dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up your group</DialogTitle>
            <DialogDescription>
              Give your group a name and pick a plan. You'll be set as the group admin and can invite students after checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                placeholder="e.g. Lincoln High - Period 3"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Plan scope</Label>
              <Select value={groupScope} onValueChange={setGroupScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groupScopeOptions.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing interval</Label>
              <Select value={groupInterval} onValueChange={(v) => setGroupInterval(v as Interval)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seat-count">Number of seats</Label>
              <Input
                id="seat-count"
                type="number"
                min={1}
                max={1000}
                value={seatCount}
                onChange={(e) => setSeatCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                We'll generate a coupon code with this many redemptions for your students.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)} disabled={submittingGroup}>
              Cancel
            </Button>
            <Button onClick={handleGroupCheckout} disabled={submittingGroup}>
              {submittingGroup ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : "Continue to checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CTA */}
      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-secondary-foreground mb-4">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of students and educators already using CTE Skills.
          </p>
          {fullAnnual ? (
            <Button size="lg" onClick={() => handleCheckout(fullAnnual.stripe_price_id)} disabled={loadingPriceId !== null}>
              {loadingPriceId === fullAnnual.stripe_price_id ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <>Start Learning Today <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          ) : (
            <Button asChild size="lg"><Link to="/auth?mode=signup">Create Account</Link></Button>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Pricing;
