/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/luminaf",
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true, formats: ["image/avif", "image/webp"] },
};
export default nextConfig;
