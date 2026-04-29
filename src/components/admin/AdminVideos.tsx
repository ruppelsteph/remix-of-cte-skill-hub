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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, Video, Filter, X, FileText } from "lucide-react";

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  vimeo_url: string | null; // full source from video_sources (kind='vimeo')
  youtube_url: string | null; // preview source from video_sources (kind='youtube')
  duration: string | null;
  category_id_new: number | null;
  skill_level?: string;
  is_free: boolean;
  is_active: boolean;
  view_count: number;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
}

export function AdminVideos() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [quickEditVideo, setQuickEditVideo] = useState<VideoData | null>(null);
  const [quickDescription, setQuickDescription] = useState("");
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    thumbnail_url: "",
    video_provider: "youtube" as "youtube" | "vimeo" | "other",
    video_input: "",
    duration: "",
    category_id_new: "" as string,
    skill_level: "beginner",
    is_free: false,
    is_active: true,
  });
  const [videoInputError, setVideoInputError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [videosRes, categoriesRes, sourcesRes] = await Promise.all([
        supabase.from("videos").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").order("name"),
        supabase.from("video_sources").select("video_id, video_url"),
      ]);

      if (videosRes.error) throw videosRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (sourcesRes.error) throw sourcesRes.error;

      const urlByVideo = new Map<string, string>(
        (sourcesRes.data || []).map((s) => [s.video_id, s.video_url])
      );

      const merged: VideoData[] = (videosRes.data || []).map((v) => ({
        ...v,
        video_url: urlByVideo.get(v.id) ?? null,
      }));

      setVideos(merged);
      setCategories(categoriesRes.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch videos.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  // -------- Provider / URL helpers --------
  type Provider = "youtube" | "vimeo" | "other";

  const detectProvider = (url: string | null | undefined): Provider => {
    if (!url) return "youtube";
    if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
    if (/vimeo\.com/i.test(url)) return "vimeo";
    return "other";
  };

  const extractIdForEdit = (url: string | null | undefined, provider: Provider): string => {
    if (!url) return "";
    if (provider === "youtube") {
      const m =
        url.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
        url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
        url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/) ||
        url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
      return m ? m[1] : url;
    }
    if (provider === "vimeo") {
      const m =
        url.match(/player\.vimeo\.com\/video\/(\d+)/) ||
        url.match(/vimeo\.com\/(\d+)/);
      return m ? m[1] : url;
    }
    return url;
  };

  const normalizeToCanonicalUrl = (
    input: string,
    provider: Provider
  ): { url: string | null; error: string | null } => {
    const trimmed = input.trim();
    if (!trimmed) return { url: null, error: null };

    if (provider === "youtube") {
      // Bare 11-char ID
      if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
        return { url: `https://www.youtube.com/watch?v=${trimmed}`, error: null };
      }
      const m =
        trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
        trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
        trimmed.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/) ||
        trimmed.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
      if (m) return { url: `https://www.youtube.com/watch?v=${m[1]}`, error: null };
      return { url: null, error: "Couldn't recognize that as a YouTube ID or URL" };
    }

    if (provider === "vimeo") {
      if (/^\d+$/.test(trimmed)) {
        return { url: `https://vimeo.com/${trimmed}`, error: null };
      }
      const m =
        trimmed.match(/player\.vimeo\.com\/video\/(\d+)/) ||
        trimmed.match(/vimeo\.com\/(\d+)/);
      if (m) return { url: `https://vimeo.com/${m[1]}`, error: null };
      return { url: null, error: "Couldn't recognize that as a Vimeo ID or URL" };
    }

    // Other
    if (!/^https?:\/\//i.test(trimmed)) {
      return { url: null, error: "Must be a full URL starting with http:// or https://" };
    }
    return { url: trimmed, error: null };
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      thumbnail_url: "",
      video_provider: "youtube",
      video_input: "",
      duration: "",
      category_id_new: "",
      skill_level: "beginner",
      is_free: false,
      is_active: true,
    });
    setVideoInputError(null);
    setEditingVideo(null);
  };

  const handleEdit = (video: VideoData) => {
    const provider = detectProvider(video.video_url);
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description || "",
      thumbnail_url: video.thumbnail_url || "",
      video_provider: provider,
      video_input: extractIdForEdit(video.video_url, provider),
      duration: video.duration || "",
      category_id_new: video.category_id_new ? String(video.category_id_new) : "",
      skill_level: video.skill_level || "beginner",
      is_free: video.is_free,
      is_active: video.is_active,
    });
    setVideoInputError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const videoData = {
        title: formData.title,
        description: formData.description || null,
        thumbnail_url: formData.thumbnail_url || null,
        duration: formData.duration || null,
        category_id_new: formData.category_id_new ? Number(formData.category_id_new) : null,
        skill_level: formData.skill_level,
        is_free: formData.is_free,
        is_active: formData.is_active,
      };

      const { url: canonicalUrl, error: urlError } = normalizeToCanonicalUrl(
        formData.video_input,
        formData.video_provider
      );
      if (urlError) {
        setVideoInputError(urlError);
        setIsSaving(false);
        return;
      }
      const trimmedUrl = canonicalUrl ?? "";
      let videoId: string;

      if (editingVideo) {
        const { error } = await supabase
          .from("videos")
          .update(videoData)
          .eq("id", editingVideo.id);
        if (error) throw error;
        videoId = editingVideo.id;
        toast({ title: "Video updated successfully" });
      } else {
        const { data: inserted, error } = await supabase
          .from("videos")
          .insert([videoData])
          .select("id")
          .single();
        if (error) throw error;
        videoId = inserted.id;
        toast({ title: "Video created successfully" });
      }

      // Sync video_sources (separate, access-controlled table)
      if (trimmedUrl) {
        const { error: srcError } = await supabase
          .from("video_sources")
          .upsert(
            { video_id: videoId, video_url: trimmedUrl },
            { onConflict: "video_id" }
          );
        if (srcError) throw srcError;
      } else {
        // No URL provided — remove any existing source row
        const { error: delError } = await supabase
          .from("video_sources")
          .delete()
          .eq("video_id", videoId);
        if (delError) throw delError;
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Error saving video:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save video.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;

    try {
      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Video deleted successfully" });
      fetchData();
    } catch (err) {
      console.error("Error deleting video:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete video.",
      });
    }
  };

  const openQuickEdit = (video: VideoData) => {
    setQuickEditVideo(video);
    setQuickDescription(video.description || "");
  };

  const saveQuickDescription = async () => {
    if (!quickEditVideo) return;
    setIsQuickSaving(true);
    try {
      const { error } = await supabase
        .from("videos")
        .update({ description: quickDescription || null })
        .eq("id", quickEditVideo.id);
      if (error) throw error;
      toast({ title: "Description updated" });
      setQuickEditVideo(null);
      fetchData();
    } catch (err) {
      console.error("Error updating description:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update description.",
      });
    } finally {
      setIsQuickSaving(false);
    }
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return "—";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "—";
  };

  const filteredVideos = filterCategory === "all"
    ? videos
    : filterCategory === "none"
    ? videos.filter((v) => !v.category_id_new)
    : videos.filter((v) => v.category_id_new === Number(filterCategory));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Video Management</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm("Import seed videos from CSV? Existing rows with the same slug will be updated.")) return;
                try {
                  const { data, error } = await supabase.functions.invoke("import-videos-seed");
                  if (error) throw error;
                  toast({
                    title: "Seed import complete",
                    description: `Inserted/updated ${data.videos_inserted} videos and ${data.sources_inserted} sources. Errors: ${data.error_count}.`,
                  });
                  fetchData();
                } catch (e: any) {
                  toast({ title: "Seed import failed", description: e.message, variant: "destructive" });
                }
              }}
            >
              Import Seed Videos
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Video
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingVideo ? "Edit Video" : "Add New Video"}</DialogTitle>
                <DialogDescription>
                  {editingVideo ? "Update video details" : "Create a new video entry"}
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
                <div className="space-y-2">
                  <Label>Video Source</Label>
                  <div className="grid grid-cols-[140px_1fr] gap-2">
                    <Select
                      value={formData.video_provider}
                      onValueChange={(value: "youtube" | "vimeo" | "other") => {
                        setFormData({ ...formData, video_provider: value });
                        setVideoInputError(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="vimeo">Vimeo</SelectItem>
                        <SelectItem value="other">Other (full URL)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="video_input"
                      value={formData.video_input}
                      onChange={(e) => {
                        setFormData({ ...formData, video_input: e.target.value });
                        if (videoInputError) setVideoInputError(null);
                      }}
                      placeholder={
                        formData.video_provider === "youtube"
                          ? "Video ID (e.g. dQw4w9WgXcQ) or full URL"
                          : formData.video_provider === "vimeo"
                          ? "Numeric ID (e.g. 123456789) or full URL"
                          : "https://..."
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formData.video_provider === "youtube" &&
                      "Paste just the YouTube video ID or any full YouTube URL (watch, youtu.be, embed, shorts)."}
                    {formData.video_provider === "vimeo" &&
                      "Paste just the numeric Vimeo ID or a full vimeo.com URL."}
                    {formData.video_provider === "other" &&
                      "Paste a full embeddable URL starting with http:// or https://."}
                  </p>
                  {videoInputError && (
                    <p className="text-xs text-destructive">{videoInputError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
                  <Input
                    id="thumbnail_url"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration</Label>
                    <Input
                      id="duration"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="e.g., 15:30"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category_id_new || "none"}
                      onValueChange={(value) => setFormData({ ...formData, category_id_new: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="skill_level">Skill Level</Label>
                  <Select
                    value={formData.skill_level}
                    onValueChange={(value) => setFormData({ ...formData, skill_level: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select skill level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_free"
                      checked={formData.is_free}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_free: checked })}
                    />
                    <Label htmlFor="is_free">Free Video</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingVideo ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filter Section */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="none">No Category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filterCategory !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilterCategory("all")}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-12">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No videos found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVideos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{video.title}</span>
                        {video.is_free && (
                          <Badge variant="secondary" className="ml-2">Free</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryName(video.category_id_new)}</TableCell>
                    <TableCell>{video.duration || "-"}</TableCell>
                    <TableCell>{video.view_count}</TableCell>
                    <TableCell>
                      <Badge variant={video.is_active ? "default" : "secondary"}>
                        {video.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openQuickEdit(video)}
                        title="Quick edit description"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(video)}
                        title="Edit video"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(video.id)}
                        className="text-destructive hover:text-destructive"
                        title="Delete video"
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

        {/* Quick description edit dialog */}
        <Dialog
          open={!!quickEditVideo}
          onOpenChange={(open) => !open && setQuickEditVideo(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit description</DialogTitle>
              <DialogDescription>
                {quickEditVideo?.title}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={quickDescription}
              onChange={(e) => setQuickDescription(e.target.value)}
              rows={6}
              placeholder="Video description..."
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setQuickEditVideo(null)}
              >
                Cancel
              </Button>
              <Button onClick={saveQuickDescription} disabled={isQuickSaving}>
                {isQuickSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
