export const FRANCHISE_IDS = ["KKR", "MI", "RCB", "CSK", "SRH", "RR", "DC", "PBKS", "LSG", "GT"] as const;
export type FranchiseId = (typeof FRANCHISE_IDS)[number];

export type Franchise = {
  id: FranchiseId;
  name: string;
  shortName: FranchiseId;
  city: string;
  /** Compatibility color consumed by the current UI. */
  color: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  crestSlug: string;
  homeVenue: string;
};

export const FRANCHISES_2027: Franchise[] = [
  {
    id: "KKR",
    name: "Kolkata Knight Riders",
    shortName: "KKR",
    city: "Kolkata",
    color: "#6f3e83",
    colors: { primary: "#3a225d", secondary: "#f0c75e", accent: "#8d5ca8" },
    crestSlug: "kolkata-knight-riders",
    homeVenue: "Eden Gardens"
  },
  {
    id: "MI",
    name: "Mumbai Indians",
    shortName: "MI",
    city: "Mumbai",
    color: "#1f5b91",
    colors: { primary: "#005da0", secondary: "#d1ab3e", accent: "#3d8bd4" },
    crestSlug: "mumbai-indians",
    homeVenue: "Wankhede Stadium"
  },
  {
    id: "RCB",
    name: "Royal Challengers Bengaluru",
    shortName: "RCB",
    city: "Bengaluru",
    color: "#a23d42",
    colors: { primary: "#ba1f2e", secondary: "#d6b56d", accent: "#d05b62" },
    crestSlug: "royal-challengers-bengaluru",
    homeVenue: "M. Chinnaswamy Stadium"
  },
  {
    id: "CSK",
    name: "Chennai Super Kings",
    shortName: "CSK",
    city: "Chennai",
    color: "#b18a29",
    colors: { primary: "#f5ce34", secondary: "#1c73b8", accent: "#d3ab42" },
    crestSlug: "chennai-super-kings",
    homeVenue: "M. A. Chidambaram Stadium"
  },
  {
    id: "SRH",
    name: "Sunrisers Hyderabad",
    shortName: "SRH",
    city: "Hyderabad",
    color: "#d66a23",
    colors: { primary: "#f47a24", secondary: "#1d1d1d", accent: "#ec7a33" },
    crestSlug: "sunrisers-hyderabad",
    homeVenue: "Rajiv Gandhi International Stadium"
  },
  {
    id: "RR",
    name: "Rajasthan Royals",
    shortName: "RR",
    city: "Jaipur",
    color: "#4269a5",
    colors: { primary: "#e83e8c", secondary: "#254aa5", accent: "#6793d4" },
    crestSlug: "rajasthan-royals",
    homeVenue: "Sawai Mansingh Stadium"
  },
  {
    id: "DC",
    name: "Delhi Capitals",
    shortName: "DC",
    city: "Delhi",
    color: "#387595",
    colors: { primary: "#17479e", secondary: "#d71920", accent: "#56a0bd" },
    crestSlug: "delhi-capitals",
    homeVenue: "Arun Jaitley Stadium"
  },
  {
    id: "PBKS",
    name: "Punjab Kings",
    shortName: "PBKS",
    city: "Punjab",
    color: "#b94859",
    colors: { primary: "#ed1b24", secondary: "#d8b76d", accent: "#d75c6d" },
    crestSlug: "punjab-kings",
    homeVenue: "Maharaja Yadavindra Singh International Stadium"
  },
  {
    id: "LSG",
    name: "Lucknow Super Giants",
    shortName: "LSG",
    city: "Lucknow",
    color: "#3b8f9c",
    colors: { primary: "#2f9bd7", secondary: "#f26a24", accent: "#52b8c6" },
    crestSlug: "lucknow-super-giants",
    homeVenue: "BRSABV Ekana Cricket Stadium"
  },
  {
    id: "GT",
    name: "Gujarat Titans",
    shortName: "GT",
    city: "Ahmedabad",
    color: "#527082",
    colors: { primary: "#1b2133", secondary: "#d2aa55", accent: "#758e9d" },
    crestSlug: "gujarat-titans",
    homeVenue: "Narendra Modi Stadium"
  }
];

export const FRANCHISE_BY_ID = Object.fromEntries(
  FRANCHISES_2027.map((franchise) => [franchise.id, franchise])
) as Record<FranchiseId, Franchise>;
