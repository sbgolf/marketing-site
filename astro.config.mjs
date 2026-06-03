import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://brand-marketing-site.pages.dev',
  integrations: [sitemap()],
  output: 'static',
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
});
