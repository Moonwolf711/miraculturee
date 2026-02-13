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
          /* React core — cached long-term, rarely changes */
          if (id.includes('react-dom') || (id.includes('/react/') && !id.includes('react-router') && !id.includes('react-helmet') && !id.includes('react-stripe'))) {
            return 'vendor-react';
          }
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
          /* Socket.io client */
          if (id.includes('socket.io-client') || id.includes('engine.io')) {
            return 'vendor-socket';
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
