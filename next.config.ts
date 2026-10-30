import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content Security Policy without nonces. Nonces need every page rendered per
// request, which turns off Partial Prerendering (cacheComponents), so
// script-src keeps 'unsafe-inline' for the inline scripts Next.js streams.
// Everything else is locked to this origin. See docs/SECURITY_REVIEW.md.
const contentSecurityPolicy = [
  "default-src 'self'",
  // React needs eval in development only, for its error overlays.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Inline style attributes from Tailwind utilities, charts and toasts.
  "style-src 'self' 'unsafe-inline'",
  // data: and blob: for generated QR codes and chart exports.
  "img-src 'self' data: blob:",
  // next/font serves the Google fonts from this origin.
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Older browsers that ignore frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Patient token links are bearer links, so never send them to other sites.
  { key: "Referrer-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Browsers ignore HSTS on plain HTTP (RFC 6797 §8.1), so this only takes
  // effect on HTTPS deployments; local and E2E runs over http are unaffected.
  // No includeSubDomains or preload: those affect the whole domain.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, copied into the Docker runner image.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
