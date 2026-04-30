import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Play, Signal, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface VideoCardProps {
  video: Tables<"videos">;
  pathway?: Tables<"pathways"> | null;
  categoryName?: string | null;
  index?: number;
}

const buildYouTubeEmbed = (url: string): string => {
  // Match common YouTube URL formats and return an embed URL
  const idMatch =
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?&]+)/) ||
    url.match(/youtube\.com\/embed\/([^?&]+)/);
  const id = idMatch?.[1];
  if (!id) return url;
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
};

export function VideoCard({ video, pathway, categoryName, index = 0 }: VideoCardProps) {
  const [imageError, setImageError] = useState(false);
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const getDurationDisplay = () => video.duration || null;

  const getSkillLevelLabel = () => {
    const level = (video as any).skill_level;
    if (!level) return null;
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const getSkillLevelVariant = () => {
    const level = (video as any).skill_level;
    switch (level) {
      case "beginner":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
      case "intermediate":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
      case "advanced":
        return "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300";
      default:
        return "";
    }
  };

  const openPreview = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    if (previewUrl || loadingPreview) return;
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      // RLS allows anyone to read preview sources for active videos
      const { data, error } = await supabase
        .from("video_sources")
        .select("video_url, kind")
        .eq("video_id", video.id)
        .eq("is_preview", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.video_url) {
        setPreviewError("No preview is available for this video yet.");
      } else {
        setPreviewUrl(data.video_url);
      }
    } catch (err: any) {
      console.error("Failed to load preview:", err);
      setPreviewError("Could not load preview. Please try again.");
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group block rounded-xl bg-card border border-border overflow-hidden shadow-soft transition-all hover:shadow-lg hover:-translate-y-1 animate-fade-in"
        )}
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        {/* Thumbnail — opens YouTube preview */}
        <button
          type="button"
          onClick={openPreview}
          className="relative aspect-video w-full overflow-hidden bg-muted block text-left"
          aria-label={`Play preview of ${video.title}`}
        >
          {video.thumbnail_url && !imageError ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-muted">
              <Play className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-glow">
              <Play className="h-6 w-6 text-primary-foreground fill-current ml-1" />
            </div>
          </div>
          {getDurationDisplay() && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white">
              <Clock className="h-3 w-3" />
              {getDurationDisplay()}
            </div>
          )}
          {video.is_free && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-success text-success-foreground">Free</Badge>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="bg-black/70 text-white border-0 text-[10px] uppercase tracking-wide">
              Preview
            </Badge>
          </div>
        </button>

        {/* Content */}
        <div className="p-4">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(categoryName || pathway) && (
              <Badge variant="secondary" className="text-xs">
                {categoryName || pathway?.title}
              </Badge>
            )}
            {getSkillLevelLabel() && (
              <Badge className={cn("text-xs", getSkillLevelVariant())}>
                <Signal className="h-3 w-3 mr-1" />
                {getSkillLevelLabel()}
              </Badge>
            )}
          </div>
          <h3 className="font-heading font-semibold text-base line-clamp-2">
            {video.title}
          </h3>
          {video.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {video.description}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={openPreview}
              className="px-2"
            >
              <Play className="h-4 w-4 mr-1" />
              Watch preview
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to={`/videos/${video.id}`}>
                <Info className="h-4 w-4 mr-1" />
                Details
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-base">{video.title}</DialogTitle>
            <DialogDescription>
              Free preview. Subscribe to watch the full-length training video.
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video w-full bg-black">
            {loadingPreview ? (
              <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
                Loading preview…
              </div>
            ) : previewError ? (
              <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm px-6 text-center">
                {previewError}
              </div>
            ) : previewUrl ? (
              <iframe
                key={previewUrl}
                src={buildYouTubeEmbed(previewUrl)}
                title={`${video.title} preview`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 p-4 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Want the full video? Subscribers get ad-free, full-length access.
            </p>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/videos/${video.id}`} onClick={() => setOpen(false)}>
                  Details
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/pricing" onClick={() => setOpen(false)}>
                  Subscribe
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
