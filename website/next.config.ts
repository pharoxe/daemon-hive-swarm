import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@rdna/radiants", "@rdna/pixel", "@rdna/dithwather-react"],
  turbopack: {
    root: websiteRoot,
  },
};

export default nextConfig;
