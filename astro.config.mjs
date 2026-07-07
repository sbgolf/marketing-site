import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const sitemapExcludedPaths = [
  '/access-guides/',
  '/asset-checklist/',
  '/intake/',
  '/staging-review/',
  '/outreach-assets/',
];

export default defineConfig({
  site: isGitHubPages
    ? 'https://sbgolf.github.io'
    : 'https://startlinesites.com',
  base: isGitHubPages ? '/marketing-site' : undefined,
  integrations: [sitemap({
    filter: (page) => !sitemapExcludedPaths.some((path) => page.endsWith(path)),
  })],
  output: 'static',
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
});
