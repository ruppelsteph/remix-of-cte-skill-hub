import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, Calendar, Power, Copy, Link as LinkIcon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Coupon {
  id: string;
  group_id: string;
  code: string;
  max_redemptions: number;
  redemption_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CLASS-${suffix}`;
}

interface GroupPurchaseStatus {
  group_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  seat_count: number | null;
}

export function GroupAdminCoupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [purchases, setPurchases] = useState<GroupPurchaseStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expDialog, setExpDialog] = useState<{ open: boolean; coupon: Coupon | null; value: string }>({
    open: false,
    coupon: null,
    value: "",
  });

  const inviteLinkFor = (code: string) =>
    `${window.location.origin}/join/${encodeURIComponent(code)}`;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // Find admin's group(s)
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id)
      .eq("role", "group_admin");

    const groupIds = (memberships ?? []).map((m) => m.group_id);
    if (groupIds.length === 0) {
      setCoupons([]);
      setPurchases([]);
      setLoading(false);
      return;
    }

    const [{ data: codes, error }, { data: purchaseRows }] = await Promise.all([
      supabase
        .from("group_coupon_codes")
        .select("*")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("group_purchases")
        .select("group_id, status, current_period_end, cancel_at_period_end, seat_count")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false }),
    ]);

    if (error) {
      toast.error("Failed to load coupons: " + error.message);
    } else {
      setCoupons((codes ?? []) as Coupon[]);
    }
    setPurchases((purchaseRows ?? []) as GroupPurchaseStatus[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const syncSubscription = async () => {
    const groupId = purchases[0]?.group_id ?? coupons[0]?.group_id;
    if (!groupId) return;
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-group-subscription", {
        body: { groupId },
      });
      if (error) {
        toast.error("Could not refresh subscription status.");
      } else {
        toast.success("Subscription status refreshed.");
        await load();
      }
    } finally {
      setSyncing(false);
    }
  };

  // Most-recent purchase summary for the header banner
  const latestPurchase = purchases[0];
  const subscriptionExpired =
    latestPurchase &&
    (!["active", "trialing"].includes(latestPurchase.status) ||
      (latestPurchase.current_period_end &&
        new Date(latestPurchase.current_period_end) < new Date()));

  const regenerate = async (coupon: Coupon) => {
    setBusyId(coupon.id);
    // Rely on the unique constraint to detect rare collisions; retry up to 5 times.
    let lastError: string | null = null;
    let success = false;
    let finalCode = "";
    for (let attempt = 0; attempt < 5 && !success; attempt++) {
      const newCode = generateCode();
      const { error } = await supabase
        .from("group_coupon_codes")
        .update({ code: newCode })
        .eq("id", coupon.id);
      if (!error) {
        success = true;
        finalCode = newCode;
      } else if (error.code === "23505") {
        // Code collision — try a fresh one
        continue;
      } else {
        lastError = error.message;
        break;
      }
    }

    if (success) {
      toast.success(`New code: ${finalCode}`);
      await load();
    } else {
      toast.error("Failed to regenerate: " + (lastError ?? "code collision"));
    }
    setBusyId(null);
  };

  const toggleActive = async (coupon: Coupon) => {
    setBusyId(coupon.id);
    const { error } = await supabase
      .from("group_coupon_codes")
      .update({ is_active: !coupon.is_active })
      .eq("id", coupon.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success(coupon.is_active ? "Coupon deactivated" : "Coupon activated");
      await load();
    }
    setBusyId(null);
  };

  const openExpDialog = (coupon: Coupon) => {
    setExpDialog({
      open: true,
      coupon,
      value: coupon.expires_at ? coupon.expires_at.slice(0, 10) : "",
    });
  };

  const saveExpiration = async () => {
    if (!expDialog.coupon) return;
    setBusyId(expDialog.coupon.id);
    const newValue = expDialog.value
      ? new Date(expDialog.value + "T23:59:59Z").toISOString()
      : null;

    const { error } = await supabase
      .from("group_coupon_codes")
      .update({ expires_at: newValue })
      .eq("id", expDialog.coupon.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success("Expiration date updated");
      setExpDialog({ open: false, coupon: null, value: "" });
      await load();
    }
    setBusyId(null);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const copyInviteLink = (code: string) => {
    navigator.clipboard.writeText(inviteLinkFor(code));
    toast.success("Invite link copied — paste it in an email to your students.");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {latestPurchase && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                Group subscription
                {subscriptionExpired ? (
                  <Badge variant="destructive">Inactive</Badge>
                ) : latestPurchase.cancel_at_period_end ? (
                  <Badge variant="secondary">Ending soon</Badge>
                ) : (
                  <Badge>Active</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {subscriptionExpired
                  ? "Students currently can't access videos through this group. Renew the subscription to restore access."
                  : latestPurchase.current_period_end
                    ? `Students keep access until ${format(new Date(latestPurchase.current_period_end), "MMMM d, yyyy")}.`
                    : "Students have access while your subscription stays active."}
                {latestPurchase.seat_count != null && ` Up to ${latestPurchase.seat_count} student seat${latestPurchase.seat_count === 1 ? "" : "s"} available.`}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={syncSubscription} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </CardHeader>
          {subscriptionExpired && (
            <CardContent>
              <div className="flex items-start gap-2 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4 mt-0.5" />
                <span>
                  Your group subscription has lapsed. Visit your account to renew, then refresh here.
                </span>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Class codes & invite links</CardTitle>
          <CardDescription>
            Share these with your students. Each redemption uses one seat. Once a student signs up
            with the code, they automatically get the same access you purchased for as long as your
            group subscription stays active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No class codes yet. A code is generated automatically after a successful group purchase.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Seats Used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => {
                    const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                    const isFull = c.redemption_count >= c.max_redemptions;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <button
                            onClick={() => copyCode(c.code)}
                            className="flex items-center gap-2 font-mono font-semibold text-primary hover:underline"
                          >
                            {c.code}
                            <Copy className="h-3 w-3" />
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className={isFull ? "text-destructive font-medium" : ""}>
                            {c.redemption_count} / {c.max_redemptions}
                          </span>
                        </TableCell>
                        <TableCell>
                          {c.expires_at ? (
                            <span className={isExpired ? "text-destructive" : ""}>
                              {format(new Date(c.expires_at), "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!c.is_active ? (
                            <Badge variant="secondary">Inactive</Badge>
                          ) : isExpired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : isFull ? (
                            <Badge variant="destructive">Full</Badge>
                          ) : (
                            <Badge>Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => regenerate(c)}
                              disabled={busyId === c.id}
                              title="Regenerate code"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openExpDialog(c)}
                              disabled={busyId === c.id}
                              title="Set expiration"
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleActive(c)}
                              disabled={busyId === c.id}
                              title={c.is_active ? "Deactivate" : "Activate"}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={expDialog.open}
        onOpenChange={(open) => setExpDialog((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Expiration Date</DialogTitle>
            <DialogDescription>
              Choose when this coupon code should expire. Leave blank for no expiration.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="date"
              value={expDialog.value}
              onChange={(e) => setExpDialog((s) => ({ ...s, value: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExpDialog((s) => ({ ...s, value: "" }))}
            >
              Clear
            </Button>
            <Button onClick={saveExpiration} disabled={busyId !== null}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
