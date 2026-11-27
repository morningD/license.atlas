// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import { useLang } from "@/lib/i18n";

export function TrackerPageFallback() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 text-center text-zinc-500">
      {t("tracker.loading")}
    </div>
  );
}
