import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, Tag, Lock, Play } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { getVideoById, getPathwayById, videoCategories, videos } from "@/data/mockData";
import { cn } from "@/lib/utils";

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const { isSubscribed, user } = useAuth();
  const video = id ? getVideoById(id) : undefined;

  if (!video) {
    return (
      <Layout>
        <div className="container-wide py-16 text-center">
          <h1 className="text-2xl font-bold">Video not found</h1>
          <Button asChild className="mt-4">
            <Link to="/videos">Back to Library</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const pathway = getPathwayById(video.pathwayId);
  const categories = video.categoryIds
    .map((id) => videoCategories.find((c) => c.id === id))
    .filter(Boolean);

  // Get related videos (same pathway, excluding current)
  const relatedVideos = videos
    .filter((v) => v.pathwayId === video.pathwayId && v.id !== video.id)
    .slice(0, 4);

  return (
    <Layout>
      <div className="bg-secondary/5">
        <div className="container-wide py-8">
          {/* Back Button */}
          <Link
            to="/videos"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Video Library
          </Link>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Video Player Column */}
            <div className="lg:col-span-2">
              {/* Video Player */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-secondary shadow-lg">
                {isSubscribed ? (
                  // Subscribed user - show player
                  video.videoUrl ? (
                    <video
                      src={video.videoUrl}
                      controls
                      className="h-full w-full"
                      poster={video.thumbnailUrl}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-secondary-foreground">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="absolute inset-0 h-full w-full object-cover opacity-50"
                      />
                      <div className="relative z-10 text-center">
                        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
                          <Play className="h-8 w-8 text-primary-foreground fill-current ml-1" />
                        </div>
                        <p className="text-lg font-medium">Video Coming Soon</p>
                        <p className="text-sm text-secondary-foreground/70">
                          This video is being prepared
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  // Non-subscribed user - show locked state
                  <div className="absolute inset-0">
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="h-full w-full object-cover blur-sm"
                    />
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                      <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Subscribe to Watch</h3>
                      <p className="text-sm text-white/70 mb-6 max-w-sm text-center">
                        {user
                          ? "Upgrade your account to access all training videos."
                          : "Sign in or create an account to start learning."}
                      </p>
                      <div className="flex gap-3">
                        {user ? (
                          <Button asChild>
                            <Link to="/pricing">View Pricing</Link>
                          </Button>
                        ) : (
                          <>
                            <Button asChild>
                              <Link to="/auth?mode=signup">Get Started</Link>
                            </Button>
                            <Button variant="outline" asChild className="border-white/30 hover:bg-white/10">
                              <Link to="/auth">Sign In</Link>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="mt-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  {pathway && (
                    <Badge variant="secondary">{pathway.name}</Badge>
                  )}
                  {categories.map((cat) => (
                    <Badge key={cat?.id} variant="outline">
                      {cat?.name}
                    </Badge>
                  ))}
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize",
                      video.level === "beginner" && "border-success text-success",
                      video.level === "intermediate" && "border-primary text-primary",
                      video.level === "advanced" && "border-destructive text-destructive"
                    )}
                  >
                    {video.level}
                  </Badge>
                </div>

                <h1 className="font-heading text-2xl font-bold md:text-3xl">
                  {video.title}
                </h1>

                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {video.durationMinutes} minutes
                  </span>
                </div>

                <p className="mt-6 text-muted-foreground leading-relaxed">
                  {video.description}
                </p>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Subscription CTA for non-subscribers */}
              {!isSubscribed && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-6">
                  <h3 className="font-heading font-semibold text-lg">
                    Unlock Full Access
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Get unlimited access to all training videos with a CTE Skills subscription.
                  </p>
                  <Button asChild className="w-full mt-4">
                    <Link to="/pricing">View Plans</Link>
                  </Button>
                </div>
              )}

              {/* Pathway Info */}
              {pathway && (
                <div className="rounded-xl bg-card border border-border p-6">
                  <h3 className="font-heading font-semibold">About This Pathway</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pathway.description}
                  </p>
                  <Button variant="outline" asChild className="w-full mt-4">
                    <Link to={`/videos?pathway=${pathway.id}`}>
                      View All {pathway.name} Videos
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Related Videos */}
          {relatedVideos.length > 0 && (
            <section className="mt-16">
              <h2 className="font-heading text-2xl font-bold mb-6">Related Videos</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {relatedVideos.map((video, index) => (
                  <VideoCard key={video.id} video={video} index={index} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
