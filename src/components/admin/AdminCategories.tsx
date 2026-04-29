import { useState, useEffect, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, FolderTree, ChevronRight } from "lucide-react";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  is_active: boolean;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
  videoCount: number;
  depth: number;
}

interface VideoLite {
  id: string;
  title: string;
  slug: string | null;
  is_active: boolean | null;
  is_free: boolean | null;
  duration: string | null;
  category_id_new: number | null;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [videoCounts, setVideoCounts] = useState<Map<number, number>>(new Map());
  const [allVideos, setAllVideos] = useState<VideoLite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [videosCategory, setVideosCategory] = useState<CategoryNode | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    parent_id: "" as string,
    is_active: true,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [catRes, vidRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase
          .from("videos")
          .select("id, title, slug, is_active, is_free, duration, category_id_new"),
      ]);
      if (catRes.error) throw catRes.error;
      if (vidRes.error) throw vidRes.error;

      const counts = new Map<number, number>();
      (vidRes.data || []).forEach((v: any) => {
        if (v.category_id_new != null) {
          counts.set(v.category_id_new, (counts.get(v.category_id_new) || 0) + 1);
        }
      });

      setCategories(catRes.data || []);
      setVideoCounts(counts);
      setAllVideos((vidRes.data || []) as VideoLite[]);
    } catch (err) {
      console.error("Error fetching categories:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load categories." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Build a tree (DFS) for display
  const tree = useMemo<CategoryNode[]>(() => {
    const byId = new Map<number, CategoryNode>();
    categories.forEach((c) =>
      byId.set(c.id, { ...c, children: [], videoCount: videoCounts.get(c.id) || 0, depth: 0 })
    );
    const roots: CategoryNode[] = [];
    byId.forEach((node) => {
      if (node.parent_id && byId.has(node.parent_id)) {
        byId.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    const sortRec = (nodes: CategoryNode[], depth: number) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((n) => {
        n.depth = depth;
        sortRec(n.children, depth + 1);
      });
    };
    sortRec(roots, 0);
    return roots;
  }, [categories, videoCounts]);

  const flat = useMemo<CategoryNode[]>(() => {
    const out: CategoryNode[] = [];
    const walk = (nodes: CategoryNode[]) => {
      nodes.forEach((n) => {
        out.push(n);
        walk(n.children);
      });
    };
    walk(tree);
    return out;
  }, [tree]);

  // Compute descendants for a given id (to prevent assigning self/descendant as parent)
  const descendantIds = (id: number): Set<number> => {
    const ids = new Set<number>();
    const walk = (nodes: CategoryNode[]) => {
      nodes.forEach((n) => {
        ids.add(n.id);
        walk(n.children);
      });
    };
    const node = flat.find((n) => n.id === id);
    if (node) walk(node.children);
    return ids;
  };

  const resetForm = () => {
    setFormData({ name: "", slug: "", description: "", parent_id: "", is_active: true });
    setEditing(null);
  };

  const openCreate = (parentId?: number) => {
    resetForm();
    if (parentId) {
      setFormData((f) => ({ ...f, parent_id: String(parentId) }));
    }
    setIsDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setFormData({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      parent_id: c.parent_id ? String(c.parent_id) : "",
      is_active: c.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || slugify(formData.name),
        description: formData.description.trim() || null,
        parent_id: formData.parent_id ? Number(formData.parent_id) : null,
        is_active: formData.is_active,
      };

      if (editing) {
        // Prevent setting self or a descendant as parent (would create a cycle)
        if (payload.parent_id) {
          const blocked = descendantIds(editing.id);
          if (payload.parent_id === editing.id || blocked.has(payload.parent_id)) {
            throw new Error("A category cannot be its own parent or a descendant.");
          }
        }
        const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Category updated" });
      } else {
        const { error } = await supabase.from("categories").insert([payload]);
        if (error) throw error;
        toast({ title: "Category created" });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error("Error saving category:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to save category.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (c: CategoryNode) => {
    if (c.children.length > 0) {
      toast({
        variant: "destructive",
        title: "Cannot delete",
        description: "Remove or reassign child categories first.",
      });
      return;
    }
    if (c.videoCount > 0) {
      if (!confirm(`This category has ${c.videoCount} video(s). They will be unassigned. Continue?`)) return;
      const { error: vErr } = await supabase
        .from("videos")
        .update({ category_id_new: null })
        .eq("category_id_new", c.id);
      if (vErr) {
        toast({ variant: "destructive", title: "Error", description: vErr.message });
        return;
      }
    } else {
      if (!confirm(`Delete category "${c.name}"?`)) return;
    }
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ title: "Category deleted" });
    fetchData();
  };

  // Parent options for the form: exclude self and descendants (when editing)
  const parentOptions = useMemo(() => {
    const blocked = editing ? new Set<number>([editing.id, ...descendantIds(editing.id)]) : new Set<number>();
    return flat.filter((n) => !blocked.has(n.id));
  }, [flat, editing]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Category Management
          </span>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => openCreate()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Category" : "Add New Category"}</DialogTitle>
                <DialogDescription>
                  Categories support a hierarchy. Pick a parent to nest this category under it.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((f) => ({
                        ...f,
                        name,
                        slug: editing ? f.slug : slugify(name),
                      }));
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="auto-generated from name"
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
                <div>
                  <Label htmlFor="parent">Parent Category</Label>
                  <Select
                    value={formData.parent_id || "none"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, parent_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None (top-level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (top-level)</SelectItem>
                      {parentOptions.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {"— ".repeat(c.depth)}
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    {editing ? "Update" : "Create"}
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
        ) : flat.length === 0 ? (
          <div className="text-center py-12">
            <FolderTree className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No categories yet. Create your first one above.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {flat.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2 hover:bg-accent/40 transition-colors"
                style={{ marginLeft: `${c.depth * 24}px` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {c.depth > 0 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setVideosCategory(c)}
                        className="font-medium truncate text-left hover:text-primary hover:underline focus:outline-none focus:text-primary"
                        title="View videos in this category"
                      >
                        {c.name}
                      </button>
                      {!c.is_active && <Badge variant="secondary">Inactive</Badge>}
                      <Badge variant="outline" className="text-xs">
                        {c.videoCount} video{c.videoCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    {c.description && (
                      <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCreate(c.id)}
                    title="Add subcategory"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(c)}
                    className="text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Videos in category dialog */}
      <Dialog open={!!videosCategory} onOpenChange={(open) => !open && setVideosCategory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Videos in “{videosCategory?.name}”
            </DialogTitle>
            <DialogDescription>
              {videosCategory
                ? `${allVideos.filter((v) => v.category_id_new === videosCategory.id).length} video(s) directly assigned to this category.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {videosCategory &&
              (() => {
                const list = allVideos.filter((v) => v.category_id_new === videosCategory.id);
                if (list.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No videos assigned to this category yet.
                    </p>
                  );
                }
                return list.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{v.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {v.duration && (
                          <span className="text-xs text-muted-foreground">{v.duration}</span>
                        )}
                        {v.is_free && <Badge variant="outline" className="text-xs">Free</Badge>}
                        {v.is_active === false && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideosCategory(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
