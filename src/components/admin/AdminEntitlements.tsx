import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown, Loader2, Plus, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { AdminEntitlementsBulkSync, type StripePrice } from "./AdminEntitlementsBulkSync";

interface Entitlement {
  id: string;
  stripe_price_id: string;
  audience: "individual" | "group";
  billing_interval: "month" | "year";
  access_type: "full" | "category";
  category_id: number | null;
  unit_amount: number | null;
  currency: string | null;
  label: string | null;
}

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
}

const NONE = "__none__";

const formatAmount = (cents: number | null, currency: string | null) => {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`;
  }
};

export function AdminEntitlements() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Entitlement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stripePrices, setStripePrices] = useState<StripePrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const [form, setForm] = useState({
    stripe_price_id: "",
    audience: "individual" as "individual" | "group",
    billing_interval: "month" as "month" | "year",
    access_type: "category" as "full" | "category",
    category_id: NONE,
    unit_amount_dollars: "",
    currency: "usd",
    label: "",
    mirror_audiences: true,
  });

  const fetchAll = async () => {
    setLoading(true);
    const [eRes, cRes] = await Promise.all([
      supabase.from("subscription_entitlements").select("*").order("created_at"),
      supabase.from("categories").select("id,name,parent_id").order("name"),
    ]);
    if (eRes.error) toast({ variant: "destructive", title: "Error loading entitlements", description: eRes.error.message });
    if (cRes.error) toast({ variant: "destructive", title: "Error loading categories", description: cRes.error.message });
    setRows((eRes.data as Entitlement[]) ?? []);
    setCategories((cRes.data as Category[]) ?? []);
    setLoading(false);
  };

  const fetchStripePrices = async () => {
    setPricesLoading(true);
    const { data, error } = await supabase.functions.invoke("list-stripe-prices");
    setPricesLoading(false);
    if (error) {
      toast({ variant: "destructive", title: "Couldn't load Stripe prices", description: error.message });
      return;
    }
    setStripePrices(((data as { prices?: StripePrice[] })?.prices) ?? []);
  };

  useEffect(() => {
    fetchAll();
    fetchStripePrices();
  }, []);

  const topCategories = useMemo(() => categories.filter((c) => c.parent_id === null), [categories]);
  const categoryName = (id: number | null) =>
    id == null ? "—" : categories.find((c) => c.id === id)?.name ?? `#${id}`;

  const mappedPriceIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.stripe_price_id);
    return s;
  }, [rows]);

  const knownPriceIds = useMemo(() => new Set(stripePrices.map((p) => p.price_id)), [stripePrices]);

  // Group prices by product
  const groupedPrices = useMemo(() => {
    const groups = new Map<string, { product_name: string; prices: StripePrice[] }>();
    for (const p of stripePrices) {
      const g = groups.get(p.product_id) ?? { product_name: p.product_name, prices: [] };
      g.prices.push(p);
      groups.set(p.product_id, g);
    }
    return Array.from(groups.values()).sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [stripePrices]);

  const resetForm = () =>
    setForm({
      stripe_price_id: "",
      audience: "individual",
      billing_interval: "month",
      access_type: "category",
      category_id: NONE,
      unit_amount_dollars: "",
      currency: "usd",
      label: "",
      mirror_audiences: true,
    });

  const handlePickPrice = (p: StripePrice) => {
    const lower = p.product_name.toLowerCase();
    const looksFull = lower.includes("all") || lower.includes("full") || lower.includes("library");
    const guessed = topCategories.find(
      (c) =>
        p.product_metadata?.category_id === String(c.id) ||
        lower.includes(c.name.toLowerCase())
    );
    setForm((f) => ({
      ...f,
      stripe_price_id: p.price_id,
      billing_interval: (p.interval === "year" ? "year" : "month") as "month" | "year",
      unit_amount_dollars: p.unit_amount != null ? (p.unit_amount / 100).toFixed(2) : "",
      currency: p.currency || "usd",
      label: p.nickname || p.product_name,
      access_type: guessed && !looksFull ? "category" : "full",
      category_id: guessed && !looksFull ? String(guessed.id) : NONE,
    }));
    setPickerOpen(false);
  };

  const handleAdd = async () => {
    const priceId = form.stripe_price_id.trim();
    if (!priceId.startsWith("price_")) {
      toast({ variant: "destructive", title: "Invalid price ID", description: "Must start with 'price_'." });
      return;
    }
    if (form.access_type === "category" && form.category_id === NONE) {
      toast({ variant: "destructive", title: "Pick a category", description: "Category access requires a category." });
      return;
    }
    setSaving(true);
    const dollars = parseFloat(form.unit_amount_dollars);
    const unit_amount = Number.isFinite(dollars) ? Math.round(dollars * 100) : null;
    const base = {
      stripe_price_id: priceId,
      billing_interval: form.billing_interval,
      access_type: form.access_type,
      category_id: form.access_type === "category" ? Number(form.category_id) : null,
      unit_amount,
      currency: form.currency.trim() || "usd",
      label: form.label.trim() || null,
    };
    const audiences: Array<"individual" | "group"> = form.mirror_audiences ? ["individual", "group"] : [form.audience];
    const payload = audiences.map((audience) => ({ ...base, audience }));
    const { error } = await supabase
      .from("subscription_entitlements")
      .upsert(payload, { onConflict: "stripe_price_id,audience" });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
      return;
    }
    toast({ title: "Entitlement saved" });
    setDialogOpen(false);
    resetForm();
    setManualMode(false);
    await fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("subscription_entitlements").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
      return;
    }
    toast({ title: "Entitlement deleted" });
    await fetchAll();
  };

  const selectedPrice = stripePrices.find((p) => p.price_id === form.stripe_price_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle>Subscription Entitlements</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Map Stripe prices to access scope (full library or a top-level category) and audience.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchStripePrices} disabled={pricesLoading}>
            {pricesLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh Stripe
          </Button>
          <Button variant="secondary" onClick={() => setBulkOpen(true)} disabled={stripePrices.length === 0}>
            Sync from Stripe
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(v) => {
              setDialogOpen(v);
              if (!v) {
                resetForm();
                setManualMode(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Add entitlement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Map a Stripe price</DialogTitle>
                <DialogDescription>
                  Pick a Stripe price; we auto-fill amount, interval, and label. You only choose access scope.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Stripe price</Label>
                  {!manualMode ? (
                    <>
                      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                          >
                            {selectedPrice ? (
                              <span className="truncate">
                                {selectedPrice.product_name} · {formatAmount(selectedPrice.unit_amount, selectedPrice.currency)}
                                /{selectedPrice.interval === "year" ? "yr" : "mo"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                {pricesLoading ? "Loading prices…" : "Select a Stripe price"}
                              </span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search products or prices…" />
                            <CommandList className="max-h-[300px]">
                              <CommandEmpty>No prices found.</CommandEmpty>
                              {groupedPrices.map((group) => (
                                <CommandGroup key={group.product_name} heading={group.product_name}>
                                  {group.prices.map((p) => {
                                    const isMapped = mappedPriceIds.has(p.price_id);
                                    return (
                                      <CommandItem
                                        key={p.price_id}
                                        value={`${group.product_name} ${p.interval} ${p.price_id} ${p.nickname ?? ""}`}
                                        onSelect={() => handlePickPrice(p)}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            form.stripe_price_id === p.price_id ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm">
                                            {p.interval === "year" ? "Annual" : "Monthly"} ·{" "}
                                            {formatAmount(p.unit_amount, p.currency)}
                                          </div>
                                          <div className="text-xs text-muted-foreground font-mono truncate">
                                            {p.price_id}
                                          </div>
                                        </div>
                                        {isMapped && (
                                          <Badge variant="secondary" className="ml-2 shrink-0">
                                            mapped
                                          </Badge>
                                        )}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <button
                        type="button"
                        onClick={() => setManualMode(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Enter price ID manually
                      </button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder="price_..."
                        value={form.stripe_price_id}
                        onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setManualMode(false)}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Use Stripe picker
                      </button>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Billing interval</Label>
                    <Select
                      value={form.billing_interval}
                      onValueChange={(v) => setForm({ ...form, billing_interval: v as "month" | "year" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="year">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Access type</Label>
                    <Select
                      value={form.access_type}
                      onValueChange={(v) => setForm({ ...form, access_type: v as "full" | "category" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full library</SelectItem>
                        <SelectItem value="category">Single category</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.access_type === "category" && (
                  <div className="space-y-2">
                    <Label>Top-level category</Label>
                    <Select
                      value={form.category_id}
                      onValueChange={(v) => setForm({ ...form, category_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {topCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Display price (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="49.99"
                      value={form.unit_amount_dollars}
                      onChange={(e) => setForm({ ...form, unit_amount_dollars: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder="e.g. Welding — Annual"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select
                    value={form.mirror_audiences ? "both" : form.audience}
                    onValueChange={(v) => {
                      if (v === "both") setForm({ ...form, mirror_audiences: true });
                      else setForm({ ...form, mirror_audiences: false, audience: v as "individual" | "group" });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Individual & Group (recommended)</SelectItem>
                      <SelectItem value="individual">Individual only</SelectItem>
                      <SelectItem value="group">Group only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No entitlements yet.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Display</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const stripePrice = stripePrices.find((p) => p.price_id === r.stripe_price_id);
                  const productLabel = r.label || stripePrice?.product_name || r.stripe_price_id;
                  const isStale = stripePrices.length > 0 && !knownPriceIds.has(r.stripe_price_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {productLabel}
                          {isStale && <Badge variant="destructive">stale</Badge>}
                        </div>
                        <a
                          href={`https://dashboard.stripe.com/prices/${r.stripe_price_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground font-mono hover:text-foreground inline-flex items-center gap-1"
                        >
                          {r.stripe_price_id}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{r.audience}</Badge></TableCell>
                      <TableCell>{r.billing_interval === "month" ? "Monthly" : "Annual"}</TableCell>
                      <TableCell>{r.access_type === "full" ? "Full library" : "Category"}</TableCell>
                      <TableCell>{categoryName(r.category_id)}</TableCell>
                      <TableCell>{formatAmount(r.unit_amount, r.currency)}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete entitlement?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Subscribers on this price will lose access immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(r.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AdminEntitlementsBulkSync
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        prices={stripePrices}
        categories={categories}
        existing={rows.map((r) => ({ stripe_price_id: r.stripe_price_id, audience: r.audience }))}
        onRefresh={fetchStripePrices}
        refreshing={pricesLoading}
        onSaved={fetchAll}
      />
    </Card>
  );
}
