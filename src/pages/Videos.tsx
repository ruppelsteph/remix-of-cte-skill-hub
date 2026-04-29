import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Loader2, ChevronRight, FolderOpen } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { VideoCard } from "@/components/VideoCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

import industrialImg from "@/assets/category-industrial.jpg";
import buildingsImg from "@/assets/category-buildings-trades.jpg";
import cosmetologyImg from "@/assets/category-cosmetology.jpg";

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  is_active: boolean;
};

const CATEGORY_IMAGE_BY_SLUG: Record<string, string> = {
  industrial: industrialImg,
  "buildings-trades": buildingsImg,
  cosmetology: cosmetologyImg,
};

export default function Videos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const initialPath = searchParams.get("path");
  const [categoryPath, setCategoryPath] = useState<number[]>(
    initialPath ? initialPath.split(",").map(Number).filter(Boolean) : []
  );

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

  const currentCategoryId = categoryPath[categoryPath.length - 1] ?? null;
  const currentChildren = currentCategoryId == null
    ? (childrenOf.get(null) || [])
    : (childrenOf.get(currentCategoryId) || []);

  // Recursively gather all descendant category ids (including the given id)
  const collectDescendants = (id: number): Set<number> => {
    const ids = new Set<number>();
    const walk = (cid: number) => {
      ids.add(cid);
      (childrenOf.get(cid) || []).forEach((c) => walk(c.id));
    };
    walk(id);
    return ids;
  };

  const countVideosUnder = (catId: number): number => {
    const ids = collectDescendants(catId);
    return videos.filter(
      (v) => v.category_id_new && ids.has(v.category_id_new as number)
    ).length;
  };

  // What to render: leaf categories show videos, otherwise show subcategories.
  const isLeaf = currentCategoryId != null && currentChildren.length === 0;

  // Search overrides drill-down (search across everything in current scope or all)
  const isSearching = searchQuery.trim().length > 0;

  const scopeIds = useMemo(() => {
    if (currentCategoryId == null) return null;
    return collectDescendants(currentCategoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCategoryId, childrenOf]);

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      if (isSearching) {
        const q = searchQuery.toLowerCase();
        if (
          !video.title.toLowerCase().includes(q) &&
          !(video.description || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      } else if (!isLeaf) {
        // Hide videos when not at a leaf and not searching
        return false;
      }

      if (scopeIds) {
        if (
          !video.category_id_new ||
          !scopeIds.has(video.category_id_new as number)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [videos, searchQuery, isSearching, isLeaf, scopeIds]);

  const updateUrl = (path: number[], q: string) => {
    const params: Record<string, string> = {};
    if (path.length) params.path = path.join(",");
    if (q) params.q = q;
    setSearchParams(params);
  };

  const navigateToPath = (path: number[]) => {
    setCategoryPath(path);
    updateUrl(path, searchQuery);
  };

  const drillInto = (catId: number) =>
    navigateToPath([...categoryPath, catId]);
  const goHome = () => navigateToPath([]);

  const clearFilters = () => {
    setSearchQuery("");
    navigateToPath([]);
  };

  const hasActiveFilters = searchQuery || categoryPath.length > 0;

  const crumbs = categoryPath
    .map((id) => categoriesById.get(id))
    .filter(Boolean) as Category[];

  // Image for a category — use mapped image for top-level slugs, otherwise
  // walk up the tree to find an ancestor with one.
  const imageForCategory = (cat: Category): string | null => {
    let cur: Category | undefined = cat;
    while (cur) {
      const img = CATEGORY_IMAGE_BY_SLUG[cur.slug];
      if (img) return img;
      if (cur.parent_id == null) break;
      cur = categoriesById.get(cur.parent_id);
    }
    return null;
  };

  // What to render in the main area
  const showCategoryGrid = !isSearching && !isLeaf;

  return (
    <Layout>
      <section className="py-12 md:py-16 bg-muted/30 min-h-[60vh]">
        <div className="container-wide">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold md:text-4xl">
              Video Library
            </h1>
            <p className="mt-2 text-muted-foreground">
              Browse our complete collection of CTE training videos
            </p>
          </div>

          {/* Search */}
          <div className="mb-6">
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
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
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
                            onClick={() =>
                              navigateToPath(categoryPath.slice(0, idx + 1))
                            }
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

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Main content */}
          {showCategoryGrid ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {currentChildren.map((cat) => {
                  const count = countVideosUnder(cat.id);
                  const subCount = (childrenOf.get(cat.id) || []).length;
                  const img = imageForCategory(cat);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => drillInto(cat.id)}
                      className={cn(
                        "group flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all",
                        "hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5"
                      )}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                        {img ? (
                          <img
                            src={img}
                            alt={cat.name}
                            loading="lazy"
                            width={800}
                            height={600}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10">
                            <FolderOpen className="h-12 w-12 text-primary" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                          <span className="rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur">
                            {count} {count === 1 ? "video" : "videos"}
                          </span>
                          <ChevronRight className="h-5 w-5 text-white drop-shadow transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                      <div className="flex-1 p-5">
                        <h3 className="font-heading text-lg font-semibold">
                          {cat.name}
                        </h3>
                        {cat.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {cat.description}
                          </p>
                        )}
                        {subCount > 0 && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {subCount}{" "}
                            {subCount === 1 ? "subcategory" : "subcategories"}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {currentChildren.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-lg text-muted-foreground">
                    No subcategories found.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                {isSearching
                  ? `Found ${filteredVideos.length} ${filteredVideos.length === 1 ? "video" : "videos"} matching "${searchQuery}"`
                  : `Showing ${filteredVideos.length} ${filteredVideos.length === 1 ? "video" : "videos"}`}
              </div>

              {videosLoading ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredVideos.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredVideos.map((video, index) => {
                    const category = categoriesById.get(
                      video.category_id_new as number
                    );
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
                  <Button
                    variant="link"
                    onClick={clearFilters}
                    className="mt-2"
                  >
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
