// SPDX-License-Identifier: MulanPSL-2.0

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LicenseDetailClient } from "./license-detail-client";
import licenses from "@/data/licenses.json";
import type { License } from "@/lib/types";

const allLicenses = licenses as License[];
const slugMap = new Map(
  allLicenses.map((l, i) => [l.slug, { license: l, index: i }])
);

export function generateStaticParams() {
  return allLicenses.map((l) => ({ slug: l.slug }));
}

const BASE_URL = "https://morningd.github.io/license.atlas";

function typeLabel(type: License["type"]) {
  return ({
    software: "software",
    model: "AI model",
    data: "data",
    agent: "agent",
    terms: "terms-of-use",
  })[type];
}

function typeLabelZh(type: License["type"]) {
  return ({
    software: "软件",
    model: "AI 模型",
    data: "数据",
    agent: "Agent",
    terms: "服务条款",
  })[type];
}

function buildLicenseDescription(license: License) {
  const statusBits = [
    license.spdx_id ? `SPDX: ${license.spdx_id}` : null,
    license.osi_approved ? "OSI-approved" : null,
    license.fsf_libre ? "FSF libre" : null,
  ].filter(Boolean);
  const zhStatusBits = [
    license.spdx_id ? `SPDX：${license.spdx_id}` : null,
    license.osi_approved ? "OSI 批准" : null,
    license.fsf_libre ? "FSF 自由软件" : null,
  ].filter(Boolean);
  const statusText = statusBits.length ? ` ${statusBits.join(", ")}.` : "";
  const zhStatusText = zhStatusBits.length ? ` ${zhStatusBits.join("，")}。` : "。";
  return `${license.title} — a ${typeLabel(license.type)} license.${statusText} View full text, permissions, conditions, limitations, and sources. ${license.title}：${typeLabelZh(license.type)}许可证${zhStatusText}可查看全文、权限、条件、限制与来源。`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = slugMap.get(slug);
  if (!entry) return { title: "LicenseAtlas" };
  const { license } = entry;
  const title = `${license.title} — LicenseAtlas | 许可证全文与条件`;
  const description = buildLicenseDescription(license);
  const url = `${BASE_URL}/licenses/${license.slug}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "LicenseAtlas",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function LicenseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = slugMap.get(slug);
  if (!entry) notFound();

  const { license, index } = entry;
  const prev = index > 0 ? allLicenses[index - 1] : null;
  const next = index < allLicenses.length - 1 ? allLicenses[index + 1] : null;
  const canonicalUrl = `${BASE_URL}/licenses/${license.slug}`;
  const licenseJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: license.title,
    alternateName: license.spdx_id || undefined,
    url: canonicalUrl,
    inLanguage: license.languages?.length ? license.languages : ["en", "zh"],
    genre: `${typeLabel(license.type)} license`,
    keywords: [
      license.type,
      license.spdx_id,
      license.osi_approved ? "OSI-approved" : null,
      license.fsf_libre ? "FSF libre" : null,
      ...(license.tags || []).slice(0, 8),
    ].filter(Boolean),
    description: buildLicenseDescription(license),
    license: canonicalUrl,
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "LicenseAtlas",
      url: BASE_URL,
    },
    datePublished: license.created_at || undefined,
    dateModified: license.created_at || undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(licenseJsonLd) }}
      />
      <LicenseDetailClient
        license={license}
        prev={prev ? { slug: prev.slug, title: prev.title } : null}
        next={next ? { slug: next.slug, title: next.title } : null}
      />
    </>
  );
}
