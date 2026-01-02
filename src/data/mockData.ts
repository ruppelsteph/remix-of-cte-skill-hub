// CTE Pathways
export interface CTEPathway {
  id: string;
  name: string;
  description: string;
  icon: string;
  videoCount: number;
}

export const ctePathways: CTEPathway[] = [
  {
    id: "health-science",
    name: "Health Science",
    description: "Medical procedures, patient care, health information, and therapeutic services.",
    icon: "Stethoscope",
    videoCount: 24,
  },
  {
    id: "information-technology",
    name: "Information Technology",
    description: "Programming, networking, cybersecurity, and digital communications.",
    icon: "Monitor",
    videoCount: 32,
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    description: "Production, quality control, welding, machining, and industrial maintenance.",
    icon: "Factory",
    videoCount: 28,
  },
  {
    id: "hospitality",
    name: "Hospitality & Tourism",
    description: "Culinary arts, lodging, travel and tourism, and event management.",
    icon: "UtensilsCrossed",
    videoCount: 18,
  },
  {
    id: "construction",
    name: "Architecture & Construction",
    description: "Building trades, carpentry, electrical, plumbing, and HVAC.",
    icon: "HardHat",
    videoCount: 22,
  },
  {
    id: "automotive",
    name: "Transportation",
    description: "Automotive technology, collision repair, and diesel mechanics.",
    icon: "Car",
    videoCount: 20,
  },
];

// Video Categories
export interface VideoCategory {
  id: string;
  name: string;
}

export const videoCategories: VideoCategory[] = [
  { id: "tutorials", name: "Tutorials" },
  { id: "demonstrations", name: "Demonstrations" },
  { id: "safety", name: "Safety" },
  { id: "soft-skills", name: "Soft Skills" },
  { id: "industry-overview", name: "Industry Overview" },
  { id: "certifications", name: "Certifications" },
];

// Videos
export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  durationMinutes: number;
  pathwayId: string;
  categoryIds: string[];
  level: "beginner" | "intermediate" | "advanced";
  createdAt: string;
}

