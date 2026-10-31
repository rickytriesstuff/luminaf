/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  basePath: process.env.NEXT_PUBLIC_SITE_BASE_PATH || "",
};
export default nextConfig;
