import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "unpdf",
    "@napi-rs/canvas",
    "@prisma/client",
    "prisma",
    "playwright",
    "playwright-core",
    "@sparticuz/chromium",
  ],
  outputFileTracingIncludes: {
    "/api/resume": [
      "./node_modules/unpdf/**/*",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
