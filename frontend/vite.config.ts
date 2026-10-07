import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Requests every store page makes as soon as it starts: the admin-managed content (hero, banners, store details),
// the shopper's session and the category list. Preloading them from the HTML starts them while the app's
// JavaScript is still downloading, instead of after it has run; the app's own fetch then reuses the response.
// The paths must match the app's requests exactly (src/frontApisRoute: contentApi.site, authApi.current, categoriesApi.list).
const STARTUP_REQUESTS = ['/content', '/auth/me', '/categories']

function preloadStartupData(apiBase: string): Plugin {
  return {
    name: 'greenfarm-preload-startup-data',
    transformIndexHtml: () => STARTUP_REQUESTS.map((path) => ({
      tag: 'link',
      // use-credentials: the app sends the sign-in cookies (credentials: "include"), and a preload is only reused
      // by a request made with the same credentials mode.
      attrs: { rel: 'preload', as: 'fetch', href: `${apiBase}${path}`, crossorigin: 'use-credentials' },
      injectTo: 'head-prepend',
    })),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
 const env = loadEnv(mode, process.cwd(), '')
 // The API also serves the sitemap and robots.txt from the site root.
 const api = env.API_PROXY_TARGET || 'http://localhost:5000'
 const proxy = { '/api': api, '/sitemap.xml': api, '/robots.txt': api }
 const apiBase = (env.VITE_API_URL || '/api').replace(/\/$/, '')
 return {
  plugins: [react(),
    tailwindcss(),
    preloadStartupData(apiBase),
  ],
  server:{port:5174, proxy},
  preview:{proxy}
 }
})
