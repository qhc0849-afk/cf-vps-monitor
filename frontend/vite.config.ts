import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Fork deployments override the repository baked into agent install
  // commands with VITE_CF_MONITOR_REPOSITORY. A real build variable wins; a
  // .env entry is the fallback. It is injected as a define, not read through
  // import.meta.env, because projectLinks.ts is also loaded by the vm-based
  // test helper (frontend/test/helpers/production-module.mjs), where
  // import.meta is a parse error. See projectLinks.ts.
  const repository = process.env.VITE_CF_MONITOR_REPOSITORY
    ?? loadEnv(mode, process.cwd(), '').VITE_CF_MONITOR_REPOSITORY
    ?? '';
  return {
    plugins: [react()],
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __CF_MONITOR_REPOSITORY__: JSON.stringify(repository),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
