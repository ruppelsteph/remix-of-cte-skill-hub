import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, X } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { VideoCard } from "@/components/VideoCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { videos, ctePathways, videoCategories } from "@/data/mockData";

export default function Videos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedPathway, setSelectedPathway] = useState(searchParams.get("pathway") || "all");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "all");
  const [selectedLevel, setSelectedLevel] = useState(searchParams.get("level") || "all");

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !video.title.toLowerCase().includes(query) &&
          !video.description.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Pathway filter
      if (selectedPathway !== "all" && video.pathwayId !== selectedPathway) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "all" && !video.categoryIds.includes(selectedCategory)) {
        return false;
      }

      // Level filter
      if (selectedLevel !== "all" && video.level !== selectedLevel) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedPathway, selectedCategory, selectedLevel]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPathway("all");
    setSelectedCategory("all");
    setSelectedLevel("all");
    setSearchParams({});
  };

  const hasActiveFilters =
    searchQuery || selectedPathway !== "all" || selectedCategory !== "all" || selectedLevel !== "all";

  return (
    <Layout>
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container-wide">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">Video Library</h1>
            <p className="mt-2 text-muted-foreground">
              Browse our complete collection of CTE training videos
            </p>
          </div>

          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search videos by title or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filters:</span>
              </div>

              <Select value={selectedPathway} onValueChange={setSelectedPathway}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="CTE Pathway" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pathways</SelectItem>
                  {ctePathways.map((pathway) => (
                    <SelectItem key={pathway.id} value={pathway.id}>
                      {pathway.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {videoCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredVideos.length} of {videos.length} videos
            </div>
          </div>

          {/* Video Grid */}
          {filteredVideos.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredVideos.map((video, index) => (
                <VideoCard key={video.id} video={video} index={index} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-lg text-muted-foreground">No videos found matching your criteria.</p>
              <Button variant="link" onClick={clearFilters} className="mt-2">
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
