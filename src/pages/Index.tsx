import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { PathwayCard } from "@/components/PathwayCard";
import { VideoCard } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Play, Users, Award, BookOpen, ArrowRight, CheckCircle, Loader2 } from "lucide-react";

const Index = () => {
  // Fetch featured videos from Supabase
  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["featured-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  // Fetch pathways from Supabase
  const { data: pathways = [], isLoading: pathwaysLoading } = useQuery({
    queryKey: ["pathways"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pathways")
        .select("*")
        .eq("is_active", true)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  // Fetch categories for VideoCard
  const { data: categories = [] } = useQuery({
    queryKey: ["video_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-secondary via-secondary to-secondary/95 py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.15),transparent_50%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
              <Play className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Career & Technical Education Videos</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-foreground mb-6 leading-tight">
              Master Real-World Skills with{" "}
              <span className="text-primary">CTE Skills</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              High-quality training videos for students, teachers, and schools. 
              Covering all major CTE pathways from Health Science to Manufacturing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to="/videos">
                  Browse Videos
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 border-border/50 hover:bg-muted">
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-primary mb-1">150+</p>
              <p className="text-sm text-muted-foreground">Training Videos</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-primary mb-1">6</p>
              <p className="text-sm text-muted-foreground">CTE Pathways</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-primary mb-1">500+</p>
              <p className="text-sm text-muted-foreground">Schools</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-primary mb-1">50K+</p>
              <p className="text-sm text-muted-foreground">Students</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTE Pathways Section */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              CTE Pathways Covered
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive video training aligned with industry standards across all major Career & Technical Education pathways.
            </p>
          </div>
          {pathwaysLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pathways.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pathways.map((pathway) => (
                <PathwayCard key={pathway.id} pathway={pathway} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No pathways available yet.</p>
          )}
          <div className="text-center mt-10">
            <Button asChild variant="outline" size="lg">
              <Link to="/pathways">
                View All Pathways
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why CTE Skills Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why CTE Skills?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built by educators, for educators. Our platform is designed to make CTE training engaging and effective.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Play className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Engaging Videos</h3>
              <p className="text-muted-foreground text-sm">
                Professional-quality videos that capture student attention and reinforce learning.
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Teacher-Friendly</h3>
              <p className="text-muted-foreground text-sm">
                Easy to integrate into your curriculum with organized pathways and categories.
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Industry-Aligned</h3>
              <p className="text-muted-foreground text-sm">
                Content aligned with real-world industry standards and certification requirements.
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Always Growing</h3>
              <p className="text-muted-foreground text-sm">
                New videos added regularly to keep content fresh and comprehensive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Videos Section */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Featured Videos
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl">
                Start learning with our most popular training videos across all pathways.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-4 md:mt-0">
              <Link to="/videos">
                View All Videos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {videosLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {videos.map((video, index) => (
                <VideoCard 
                  key={video.id} 
                  video={video}
                  pathway={pathways.find(p => p.id === video.pathway_id)}
                  category={categories.find(c => c.id === video.category_id)}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No videos available yet.</p>
          )}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Trusted by Educators
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "CTE Skills has transformed how I teach welding. The videos are practical and students love them.",
                author: "Michael Torres",
                role: "Manufacturing Instructor, Lincoln Tech",
              },
              {
                quote: "Finally, a video platform that understands what CTE educators need. The content quality is outstanding.",
                author: "Sarah Chen",
                role: "Health Science Teacher, Mesa High School",
              },
              {
                quote: "Our district adopted CTE Skills last year. Student engagement in CTE courses has increased significantly.",
                author: "Dr. James Wilson",
                role: "CTE Director, Jefferson County Schools",
              },
            ].map((testimonial, index) => (
              <div key={index} className="bg-card rounded-xl p-6 shadow-sm border border-border">
                <p className="text-muted-foreground mb-4 italic">"{testimonial.quote}"</p>
                <div>
                  <p className="font-semibold text-card-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card rounded-2xl p-8 border border-border">
              <h3 className="text-2xl font-bold text-card-foreground mb-4">For Schools & Districts</h3>
              <p className="text-muted-foreground mb-6">
                Get multi-seat licenses for your entire CTE department. Includes admin dashboard and usage analytics.
              </p>
              <ul className="space-y-3 mb-6">
                {["Unlimited student access", "Teacher admin controls", "Usage reporting", "Priority support"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="w-full">
                <Link to="/schools">Contact for Pricing</Link>
              </Button>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border">
              <h3 className="text-2xl font-bold text-card-foreground mb-4">For Individuals</h3>
              <p className="text-muted-foreground mb-6">
                Students and independent learners can subscribe for full access to all videos and pathways.
              </p>
              <ul className="space-y-3 mb-6">
                {["Access all 150+ videos", "All CTE pathways", "New content monthly", "Learn at your pace"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link to="/pricing">View Plans</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
