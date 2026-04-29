import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, X, Loader2, ChevronRight, FolderOpen } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { VideoCard } from "@/components/VideoCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  is_active: boolean;
};

export default function Videos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const initialPath = searchParams.get("path");
  const [categoryPath, setCategoryPath] = useState<number[]>(
    initialPath ? initialPath.split(",").map(Number).filter(Boolean) : []
  );
  const [subFilter, setSubFilter] = useState<string>("all");

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Build helpers
  const categoriesById = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const childrenOf = useMemo(() => {
    const map = new Map<number | null, Category[]>();
    categories.forEach((c) => {
      const key = c.parent_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [categories]);

  const topLevel = childrenOf.get(null) || [];
  const currentCategoryId = categoryPath[categoryPath.length - 1] ?? null;
  const currentChildren = childrenOf.get(currentCategoryId) || [];

  // Recursively gather all descendant category ids (incl. self)
  const descendantIds = useMemo(() => {
    if (currentCategoryId == null) return null;
    const ids = new Set<number>();
    const walk = (id: number) => {
      ids.add(id);
      (childrenOf.get(id) || []).forEach((c) => walk(c.id));
    };
    walk(currentCategoryId);
    return ids;
  }, [currentCategoryId, childrenOf]);

  // Count videos per top-level category (recursive)
  const countVideosUnder = (catId: number): number => {
    const ids = new Set<number>();
    const walk = (id: number) => {
      ids.add(id);
      (childrenOf.get(id) || []).forEach((c) => walk(c.id));
    };
    walk(catId);
    return videos.filter((v) => v.category_id_new && ids.has(v.category_id_new as number)).length;
  };

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !video.title.toLowerCase().includes(q) &&
          !(video.description || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (descendantIds) {
        if (!video.category_id_new || !descendantIds.has(video.category_id_new as number)) {
          return false;
        }
      }

      if (subFilter !== "all") {
        const subId = Number(subFilter);
        // Match if video is in this subcategory or any of its descendants
        const subTree = new Set<number>();
        const walk = (id: number) => {
          subTree.add(id);
          (childrenOf.get(id) || []).forEach((c) => walk(c.id));
        };
        walk(subId);
        if (!video.category_id_new || !subTree.has(video.category_id_new as number)) {
          return false;
        }
      }

      return true;
    });
  }, [videos, searchQuery, descendantIds, subFilter, childrenOf]);

  const updateUrl = (path: number[], q: string) => {
    const params: Record<string, string> = {};
    if (path.length) params.path = path.join(",");
    if (q) params.q = q;
    setSearchParams(params);
  };

  const navigateToPath = (path: number[]) => {
    setCategoryPath(path);
    setSubFilter("all");
    updateUrl(path, searchQuery);
  };

  const drillInto = (catId: number) => navigateToPath([...categoryPath, catId]);
  const goHome = () => navigateToPath([]);

  const clearFilters = () => {
    setSearchQuery("");
    setSubFilter("all");
    navigateToPath([]);
  };

  const hasActiveFilters = searchQuery || categoryPath.length > 0 || subFilter !== "all";

  // Breadcrumb crumbs
  const crumbs = categoryPath
    .map((id) => categoriesById.get(id))
    .filter(Boolean) as Category[];

  const showingCategoryGrid = categoryPath.length === 0 && !searchQuery;

  return (
    <Layout>
      <section className="py-12 md:py-16 bg-muted/30 min-h-[60vh]">
        <div className="container-wide">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">Video Library</h1>
            <p className="mt-2 text-muted-foreground">
              Browse our complete collection of CTE training videos
            </p>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search videos by title or keyword..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  updateUrl(categoryPath, e.target.value);
                }}
                className="pl-10"
              />
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
            <Breadcrumb>
              <BreadcrumbList className="text-base">
                <BreadcrumbItem>
                  {categoryPath.length === 0 ? (
                    <BreadcrumbPage className="font-semibold text-foreground">
                      All Categories
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={goHome}
                      className="cursor-pointer font-medium text-primary hover:text-primary/80"
                    >
                      All Categories
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {crumbs.map((c, idx) => {
                  const isLast = idx === crumbs.length - 1;
                  return (
                    <span key={c.id} className="flex items-center gap-1.5">
                      <BreadcrumbSeparator className="text-primary/60" />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="font-semibold text-foreground">
                            {c.name}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            onClick={() => navigateToPath(categoryPath.slice(0, idx + 1))}
                            className="cursor-pointer font-medium text-primary hover:text-primary/80"
                          >
                            {c.name}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </span>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Filters */}
          <div className="mb-8 space-y-4">

            {/* Subcategory filter only inside a category */}
            {categoryPath.length > 0 && currentChildren.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span>Filter:</span>
                </div>
                <Select value={subFilter} onValueChange={setSubFilter}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subcategories</SelectItem>
                    {currentChildren.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            )}

            {hasActiveFilters && categoryPath.length === 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Top-level category grid (default landing) */}
          {showingCategoryGrid ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {topLevel.map((cat) => {
                const count = countVideosUnder(cat.id);
                const subCount = (childrenOf.get(cat.id) || []).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => drillInto(cat.id)}
                    className={cn(
                      "group text-left rounded-2xl border bg-card p-6 shadow-sm transition-all",
                      "hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="rounded-xl bg-primary/10 p-3 text-primary">
                        <FolderOpen className="h-6 w-6" />
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    <h3 className="mt-4 font-heading text-lg font-semibold">{cat.name}</h3>
                    {cat.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {cat.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{count} {count === 1 ? "video" : "videos"}</span>
                      {subCount > 0 && (
                        <>
                          <span>•</span>
                          <span>{subCount} {subCount === 1 ? "subcategory" : "subcategories"}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Subcategory chips when drilled in */}
              {categoryPath.length > 0 && currentChildren.length > 0 && subFilter === "all" && !searchQuery && (
                <div className="mb-8">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Subcategories
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {currentChildren.map((c) => {
                      const count = countVideosUnder(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => drillInto(c.id)}
                          className="group flex items-center justify-between rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                        >
                          <div>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {count} {count === 1 ? "video" : "videos"}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-4 text-sm text-muted-foreground">
                Showing {filteredVideos.length} {filteredVideos.length === 1 ? "video" : "videos"}
              </div>

              {videosLoading ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredVideos.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredVideos.map((video, index) => {
                    const category = categoriesById.get(video.category_id_new as number);
                    return (
                      <VideoCard
                        key={video.id}
                        video={video}
                        categoryName={category?.name}
                        index={index}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <p className="text-lg text-muted-foreground">
                    No videos found matching your criteria.
                  </p>
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear all filters
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
