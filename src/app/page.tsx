// SPDX-License-Identifier: MulanPSL-2.0

import type { Metadata } from "next";
import HomePageClient from "./home-client";
import stats from "@/data/stats.json";

const BASE_URL = "https://morningd.github.io/license.atlas";
const homeDescription = `Browse ${stats.total} software, AI model, data, agent, and terms licenses with full-text search, tag filters, popularity signals, and OSI review tracking. 收录 ${stats.total} 个软件、AI 模型、数据、Agent 与服务条款文本，支持全文搜索、标签筛选、热度信号与 OSI 审查追踪。`;

export const metadata: Metadata = {
  title: "LicenseAtlas — Software, Data, AI Model, and Agent License Explorer | 许可图鉴",
  description: homeDescription,
  alternates: {
    canonical: `${BASE_URL}/`,
  },
  openGraph: {
    title: "LicenseAtlas — Software, Data, AI Model, and Agent License Explorer",
    description: homeDescription,
    url: `${BASE_URL}/`,
    type: "website",
    siteName: "LicenseAtlas",
  },
  twitter: {
    card: "summary",
    title: "LicenseAtlas",
    description: homeDescription,
  },
};

export default function HomePage() {
  const homeJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "LicenseAtlas",
    alternateName: "许可图鉴",
    url: `${BASE_URL}/`,
    description: homeDescription,
    inLanguage: ["en", "zh"],
    isPartOf: {
      "@type": "WebSite",
      name: "LicenseAtlas",
      url: BASE_URL,
    },
    mainEntity: {
      "@type": "Dataset",
      name: "LicenseAtlas license index",
      description: homeDescription,
      measurementTechnique: [
        "license text aggregation",
        "source cross-linking",
        "search indexing",
      ],
      variableMeasured: [
        "license type",
        "OSI approval",
        "FSF libre status",
        "popularity signals",
        "review tracker linkage",
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <HomePageClient />
    </>
  );
}
