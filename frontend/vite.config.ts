import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    // Leitet /api ans Backend weiter -> kein CORS-Stress im Dev.
    proxy: { '/api': 'http://localhost:3001' },
  },
});
