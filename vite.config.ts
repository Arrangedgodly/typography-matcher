import { defineConfig } from 'vite'

// Custom domain: served from the root of font.graydonwasil.com (GitHub Pages
// behind Cloudflare DNS — public/CNAME carries the hostname to Pages).
export default defineConfig({
  base: '/',
})
