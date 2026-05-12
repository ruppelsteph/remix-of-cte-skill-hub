import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";

export interface StripePrice {
  price_id: string;
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_metadata: Record<string, string>;
  nickname: string | null;
  unit_amount: number | null;
  currency: string;
  interval: string | null;
}

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
}

interface ExistingMapping {
  stripe_price_id: string;
  audience: string;
}

interface RowState {
  selected: boolean;
  access_type: "full" | "category";
  category_id: string; // "" means none
  audience: "individual" | "group" | "both";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prices: StripePrice[];
  categories: Category[];
  existing: ExistingMapping[];
  onRefresh: () => Promise<void> | void;
  refreshing: boolean;
  onSaved: () => void;
}

const formatAmount = (cents: number | null, currency: string) => {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
};

const guessCategory = (productName: string, metadata: Record<string, string>, topCategories: Category[]): string => {
  if (metadata?.category_id) {
    const match = topCategories.find((c) => String(c.id) === metadata.category_id);
    if (match) return String(match.id);
  }
  const lower = productName.toLowerCase();
  const hit = topCategories.find((c) => lower.includes(c.name.toLowerCase()));
  return hit ? String(hit.id) : "";
};

export function AdminEntitlementsBulkSync({
  open,
  onOpenChange,
  prices,
  categories,
  existing,
  onRefresh,
  refreshing,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);

  const topCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );

  // existing price IDs (any audience counts as mapped)
  const mappedSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of existing) s.add(e.stripe_price_id);
    return s;
  }, [existing]);

  // Initialize row state when prices/categories change
  useEffect(() => {
    if (!open) return;
    const next: Record<string, RowState> = {};
    for (const p of prices) {
      const isMapped = mappedSet.has(p.price_id);
      const guessed = guessCategory(p.product_name, p.product_metadata, topCategories);
      const lower = p.product_name.toLowerCase();
      const looksFull = lower.includes("all") || lower.includes("full") || lower.includes("library");
      next[p.price_id] = {
        selected: !isMapped, // pre-check unmapped, leave mapped unchecked
        access_type: guessed && !looksFull ? "category" : "full",
        category_id: guessed,
        audience: "both",
      };
    }
    setRows(next);
  }, [open, prices, mappedSet, topCategories]);

  const updateRow = (priceId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [priceId]: { ...prev[priceId], ...patch } }));
  };

  const setAllAudience = (audience: RowState["audience"]) => {
    setRows((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k].selected) next[k] = { ...next[k], audience };
      }
      return next;
    });
  };

  const setAllAccess = (access_type: RowState["access_type"]) => {
    setRows((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k].selected) next[k] = { ...next[k], access_type };
      }
      return next;
    });
  };

  const handleSave = async () => {
    const payload: Array<{
      stripe_price_id: string;
      audience: "individual" | "group";
      billing_interval: "month" | "year";
      access_type: "full" | "category";
      category_id: number | null;
      unit_amount: number | null;
      currency: string;
      label: string | null;
    }> = [];

    const errors: string[] = [];

    for (const p of prices) {
      const r = rows[p.price_id];
      if (!r || !r.selected) continue;
      if (r.access_type === "category" && !r.category_id) {
        errors.push(`${p.product_name} needs a category`);
        continue;
      }
      const interval: "month" | "year" =
        p.interval === "year" ? "year" : "month";
      const audiences: Array<"individual" | "group"> =
        r.audience === "both" ? ["individual", "group"] : [r.audience];
      for (const aud of audiences) {
        payload.push({
          stripe_price_id: p.price_id,
          audience: aud,
          billing_interval: interval,
          access_type: r.access_type,
          category_id: r.access_type === "category" ? Number(r.category_id) : null,
          unit_amount: p.unit_amount,
          currency: p.currency,
          label: p.nickname || p.product_name,
        });
      }
    }

    if (errors.length) {
      toast({ variant: "destructive", title: "Fix before saving", description: errors.join(", ") });
      return;
    }
    if (payload.length === 0) {
      toast({ title: "Nothing to save", description: "Check at least one row." });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("subscription_entitlements")
      .upsert(payload, { onConflict: "stripe_price_id,audience" });
    setSaving(false);

    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
      return;
    }

    const distinctPrices = new Set(payload.map((p) => p.stripe_price_id)).size;
    toast({
      title: "Entitlements synced",
      description: `Mapped ${distinctPrices} Stripe price${distinctPrices === 1 ? "" : "s"}.`,
    });
    onSaved();
    onOpenChange(false);
  };

  const selectedCount = Object.values(rows).filter((r) => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sync entitlements from Stripe</DialogTitle>
          <DialogDescription>
            Already-mapped prices are unchecked by default. Pick what to map and save in one go.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 py-2 border-b">
          <Button variant="outline" size="sm" onClick={() => onRefresh()} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
          <span className="text-sm text-muted-foreground ml-2">Bulk apply to selected:</span>
          <Select onValueChange={(v) => setAllAccess(v as RowState["access_type"])}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Access type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full library</SelectItem>
              <SelectItem value="category">Single category</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => setAllAudience(v as RowState["audience"])}>
            <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Audience" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Individual & Group</SelectItem>
              <SelectItem value="individual">Individual only</SelectItem>
              <SelectItem value="group">Group only</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-sm text-muted-foreground">{selectedCount} selected</span>
        </div>

        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((p) => {
                const r = rows[p.price_id];
                if (!r) return null;
                const isMapped = mappedSet.has(p.price_id);
                return (
                  <TableRow key={p.price_id} className={r.selected ? "" : "opacity-60"}>
                    <TableCell>
                      <Checkbox
                        checked={r.selected}
                        onCheckedChange={(v) => updateRow(p.price_id, { selected: !!v })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{p.product_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.price_id}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatAmount(p.unit_amount, p.currency)}
                      <span className="text-muted-foreground text-xs ml-1">
                        / {p.interval === "year" ? "yr" : "mo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.access_type}
                        onValueChange={(v) => updateRow(p.price_id, { access_type: v as RowState["access_type"] })}
                        disabled={!r.selected}
                      >
                        <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full library</SelectItem>
                          <SelectItem value="category">Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.category_id || "__none__"}
                        onValueChange={(v) => updateRow(p.price_id, { category_id: v === "__none__" ? "" : v })}
                        disabled={!r.selected || r.access_type !== "category"}
                      >
                        <SelectTrigger className="h-8 w-[180px]">
                          <SelectValue placeholder="Pick category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {topCategories.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.audience}
                        onValueChange={(v) => updateRow(p.price_id, { audience: v as RowState["audience"] })}
                        disabled={!r.selected}
                      >
                        <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Individual & Group</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="group">Group</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isMapped ? (
                        <Badge variant="secondary">✓ mapped</Badge>
                      ) : (
                        <Badge variant="outline">new</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {prices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No active prices found in Stripe.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || selectedCount === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
