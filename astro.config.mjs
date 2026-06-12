import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  site: isGitHubPages
    ? 'https://sbgolf.github.io'
    : 'https://startlinesites.com',
  base: isGitHubPages ? '/marketing-site' : undefined,
  integrations: [sitemap()],
  output: 'static',
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
});
