// SPDX-License-Identifier: MulanPSL-2.0

// Site-wide constants shared by the per-page metadata definitions.
export const SITE_URL = "https://morningd.github.io/license.atlas";

// Every page defines its own `openGraph` block, and Next.js replaces that
// block wholesale instead of merging it, so each page has to list the image.
export const SITE_OG_IMAGE = {
  url: `${SITE_URL}/og.png`,
  width: 1200,
  height: 630,
  alt: "LicenseAtlas: software, data, AI model, and agent licenses in one searchable place",
};
