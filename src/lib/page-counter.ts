export const COUNTER_URL = "https://page-counter.duanmoming.workers.dev/v1/pageviews";
const SITE = "license-atlas";
const BASE_PATH = "/license.atlas";

let lastTrackedPath: string | null = null;
let siteViewCount: number | null = null;
const listeners = new Set<(count: number | null) => void>();

function notify() {
  for (const listener of listeners) listener(siteViewCount);
}

export function deploymentPath(pathname: string) {
  const normalized = pathname === "/" ? "" : pathname.replace(/\/$/, "");
  if (normalized === BASE_PATH || normalized.startsWith(`${BASE_PATH}/`)) {
    return normalized || BASE_PATH;
  }
  return `${BASE_PATH}${normalized}`;
}

export async function trackPageView(pathname: string) {
  const path = deploymentPath(pathname);
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  try {
    const response = await fetch(COUNTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: SITE, path }),
      keepalive: true,
    });
    if (!response.ok) return;
    const data = await response.json() as { count?: unknown };
    if (typeof data.count === "number") {
      siteViewCount = data.count;
      notify();
    }
  } catch {
    // Analytics must never interrupt navigation or rendering.
  }
}

export function subscribeToSiteViewCount(listener: (count: number | null) => void) {
  listeners.add(listener);
  listener(siteViewCount);
  return () => {
    listeners.delete(listener);
  };
}
