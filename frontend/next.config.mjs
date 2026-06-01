/** @type {import('next').NextConfig} */

const isGithubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const basePath =
  isGithubPages && repositoryName && !repositoryName.endsWith(".github.io")
    ? `/${repositoryName}`
    : "";

const nextConfig = {
  reactStrictMode: true,

  // Static HTML export (required for GitHub Pages)
  output: isGithubPages ? "export" : undefined,

  basePath,
  assetPrefix: basePath ? `${basePath}/` : "",

  // next/image doesn't work in static export without a loader
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