export const videos: Video[] = [
  {
    id: "v1",
    title: "Introduction to Patient Vital Signs",
    description: "Learn the fundamentals of measuring and recording patient vital signs including blood pressure, pulse, respiration, and temperature.",
    thumbnailUrl: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=640&q=80",
    videoUrl: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
    durationMinutes: 18,
    pathwayId: "health-science",
    categoryIds: ["tutorials", "demonstrations"],
    level: "beginner",
    createdAt: "2024-01-15",
  },
  {
    id: "v2",
    title: "Workplace Safety Essentials in Healthcare",
    description: "Comprehensive guide to maintaining safety standards in healthcare environments, including infection control and ergonomics.",
    thumbnailUrl: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=640&q=80",
    videoUrl: "",
    durationMinutes: 25,
    pathwayId: "health-science",
    categoryIds: ["safety"],
    level: "beginner",
    createdAt: "2024-02-10",
  },
  {
    id: "v3",
    title: "Python Programming Fundamentals",
    description: "Start your coding journey with Python. Cover variables, data types, loops, and basic functions.",
    thumbnailUrl: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=640&q=80",
    videoUrl: "",
    durationMinutes: 45,
    pathwayId: "information-technology",
    categoryIds: ["tutorials"],
    level: "beginner",
    createdAt: "2024-01-20",
  },
  {
    id: "v4",
    title: "Network Security Best Practices",
    description: "Understand firewalls, encryption, and security protocols to protect network infrastructure.",
    thumbnailUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=640&q=80",
    videoUrl: "",
    durationMinutes: 35,
    pathwayId: "information-technology",
    categoryIds: ["tutorials", "safety"],
    level: "intermediate",
    createdAt: "2024-03-05",
  },
  {
    id: "v5",
    title: "MIG Welding Techniques",
    description: "Master MIG welding with proper setup, technique, and troubleshooting common issues.",
    thumbnailUrl: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=640&q=80",
    videoUrl: "",
    durationMinutes: 40,
    pathwayId: "manufacturing",
    categoryIds: ["demonstrations", "tutorials"],
    level: "intermediate",
    createdAt: "2024-02-28",
  },
  {
    id: "v6",
    title: "CNC Machine Operation Basics",
    description: "Learn to operate CNC machines safely and efficiently with hands-on demonstrations.",
    thumbnailUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=640&q=80",
    videoUrl: "",
    durationMinutes: 55,
    pathwayId: "manufacturing",
    categoryIds: ["demonstrations", "safety"],
    level: "beginner",
    createdAt: "2024-03-12",
  },
  {
    id: "v7",
    title: "Professional Kitchen Knife Skills",
    description: "Essential cutting techniques every culinary professional needs to master.",
    thumbnailUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=640&q=80",
    videoUrl: "",
    durationMinutes: 30,
    pathwayId: "hospitality",
    categoryIds: ["demonstrations", "tutorials"],
    level: "beginner",
    createdAt: "2024-01-25",
  },
  {
    id: "v8",
    title: "Customer Service Excellence",
    description: "Develop exceptional customer service skills for hospitality and service industries.",
    thumbnailUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=640&q=80",
    videoUrl: "",
    durationMinutes: 22,
    pathwayId: "hospitality",
    categoryIds: ["soft-skills"],
    level: "beginner",
    createdAt: "2024-02-15",
  },
  {
    id: "v9",
    title: "Residential Electrical Wiring",
    description: "Complete guide to residential electrical systems, from planning to installation.",
    thumbnailUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=640&q=80",
    videoUrl: "",
    durationMinutes: 50,
    pathwayId: "construction",
    categoryIds: ["tutorials", "safety"],
    level: "intermediate",
    createdAt: "2024-03-01",
  },
  {
    id: "v10",
    title: "Blueprint Reading Fundamentals",
    description: "Learn to read and interpret construction blueprints and technical drawings.",
    thumbnailUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=640&q=80",
    videoUrl: "",
    durationMinutes: 35,
    pathwayId: "construction",
    categoryIds: ["tutorials", "industry-overview"],
    level: "beginner",
    createdAt: "2024-02-20",
  },
  {
    id: "v11",
    title: "Automotive Brake System Repair",
    description: "Step-by-step guide to diagnosing and repairing automotive brake systems.",
    thumbnailUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=640&q=80",
    videoUrl: "",
    durationMinutes: 42,
    pathwayId: "automotive",
    categoryIds: ["demonstrations", "tutorials"],
    level: "intermediate",
    createdAt: "2024-03-08",
  },
  {
    id: "v12",
    title: "Engine Diagnostics with OBD-II",
    description: "Use OBD-II scanners to diagnose engine problems and understand trouble codes.",
    thumbnailUrl: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=640&q=80",
    videoUrl: "",
    durationMinutes: 38,
    pathwayId: "automotive",
    categoryIds: ["tutorials", "demonstrations"],
    level: "advanced",
    createdAt: "2024-03-15",
  },
];

// Demo Users
export interface User {
  id: string;
  email: string;
  fullName: string;
  isSubscribed: boolean;
  subscriptionPlan?: string;
  subscriptionEndDate?: string;
}

export const demoUsers: User[] = [
  {
    id: "user-1",
    email: "demo@cteskills.com",
    fullName: "Demo Student",
    isSubscribed: true,
    subscriptionPlan: "individual_annual",
    subscriptionEndDate: "2025-12-31",
  },
  {
    id: "user-2",
    email: "free@cteskills.com",
    fullName: "Free User",
    isSubscribed: false,
  },
];

// Helper functions
export function getVideosByPathway(pathwayId: string): Video[] {
  return videos.filter((v) => v.pathwayId === pathwayId);
}

export function getVideosByCategory(categoryId: string): Video[] {
  return videos.filter((v) => v.categoryIds.includes(categoryId));
}

export function getPathwayById(pathwayId: string): CTEPathway | undefined {
  return ctePathways.find((p) => p.id === pathwayId);
}

export function getVideoById(videoId: string): Video | undefined {
  return videos.find((v) => v.id === videoId);
}

export function searchVideos(query: string): Video[] {
  const lowerQuery = query.toLowerCase();
  return videos.filter(
    (v) =>
      v.title.toLowerCase().includes(lowerQuery) ||
      v.description.toLowerCase().includes(lowerQuery)
  );
}
