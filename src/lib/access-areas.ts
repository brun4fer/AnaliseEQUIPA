export const accessAreas = ["matches", "newMatch", "maps", "reports", "maintenance", "settings", "help", "analysis"] as const;
export type AccessArea = typeof accessAreas[number];

export const accessAreaDetails: Record<AccessArea, { label: string; defaultPassword: string }> = {
  matches: { label: "Matches", defaultPassword: "matches" },
  newMatch: { label: "New match", defaultPassword: "newmatch" },
  maps: { label: "Maps", defaultPassword: "maps" },
  reports: { label: "Reports", defaultPassword: "reports" },
  maintenance: { label: "Maintenance", defaultPassword: "maintenance" },
  settings: { label: "Settings", defaultPassword: "settings" },
  help: { label: "Help", defaultPassword: "help" },
  analysis: { label: "Analysis", defaultPassword: "analysis" },
};

export const globalAccessDefaultPassword = "global";
export function isAccessArea(value: unknown): value is AccessArea { return typeof value === "string" && accessAreas.includes(value as AccessArea); }
export function accessAreaForPath(pathname: string): AccessArea | null {
  if (pathname === "/") return "matches";
  if (pathname === "/matches/new" || pathname.startsWith("/matches/new/")) return "newMatch";
  if (pathname.startsWith("/maps")) return "maps";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/maintenance")) return "maintenance";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/help")) return "help";
  if (pathname.startsWith("/analysis")) return "analysis";
  if (/^\/matches\/[^/]+\/edit$/.test(pathname)) return "matches";
  return null;
}
