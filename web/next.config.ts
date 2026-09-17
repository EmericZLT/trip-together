import type { NextConfig } from "next";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root },
  outputFileTracingRoot: root,
};
export default config;
