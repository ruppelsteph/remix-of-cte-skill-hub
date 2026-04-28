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
  video_url: string | null; // populated from video_sources, not videos
  duration: string | null;
  pathway_id: string | null;
  skill_level?: string;
  is_free: boolean;
  is_active: boolean;
  view_count: number;
  created_at: string;
}

interface Pathway {
  id: string;
  title: string;
}

export function AdminVideos() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterPathway, setFilterPathway] = useState<string>("all");
  const [quickEditVideo, setQuickEditVideo] = useState<VideoData | null>(null);
  const [quickDescription, setQuickDescription] = useState("");
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    thumbnail_url: "",
    video_url: "",
    duration: "",
    pathway_id: "",
    skill_level: "beginner",
    is_free: false,
    is_active: true,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [videosRes, pathwaysRes, sourcesRes] = await Promise.all([
        supabase.from("videos").select("*").order("created_at", { ascending: false }),
        supabase.from("pathways").select("id, title"),
        supabase.from("video_sources").select("video_id, video_url"),
      ]);

      if (videosRes.error) throw videosRes.error;
      if (pathwaysRes.error) throw pathwaysRes.error;
      if (sourcesRes.error) throw sourcesRes.error;

      const urlByVideo = new Map<string, string>(
        (sourcesRes.data || []).map((s) => [s.video_id, s.video_url])
      );

      const merged: VideoData[] = (videosRes.data || []).map((v) => ({
        ...v,
        video_url: urlByVideo.get(v.id) ?? null,
      }));

      setVideos(merged);
      setPathways(pathwaysRes.data || []);
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

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      thumbnail_url: "",
      video_url: "",
      duration: "",
      pathway_id: "",
      skill_level: "beginner",
      is_free: false,
      is_active: true,
    });
    setEditingVideo(null);
  };

  const handleEdit = (video: VideoData) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description || "",
      thumbnail_url: video.thumbnail_url || "",
      video_url: video.video_url || "",
      duration: video.duration || "",
      pathway_id: video.pathway_id || "",
      skill_level: video.skill_level || "beginner",
      is_free: video.is_free,
      is_active: video.is_active,
    });
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
        pathway_id: formData.pathway_id || null,
        skill_level: formData.skill_level,
        is_free: formData.is_free,
        is_active: formData.is_active,
      };

      const trimmedUrl = formData.video_url.trim();
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

  const getPathwayTitle = (pathwayId: string | null) => {
    if (!pathwayId) return "—";
    const pathway = pathways.find((p) => p.id === pathwayId);
    return pathway?.title || "—";
  };

  const filteredVideos = filterPathway === "all"
    ? videos
    : filterPathway === "none"
    ? videos.filter((v) => !v.pathway_id)
    : videos.filter((v) => v.pathway_id === filterPathway);

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
                  fetchVideos();
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
                <div>
                  <Label htmlFor="video_url">Video URL</Label>
                  <Input
                    id="video_url"
                    value={formData.video_url}
                    onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                    placeholder="https://..."
                  />
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
                    <Label htmlFor="pathway">Pathway</Label>
                    <Select
                      value={formData.pathway_id || "none"}
                      onValueChange={(value) => setFormData({ ...formData, pathway_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pathway" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {pathways.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
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
            <Select value={filterPathway} onValueChange={setFilterPathway}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by pathway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pathways</SelectItem>
                <SelectItem value="none">No Pathway</SelectItem>
                {pathways.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filterPathway !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilterPathway("all")}>
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
                  <TableHead>Pathway</TableHead>
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
                    <TableCell>{getPathwayTitle(video.pathway_id)}</TableCell>
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
