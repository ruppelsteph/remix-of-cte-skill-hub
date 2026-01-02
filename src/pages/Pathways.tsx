import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ctePathways, getVideosByPathway } from "@/data/mockData";
import { 
  Stethoscope, 
  Monitor, 
  Factory, 
  UtensilsCrossed, 
  HardHat, 
  Car,
  ArrowRight,
  Play
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope,
  Monitor,
  Factory,
  UtensilsCrossed,
  HardHat,
  Car,
};

const Pathways = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-secondary py-16 lg:py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-secondary-foreground mb-4">
            CTE Pathways
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore career and technical education pathways. Each pathway contains curated video content 
            aligned with industry standards and real-world skills.
          </p>
        </div>
      </section>

      {/* Pathways List */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="space-y-8">
            {ctePathways.map((pathway) => {
              const IconComponent = iconMap[pathway.icon] || Monitor;
              const pathwayVideos = getVideosByPathway(pathway.id);
              
              return (
                <div 
                  key={pathway.id} 
                  className="bg-card rounded-2xl border border-border p-6 md:p-8 hover:shadow-lg transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                        <IconComponent className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h2 className="text-2xl font-bold text-card-foreground mb-2">{pathway.name}</h2>
                      <p className="text-muted-foreground mb-4">{pathway.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Play className="h-4 w-4 text-primary" />
                          {pathway.videoCount} videos
                        </span>
                        <span className="text-muted-foreground">
                          • {pathwayVideos.length} available now
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Button asChild>
                        <Link to={`/videos?pathway=${pathway.id}`}>
                          Browse Videos
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Preview of videos in this pathway */}
                  {pathwayVideos.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {pathwayVideos.slice(0, 4).map((video) => (
                          <Link 
                            key={video.id} 
                            to={`/videos/${video.id}`}
                            className="flex-shrink-0 group"
                          >
                            <div className="w-40 rounded-lg overflow-hidden border border-border">
                              <img 
                                src={video.thumbnailUrl} 
                                alt={video.title}
                                className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 w-40 truncate group-hover:text-foreground transition-colors">
                              {video.title}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Can't find your pathway?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            We're constantly adding new content. Let us know what pathways you'd like to see.
          </p>
          <Button asChild variant="outline" size="lg">
            <Link to="/about">Contact Us</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default Pathways;
