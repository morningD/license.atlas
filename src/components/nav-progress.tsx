// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import { useEffect, useRef } from "react";

export function NavProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    let timer: ReturnType<typeof setTimeout>;

    const show = () => {
      bar.style.transition = "width 0.3s ease";
      bar.style.width = "60%";
      bar.style.opacity = "1";
    };

    const done = () => {
      bar.style.transition = "width 0.2s ease, opacity 0.3s ease 0.2s";
      bar.style.width = "100%";
      bar.style.opacity = "0";
      timer = setTimeout(() => {
        bar.style.transition = "none";
        bar.style.width = "0%";
      }, 500);
    };

    document.addEventListener("astro:page-load", done);
    window.addEventListener("load", done);

    const pushState = history.pushState;
    history.pushState = function (...args) {
      show();
      return pushState.apply(this, args);
    };

    window.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest("a");
      if (a && a.href && a.target !== "_blank" && a.origin === location.origin) {
        show();
      }
    });

    return () => {
      clearTimeout(timer);
      document.removeEventListener("astro:page-load", done);
      window.removeEventListener("load", done);
      history.pushState = pushState;
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="fixed left-0 top-0 z-[100] h-[2px] opacity-0"
      style={{
        width: "0%",
        background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
      }}
    />
  );
}
