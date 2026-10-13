import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

// This machine's LAN address, so a member link opened on a phone reaches the
// dev server even when the presenter is browsing on localhost.
const lanHost = Object.values(os.networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254'))
  ?.address || ''

export default defineConfig(({ mode }) => {
  // .env.local, for the API proxy target (the browser reads it via import.meta.env).
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [react()],
  define: {
    'import.meta.env.VITE_LAN_HOST': JSON.stringify(lanHost),
  },
  server: {
    // Bind to the LAN so the sign-up can be opened on a phone — a different
    // device is the clearest way to show the listener working.
    host: true,
    port: Number(process.env.PORT) || 8092,
    strictPort: true,
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://assets.frankiefinancial.io https://*.sardine.ai https://*.frankiefinancial.io https://*.frankie.one",
        "connect-src 'self' https://*.frankiefinancial.io https://*.sardine.ai wss://*.sardine.ai https://backend.latest.frankiefinancial.io https://*.frankie.one https://ipapi.co https://api.ipify.org https://ipwho.is",
        "frame-src 'self' https://*.frankiefinancial.io https://*.sardine.ai https://*.frankie.one https://verify.uat.frankie.one",
        "img-src 'self' data: blob: https:",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
      ].join('; '),
    },
    proxy: {
      '/api-proxy': {
        target: env.VITE_FRANKIE_API_URL || 'https://api.uat.frankie.one',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
        secure: true,
      },
    },
  },
}
})
