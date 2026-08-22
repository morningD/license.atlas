import { Metadata } from "next";
import { Suspense } from "react";
import { TrackerClient } from "./tracker-client";
import { TrackerPageFallback } from "@/components/tracker/tracker-page-fallback";
import trackerMeta from "@/data/tracker-meta.json";

const BASE_URL = "https://morningd.github.io/license.atlas";
const trackerUrl = `${BASE_URL}/tracker`;
const trackerDescription = `Track ${trackerMeta.total_submissions} OSI license reviews with submissions, discussion timelines, sentiment, and board votes where available. Includes ${trackerMeta.by_status.approved} approved, ${trackerMeta.by_status.rejected} rejected, and ${trackerMeta.by_status.pending} pending reviews. 追踪 ${trackerMeta.total_submissions} 个 OSI 许可证审查条目，涵盖提交、讨论时间线、情绪倾向与董事会投票；其中 ${trackerMeta.by_status.approved} 个已批准、${trackerMeta.by_status.rejected} 个被拒、${trackerMeta.by_status.pending} 个待决。`;

export const metadata: Metadata = {
  title: "OSI License Review Tracker — LicenseAtlas | OSI 许可证审查追踪",
  description: trackerDescription,
  alternates: {
    canonical: trackerUrl,
  },
  openGraph: {
    title: "OSI License Review Tracker — LicenseAtlas",
    description: trackerDescription,
    url: trackerUrl,
    type: "website",
    siteName: "LicenseAtlas",
  },
  twitter: {
    card: "summary",
    title: "OSI License Review Tracker — LicenseAtlas",
    description: trackerDescription,
  },
};

// useSearchParams requires a Suspense boundary under static export (output: "export").
export default function TrackerPage() {
  const trackerJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "OSI License Review Tracker",
    alternateName: "OSI 许可证审查追踪",
    url: trackerUrl,
    description: trackerDescription,
    inLanguage: ["en", "zh"],
    isPartOf: {
      "@type": "WebSite",
      name: "LicenseAtlas",
      url: BASE_URL,
    },
    mainEntity: {
      "@type": "Dataset",
      name: "OSI License Review Tracker dataset",
      description: trackerDescription,
      url: `${BASE_URL}/data/tracker.json`,
      dateModified: trackerMeta.generated_at,
      measurementTechnique: [
        "OSI API aggregation",
        "mailing-list timeline extraction",
        "board-minutes vote extraction",
      ],
      creator: {
        "@type": "Person",
        name: "morningD",
      },
      variableMeasured: [
        "submission status",
        "first submit date",
        "decision date",
        "timeline events",
        "board votes",
        "license text revisions",
      ],
    },
    dateModified: trackerMeta.generated_at,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(trackerJsonLd) }}
      />
      <Suspense fallback={<TrackerPageFallback />}>
        <TrackerClient />
      </Suspense>
    </>
  );
}
