import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, FolderOpen } from "lucide-react";

interface PathwayData {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  video_count: number;
  is_active: boolean;
  created_at: string;
}

export function AdminPathways() {
  const [pathways, setPathways] = useState<PathwayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPathway, setEditingPathway] = useState<PathwayData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    icon: "GraduationCap",
    color: "from-primary to-primary/80",
    is_active: true,
  });

  const fetchPathways = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pathways")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPathways(data || []);
    } catch (err) {
      console.error("Error fetching pathways:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch pathways.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPathways();
  }, []);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      icon: "GraduationCap",
      color: "from-primary to-primary/80",
      is_active: true,
    });
    setEditingPathway(null);
  };

  const handleEdit = (pathway: PathwayData) => {
    setEditingPathway(pathway);
    setFormData({
      title: pathway.title,
      description: pathway.description || "",
      icon: pathway.icon || "GraduationCap",
      color: pathway.color || "from-primary to-primary/80",
      is_active: pathway.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const pathwayData = {
        title: formData.title,
        description: formData.description || null,
        icon: formData.icon,
        color: formData.color,
        is_active: formData.is_active,
      };

      if (editingPathway) {
        const { error } = await supabase
          .from("pathways")
          .update(pathwayData)
          .eq("id", editingPathway.id);
        if (error) throw error;
        toast({ title: "Pathway updated successfully" });
      } else {
        const { error } = await supabase.from("pathways").insert([pathwayData]);
        if (error) throw error;
        toast({ title: "Pathway created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPathways();
    } catch (err) {
      console.error("Error saving pathway:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save pathway.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pathway?")) return;

    try {
      const { error } = await supabase.from("pathways").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Pathway deleted successfully" });
      fetchPathways();
    } catch (err) {
      console.error("Error deleting pathway:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete pathway.",
      });
    }
  };

  const iconOptions = [
    "GraduationCap", "Wrench", "Stethoscope", "Scale", "Building2",
    "Leaf", "Palette", "Cpu", "Car", "Utensils"
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pathway Management</span>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Pathway
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingPathway ? "Edit Pathway" : "Add New Pathway"}</DialogTitle>
                <DialogDescription>
                  {editingPathway ? "Update pathway details" : "Create a new CTE pathway"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="icon">Icon</Label>
                    <select
                      id="icon"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {iconOptions.map((icon) => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="color">Color Gradient</Label>
                    <Input
                      id="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="from-primary to-primary/80"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingPathway ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : pathways.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No pathways yet. Add your first pathway!</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Videos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pathways.map((pathway) => (
                  <TableRow key={pathway.id}>
                    <TableCell className="font-medium">{pathway.title}</TableCell>
                    <TableCell>{pathway.video_count}</TableCell>
                    <TableCell>
                      <Badge variant={pathway.is_active ? "default" : "secondary"}>
                        {pathway.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(pathway)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pathway.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
