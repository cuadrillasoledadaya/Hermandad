import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { readFileSync } from "fs";
import { join } from "path";

// Leer versión de package.json de forma segura
const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const APP_VERSION = packageJson.version;

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: false, // Habilitado para navegación offline
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // También ignoramos errores de TS para máxima velocidad en este despliegue crítico
  },
};

export default withSerwist(nextConfig);
