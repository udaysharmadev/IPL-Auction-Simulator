/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the long-running dev server isolated from production builds. A
  // `next build` rewrites `.next`; using a separate development directory
  // prevents browsers from receiving HTML that references missing chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"
};
export default nextConfig;
