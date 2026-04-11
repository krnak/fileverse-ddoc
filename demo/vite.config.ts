import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/ddocs/',
  server: {
    allowedHosts: true,
    proxy: {
      '/gate-api': {
        target: process.env.VITE_GATE_UPSTREAM || 'https://liqk.kairos.to',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gate-api/, ''),
        secure: true,
        cookieDomainRewrite: 'localhost',
        configure: (proxy) => {
          // Strip Secure and SameSite flags from upstream cookies
          // so they work over plain HTTP localhost
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map((cookie: string) =>
                cookie
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*SameSite=\w+/gi, '; SameSite=Lax')
              );
            }
          });
        },
      },
    },
  },
  preview: {
    allowedHosts: true,
  },
})
