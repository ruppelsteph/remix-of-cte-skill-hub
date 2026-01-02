import { Link } from "react-router-dom";
import { Clock, Play } from "lucide-react";
import { Video, getPathwayById, videoCategories } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  video: Video;
  index?: number;
}

export function VideoCard({ video, index = 0 }: VideoCardProps) {
  const pathway = getPathwayById(video.pathwayId);
  const categories = video.categoryIds
    .map((id) => videoCategories.find((c) => c.id === id)?.name)
    .filter(Boolean);

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
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-glow">
            <Play className="h-6 w-6 text-primary-foreground fill-current ml-1" />
          </div>
        </div>
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white">
          <Clock className="h-3 w-3" />
          {video.durationMinutes} min
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pathway && (
            <Badge variant="secondary" className="text-xs">
              {pathway.name}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              "text-xs capitalize",
              video.level === "beginner" && "border-success text-success",
              video.level === "intermediate" && "border-primary text-primary",
              video.level === "advanced" && "border-destructive text-destructive"
            )}
          >
            {video.level}
          </Badge>
        </div>
        <h3 className="font-heading font-semibold text-base group-hover:text-primary transition-colors line-clamp-2">
          {video.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {video.description}
        </p>
      </div>
    </Link>
  );
}
