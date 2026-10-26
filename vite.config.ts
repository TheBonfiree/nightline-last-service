import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /* Split the framework out from the artifact. Two reasons: React is
         * the overwhelming majority of the bundle and never changes between
         * deploys, so it should sit in its own long-lived cache entry; and
         * splitting makes the real number visible — the page's own code is
         * what the motion budget is actually about. */
        manualChunks: (id: string) =>
          (/node_modules[\/](react|react-dom|scheduler)[\/]/.test(id) ? 'react' : undefined),
      },
    },
  },
});
