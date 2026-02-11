import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    /* Target modern browsers for smaller output */
    target: 'es2022',
    /* Split vendor libraries into separate cacheable chunks */
    rollupOptions: {
      output: {
        manualChunks(id) {
          /* Stripe SDK — only loaded when payment form is shown (lazy) */
          if (id.includes('@stripe/stripe-js') || id.includes('@stripe/react-stripe-js')) {
            return 'vendor-stripe';
          }
          /* Router — cached long-term across all pages */
          if (id.includes('react-router-dom') || id.includes('@remix-run/router') || id.includes('react-router')) {
            return 'vendor-router';
          }
          /* SEO / Helmet */
          if (id.includes('react-helmet-async')) {
            return 'vendor-seo';
          }
        },
      },
    },
    /* Enable CSS code splitting so non-critical CSS is deferred */
    cssCodeSplit: true,
    /* Increase inline limit for tiny assets to reduce HTTP requests */
    assetsInlineLimit: 4096,
  },
});
