import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === "true" || process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  basePath: "/nexus", // <-- Defina fixo aqui
  assetPrefix: "/nexus",
  poweredByHeader: false,
  async headers() {
    const headers = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Frame-Options",
        value: "SAMEORIGIN",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
      {
        key: "Content-Security-Policy",
        value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'",
      },
    ];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/nexus",
        basePath: false,
        permanent: false,
      },
      {
        source: "/agendamento",
        destination: "/nexus/agendamento",
        basePath: false,
        permanent: false,
      },
      {
        source: "/loadingpage",
        destination: "/nexus/agendamento",
        basePath: false,
        permanent: false,
      },
      {
        source: "/landingpage",
        destination: "/nexus/agendamento",
        basePath: false,
        permanent: false,
      },
      {
        source: "/recuperar-senha",
        destination: "/nexus/recuperar-senha",
        basePath: false,
        permanent: false,
      },
    ];
  },
  experimental: {
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
};

export default nextConfig;
