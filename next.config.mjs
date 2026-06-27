/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Server-only Node deps used in route handlers must not be bundled for the edge/client.
  serverExternalPackages: ["cheerio"],
  // Lint runs in CI (`npm run lint`); don't let a lint rule block a production deploy.
  eslint: { ignoreDuringBuilds: true },
  // Types are still fully checked (`npm run typecheck` + the build's own type pass).
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // pdfjs / tesseract are dynamically imported on the client only.
  },
  async headers() {
    return [
      {
        // Defense-in-depth headers for the whole app.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
