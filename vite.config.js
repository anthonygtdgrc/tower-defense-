import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works both at a domain root and under
  // a subpath (e.g. GitHub Pages project sites serve from /<repo-name>/).
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    sourcemap: true
  }
});
