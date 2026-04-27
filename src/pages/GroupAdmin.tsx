import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Ticket, Users } from "lucide-react";
import { GroupAdminCoupons } from "@/components/group-admin/GroupAdminCoupons";
import { GroupAdminStudents } from "@/components/group-admin/GroupAdminStudents";

const GroupAdmin = () => {
  const { user, isLoading, isGroupAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("coupons");

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    } else if (!isLoading && user && !isGroupAdmin && !isAdmin) {
      navigate("/");
    }
  }, [user, isLoading, isGroupAdmin, isAdmin, navigate]);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isGroupAdmin && !isAdmin) return null;

  return (
    <Layout>
      <div className="py-8">
        <div className="container-wide">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Group Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your group's coupon codes and view enrolled students.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex mb-6">
              <TabsTrigger value="coupons" className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                <span>Coupon Codes</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Students</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="coupons">
              <GroupAdminCoupons />
            </TabsContent>

            <TabsContent value="students">
              <GroupAdminStudents />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default GroupAdmin;
