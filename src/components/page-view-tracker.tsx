"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/page-counter";

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    void trackPageView(pathname);
  }, [pathname]);

  return null;
}
