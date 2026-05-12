import { useEffect, useState } from "react";
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
import { Loader2, Plus, Trash2 } from "lucide-react";

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

export function AdminEntitlements() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Entitlement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (eRes.error) {
      toast({ variant: "destructive", title: "Error loading entitlements", description: eRes.error.message });
    }
    if (cRes.error) {
      toast({ variant: "destructive", title: "Error loading categories", description: cRes.error.message });
    }
    setRows((eRes.data as Entitlement[]) ?? []);
    setCategories((cRes.data as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const topCategories = categories.filter((c) => c.parent_id === null);
  const categoryName = (id: number | null) =>
    id == null ? "—" : categories.find((c) => c.id === id)?.name ?? `#${id}`;

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
    const audiences: Array<"individual" | "group"> = form.mirror_audiences
      ? ["individual", "group"]
      : [form.audience];
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Subscription Entitlements</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Map Stripe price IDs to access scope (full library or a top-level category) and audience (individual or group).
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                Each row tells the access resolver what a Stripe price unlocks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Stripe price ID</Label>
                <Input
                  placeholder="price_..."
                  value={form.stripe_price_id}
                  onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value })}
                />
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
                  <TableHead>Stripe Price</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Display</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.stripe_price_id}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
