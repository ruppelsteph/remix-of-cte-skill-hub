import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Lock, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const { isSubscribed, user } = useAuth();

  // Fetch video by ID
  const { data: video, isLoading: videoLoading } = useQuery({
    queryKey: ["video", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all sources the viewer is allowed to see. RLS returns:
  //  - the YouTube preview (is_preview=true) to everyone
  //  - the Vimeo full video (is_preview=false) only to subscribers, granted users, or admins
  const { data: videoSources = [] } = useQuery({
    queryKey: ["video-sources", id, user?.id, isSubscribed],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("video_sources")
        .select("video_url, is_preview, kind")
        .eq("video_id", id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // Prefer the full Vimeo source when accessible; otherwise fall back to the YouTube preview.
  const fullSource = videoSources.find((s) => s.is_preview === false) ?? null;
  const previewSource = videoSources.find((s) => s.is_preview === true) ?? null;
  const activeSource = fullSource ?? previewSource;
  const videoUrl = activeSource?.video_url ?? null;
  const isPlayingPreview = !fullSource && !!previewSource;

  // Fetch all pathways
  const { data: pathways = [] } = useQuery({
    queryKey: ["pathways"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pathways")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch related videos (same pathway)
  const { data: relatedVideos = [] } = useQuery({
    queryKey: ["related-videos", video?.pathway_id, id],
    queryFn: async () => {
      if (!video?.pathway_id) return [];
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("pathway_id", video.pathway_id)
        .eq("is_active", true)
        .neq("id", id!)
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: !!video?.pathway_id,
  });

  if (videoLoading) {
    return (
      <Layout>
        <div className="container-wide py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

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

  const pathway = pathways.find(p => p.id === video.pathway_id);

  // Anyone can play whatever source they have access to. Subscribers get the full Vimeo
  // video; everyone else gets the YouTube preview when one exists.
  const canWatch = !!videoUrl;

  // Build an embeddable URL for the active source.
  const buildEmbedUrl = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return url
        .replace("watch?v=", "embed/")
        .replace("youtu.be/", "youtube.com/embed/");
    }
    if (url.includes("vimeo.com")) {
      const m = url.match(/vimeo\.com\/(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
    }
    return url;
  };

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
                {videoUrl ? (
                  <iframe
                    key={videoUrl}
                    src={buildEmbedUrl(videoUrl)}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  // No source the viewer can access — show locked state
                  <div className="absolute inset-0">
                    {video.thumbnail_url && (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="h-full w-full object-cover blur-sm"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                      <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Subscribe to Watch</h3>
                      <p className="text-sm text-white/70 mb-6 max-w-sm text-center">
                        {user
                          ? "Upgrade your account to access this training video."
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

              {/* Preview banner — shown when the user is watching the free YouTube preview */}
              {isPlayingPreview && (
                <div className="mt-3 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-sm">You're watching the free preview</p>
                    <p className="text-sm text-muted-foreground">
                      Subscribe to unlock the full-length video.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link to={user ? "/pricing" : "/auth?mode=signup"}>
                      {user ? "View Plans" : "Get Started"}
                    </Link>
                  </Button>
                </div>
              )}

              {/* Video Info */}
              <div className="mt-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  {pathway && (
                    <Badge variant="secondary">{pathway.title}</Badge>
                  )}
                  {video.is_free && (
                    <Badge className="bg-success text-success-foreground">Free</Badge>
                  )}
                </div>

                <h1 className="font-heading text-2xl font-bold md:text-3xl">
                  {video.title}
                </h1>

                {video.duration && (
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {video.duration}
                    </span>
                  </div>
                )}

                {video.description && (
                  <p className="mt-6 text-muted-foreground leading-relaxed">
                    {video.description}
                  </p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Subscription CTA for non-subscribers */}
              {!fullSource && (
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
                      View All {pathway.title} Videos
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
                {relatedVideos.map((relVideo, index) => (
                  <VideoCard 
                    key={relVideo.id} 
                    video={relVideo}
                    pathway={pathways.find(p => p.id === relVideo.pathway_id)}
                    index={index} 
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
