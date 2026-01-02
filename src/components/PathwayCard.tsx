import { Link } from "react-router-dom";
import {
  Stethoscope,
  Monitor,
  Factory,
  UtensilsCrossed,
  HardHat,
  Car,
} from "lucide-react";
import { CTEPathway } from "@/data/mockData";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope,
  Monitor,
  Factory,
  UtensilsCrossed,
  HardHat,
  Car,
};

interface PathwayCardProps {
  pathway: CTEPathway;
  index?: number;
}

export function PathwayCard({ pathway, index = 0 }: PathwayCardProps) {
  const IconComponent = iconMap[pathway.icon] || Monitor;

  return (
    <Link
      to={`/videos?pathway=${pathway.id}`}
      className={cn(
        "group block rounded-xl bg-card border border-border p-6 shadow-soft transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary/50 animate-fade-in"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <IconComponent className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-lg group-hover:text-primary transition-colors">
            {pathway.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {pathway.description}
          </p>
          <p className="mt-3 text-xs font-medium text-primary">
            {pathway.videoCount} videos available
          </p>
        </div>
      </div>
    </Link>
  );
}
