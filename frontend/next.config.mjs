/** @type {import('next').NextConfig} */

// When deploying to GitHub Pages the app lives at /<repo-name>/
// In local dev or on Vercel there is no sub-path, so we leave it empty.
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  reactStrictMode: true,

  // Static HTML export (required for GitHub Pages)
  output: isGithubPages ? "export" : undefined,

  // Repo sub-path on GitHub Pages  e.g. /cyber-AI-concierge
  basePath: isGithubPages ? "/cyber-AI-concierge" : "",
  assetPrefix: isGithubPages ? "/cyber-AI-concierge/" : "",

  // next/image doesn't work in static export without a loader
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
