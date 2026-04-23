import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, CreditCard, Filter, Ban } from "lucide-react";

interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: string;
  product_name: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  email: string;
}

export function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [subsRes, profilesRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, email"),
      ]);
      if (subsRes.error) throw subsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      setSubscriptions(subsRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (err) {
      console.error("Error fetching subscriptions:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch subscriptions.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getEmail = (userId: string) =>
    profiles.find((p) => p.user_id === userId)?.email || "—";

  const handleCancel = async (sub: SubscriptionRow, immediately: boolean) => {
    setCancellingId(sub.id);
    try {
      const { error } = await supabase.functions.invoke(
        "admin-cancel-subscription",
        {
          body: {
            subscriptionId: sub.stripe_subscription_id,
            immediately,
          },
        }
      );
      if (error) throw error;
      toast({
        title: immediately
          ? "Subscription cancelled immediately"
          : "Subscription set to cancel at period end",
      });
      await fetchData();
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel subscription.",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const filtered =
    statusFilter === "all"
      ? subscriptions
      : subscriptions.filter((s) => s.status === statusFilter);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="past_due">Past Due</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No subscriptions found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub) => {
                  const isCancelable =
                    sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        {getEmail(sub.user_id)}
                      </TableCell>
                      <TableCell>{sub.product_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={sub.status === "active" ? "default" : "secondary"}
                            className="w-fit"
                          >
                            {sub.status}
                          </Badge>
                          {sub.cancel_at_period_end && (
                            <Badge variant="outline" className="w-fit text-xs">
                              cancels at period end
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.current_period_end
                          ? new Date(sub.current_period_end).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {new Date(sub.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {isCancelable && !sub.cancel_at_period_end && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={cancellingId === sub.id}
                                className="text-destructive hover:text-destructive"
                              >
                                {cancellingId === sub.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Ban className="h-4 w-4 mr-1" />
                                    Cancel
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Choose whether to cancel at the end of the current
                                  billing period (recommended) or immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep active</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancel(sub, false)}
                                >
                                  Cancel at period end
                                </AlertDialogAction>
                                <AlertDialogAction
                                  onClick={() => handleCancel(sub, true)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Cancel immediately
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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
  );
}
