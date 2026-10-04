import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
 const env = loadEnv(mode, process.cwd(), '')
 // The API also serves the sitemap and robots.txt from the site root.
 const api = env.API_PROXY_TARGET || 'http://localhost:5000'
 const proxy = { '/api': api, '/sitemap.xml': api, '/robots.txt': api }
 return {
  plugins: [react(),
    tailwindcss()
  ],
  server:{port:5174, proxy},
  preview:{proxy}
 }
})
