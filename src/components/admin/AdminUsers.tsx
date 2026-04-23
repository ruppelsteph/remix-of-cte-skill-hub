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
import { Loader2, Users, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  stripe_customer_id: string | null;
}

interface RoleRow {
  user_id: string;
  role: "admin" | "user";
}

interface SubscriptionRow {
  user_id: string;
  status: string;
  product_name: string | null;
}

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, rolesRes, subsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("subscriptions").select("user_id, status, product_name"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (subsRes.error) throw subsRes.error;
      setProfiles(profilesRes.data || []);
      setRoles((rolesRes.data || []) as RoleRow[]);
      setSubscriptions(subsRes.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isAdmin = (userId: string) =>
    roles.some((r) => r.user_id === userId && r.role === "admin");

  const getSubscription = (userId: string) =>
    subscriptions.find((s) => s.user_id === userId);

  const togglePromotion = async (userId: string) => {
    setUpdatingId(userId);
    try {
      if (isAdmin(userId)) {
        if (currentUser?.id === userId) {
          toast({
            variant: "destructive",
            title: "Action blocked",
            description: "You can't remove your own admin role.",
          });
          setUpdatingId(null);
          return;
        }
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (error) throw error;
        toast({ title: "Admin role removed" });
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert([{ user_id: userId, role: "admin" }]);
        if (error) throw error;
        toast({ title: "Admin role granted" });
      }
      await fetchData();
    } catch (err) {
      console.error("Error updating role:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update role.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.email.toLowerCase().includes(q) ||
      (p.full_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Signed up</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const admin = isAdmin(p.user_id);
                  const sub = getSubscription(p.user_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.email}</TableCell>
                      <TableCell>{p.full_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={admin ? "default" : "secondary"}>
                          {admin ? "admin" : "user"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub ? (
                          <div className="flex flex-col">
                            <Badge
                              variant={sub.status === "active" ? "default" : "secondary"}
                              className="w-fit"
                            >
                              {sub.status}
                            </Badge>
                            {sub.product_name && (
                              <span className="text-xs text-muted-foreground mt-1">
                                {sub.product_name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(p.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePromotion(p.user_id)}
                          disabled={updatingId === p.user_id}
                        >
                          {updatingId === p.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : admin ? (
                            <>
                              <ShieldOff className="h-4 w-4 mr-1" />
                              Demote
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-4 w-4 mr-1" />
                              Make admin
                            </>
                          )}
                        </Button>
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
