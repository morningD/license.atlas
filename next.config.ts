// SPDX-License-Identifier: MulanPSL-2.0

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/license.atlas",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
