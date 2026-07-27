import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
