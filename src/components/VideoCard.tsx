import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Play, Signal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

interface VideoCardProps {
  video: Tables<"videos">;
  pathway?: Tables<"pathways"> | null;
  category?: Tables<"video_categories"> | null;
  index?: number;
}

export function VideoCard({ video, pathway, category, index = 0 }: VideoCardProps) {
  const [imageError, setImageError] = useState(false);
  
  // Parse duration from string format (e.g., "18:30" or "18 min")
  const getDurationDisplay = () => {
    if (!video.duration) return null;
    return video.duration;
  };

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

  return (
    <Link
      to={`/videos/${video.id}`}
      className={cn(
        "group block rounded-xl bg-card border border-border overflow-hidden shadow-soft transition-all hover:shadow-lg hover:-translate-y-1 animate-fade-in"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-muted">
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
        {/* Duration badge */}
        {getDurationDisplay() && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white">
            <Clock className="h-3 w-3" />
            {getDurationDisplay()}
          </div>
        )}
        {/* Free badge */}
        {video.is_free && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-success text-success-foreground">Free</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pathway && (
            <Badge variant="secondary" className="text-xs">
              {pathway.title}
            </Badge>
          )}
          {category && (
            <Badge variant="outline" className="text-xs">
              {category.name}
            </Badge>
          )}
          {getSkillLevelLabel() && (
            <Badge className={cn("text-xs", getSkillLevelVariant())}>
              <Signal className="h-3 w-3 mr-1" />
              {getSkillLevelLabel()}
            </Badge>
          )}
        </div>
        <h3 className="font-heading font-semibold text-base group-hover:text-primary transition-colors line-clamp-2">
          {video.title}
        </h3>
        {video.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {video.description}
          </p>
        )}
      </div>
    </Link>
  );
}
