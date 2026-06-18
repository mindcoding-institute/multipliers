// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://multipliers.mindcoding.institute',
  // SSR on Cloudflare: pages render on each request so the Turso listing is
  // always fresh and the future submission POST has a runtime to live in.
  output: 'server',
  adapter: cloudflare({
    // Lets `astro dev` read .dev.vars / bindings through the CF runtime proxy,
    // so Astro.locals.runtime.env works locally exactly as in production.
    platformProxy: { enabled: true },
  }),
  vite: {
    ssr: {
      // Defensive: lets Vite bundle @webtui/css if a full-library import is used.
      noExternal: ['@webtui/css'],
    },
    server: {
      // Repo lives on a Windows-mounted drive under WSL2, where inotify file
      // events don't fire — without polling, `astro dev` never sees edits.
      watch: { usePolling: true, interval: 300 },
    },
  },
});
