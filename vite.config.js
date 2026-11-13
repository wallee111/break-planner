import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // When I Work calendar feeds send no CORS headers, so the app fetches
      // them same-origin via /wiw-proxy/<token>.ics. Production uses the
      // Supabase Edge Function (supabase/functions/wiw-proxy) instead, with
      // VITE_WIW_PROXY_URL pointing at the deployed function.
      '/wiw-proxy': {
        target: 'https://app.wheniwork.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wiw-proxy/, '/calendar'),
      },
    },
  },
})
