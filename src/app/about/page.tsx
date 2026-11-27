// SPDX-License-Identifier: MulanPSL-2.0

import type { Metadata } from "next";
import AboutPageClient from "./about-client";
import stats from "@/data/stats.json";

const BASE_URL = "https://morningd.github.io/license.atlas";
const aboutDescription = `Learn how LicenseAtlas curates ${stats.total} software, data, AI model, agent, and terms licenses, plus OSI review-tracker records and OSADL checklist metadata. 了解 LicenseAtlas 如何整理 ${stats.total} 个软件、数据、AI 模型、Agent 与服务条款文本，并整合 OSI 审查追踪记录和 OSADL 检查清单元数据。`;

export const metadata: Metadata = {
  title: "About LicenseAtlas — Data Sources, Scope, and Methods | 关于许可图鉴",
  description: aboutDescription,
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
  openGraph: {
    title: "About LicenseAtlas",
    description: aboutDescription,
    url: `${BASE_URL}/about`,
    type: "article",
    siteName: "LicenseAtlas",
  },
  twitter: {
    card: "summary",
    title: "About LicenseAtlas",
    description: aboutDescription,
  },
};

export default function AboutPage() {
  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About LicenseAtlas",
    alternateName: "关于许可图鉴",
    url: `${BASE_URL}/about`,
    description: aboutDescription,
    inLanguage: ["en", "zh"],
    about: {
      "@type": "Dataset",
      name: "LicenseAtlas data sources and methods",
      description: aboutDescription,
      creator: {
        "@type": "Person",
        name: "morningD",
      },
      dateModified: stats.updated,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <AboutPageClient />
    </>
  );
}
