import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The screens only ever talk to the platform server, never to FrankieOne.
const platform = `http://localhost:${process.env.PLATFORM_PORT || 8100}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 8101,
    strictPort: true,
    proxy: { '/api': platform, '/internal': platform, '/demo': platform },
  },
});
