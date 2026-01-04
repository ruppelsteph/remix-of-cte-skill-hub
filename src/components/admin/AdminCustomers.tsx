import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, RefreshCw, DollarSign, XCircle } from "lucide-react";
import { format } from "date-fns";

interface Charge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  refunded: boolean;
  payment_intent: string;
  created: number;
}

interface Customer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  subscription: {
    id: string;
    status: string;
    current_period_end: number;
    cancel_at_period_end: boolean;
  } | null;
  charges: Charge[];
}

export function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [refundingCharge, setRefundingCharge] = useState<string | null>(null);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const { toast } = useToast();

  const fetchCustomers = async (email?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (email) params.append("email", email);
      
      const { data, error } = await supabase.functions.invoke("admin-customers", {
        body: null,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (error) throw error;
      setCustomers(data.customers || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch customers. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(searchEmail);
  };

  const handleRefund = async (paymentIntentId: string) => {
    setRefundingCharge(paymentIntentId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-refund", {
        body: { paymentIntentId },
      });

      if (error) throw error;
      
      toast({
        title: "Refund processed",
        description: `Refund of $${(data.refund.amount / 100).toFixed(2)} was successful.`,
      });
      
      // Refresh customer data
      fetchCustomers();
      setSelectedCustomer(null);
    } catch (err) {
      console.error("Error processing refund:", err);
      toast({
        variant: "destructive",
        title: "Refund failed",
        description: "Failed to process refund. Please try again.",
      });
    } finally {
      setRefundingCharge(null);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string, immediately: boolean) => {
    setCancellingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-cancel-subscription", {
        body: { subscriptionId, immediately },
      });

      if (error) throw error;
      
      toast({
        title: "Subscription cancelled",
        description: immediately 
          ? "Subscription was cancelled immediately." 
          : "Subscription will be cancelled at the end of the billing period.",
      });
      
      fetchCustomers();
      setSelectedCustomer(null);
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      toast({
        variant: "destructive",
        title: "Cancellation failed",
        description: "Failed to cancel subscription. Please try again.",
      });
    } finally {
      setCancellingSubscription(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Customer Management</span>
          <Button variant="outline" size="sm" onClick={() => fetchCustomers()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No customers found.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.email}</TableCell>
                    <TableCell>{customer.name || "-"}</TableCell>
                    <TableCell>
                      {customer.subscription ? (
                        <Badge
                          variant={
                            customer.subscription.status === "active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {customer.subscription.status}
                          {customer.subscription.cancel_at_period_end && " (cancelling)"}
                        </Badge>
                      ) : (
                        <Badge variant="outline">No subscription</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(customer.created * 1000), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Customer Detail Dialog */}
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
              <DialogDescription>
                {selectedCustomer?.email}
              </DialogDescription>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-6">
                {/* Subscription Section */}
                <div>
                  <h4 className="font-medium mb-3">Subscription</h4>
                  {selectedCustomer.subscription ? (
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge>{selectedCustomer.subscription.status}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Renews</span>
                        <span>
                          {format(
                            new Date(selectedCustomer.subscription.current_period_end * 1000),
                            "MMM d, yyyy"
                          )}
                        </span>
                      </div>
                      {selectedCustomer.subscription.status === "active" && (
                        <div className="pt-3 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleCancelSubscription(selectedCustomer.subscription!.id, false)
                            }
                            disabled={cancellingSubscription}
                          >
                            {cancellingSubscription && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Cancel at Period End
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleCancelSubscription(selectedCustomer.subscription!.id, true)
                            }
                            disabled={cancellingSubscription}
                          >
                            {cancellingSubscription && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Cancel Immediately
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No active subscription</p>
                  )}
                </div>

                {/* Charges Section */}
                <div>
                  <h4 className="font-medium mb-3">Recent Charges</h4>
                  {selectedCustomer.charges.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCustomer.charges.map((charge) => (
                        <div
                          key={charge.id}
                          className="flex items-center justify-between bg-muted rounded-lg p-3"
                        >
                          <div>
                            <div className="font-medium">
                              {formatCurrency(charge.amount, charge.currency)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(charge.created * 1000), "MMM d, yyyy")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {charge.refunded ? (
                              <Badge variant="secondary">Refunded</Badge>
                            ) : charge.status === "succeeded" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefund(charge.payment_intent as string)}
                                disabled={refundingCharge === charge.payment_intent}
                              >
                                {refundingCharge === charge.payment_intent ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Refund
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Badge variant="outline">{charge.status}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No charges found</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
