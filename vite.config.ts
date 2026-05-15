import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import viteCompression from "vite-plugin-compression";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // PWA Plugin (enabled only when VITE_ENABLE_PWA=true)
    process.env.VITE_ENABLE_PWA === 'true' && VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/basemaps\.cartocdn\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-tiles-v1',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'telemetry-v1',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'BIKO - Fleet Operations & Logistics',
        short_name: 'BIKO',
        description: 'Real-time fleet operations, route planning, and logistics management',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon',
          },
          {
            src: '/map/sprites/operational.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/map/sprites/operational@2x.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      devOptions: {
        enabled: mode === 'development',
        type: 'module',
      },
    }),
    // Gzip compression for production
    mode === "production" && viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files > 10KB
    }),
    // Brotli compression for production (better compression)
    mode === "production" && viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  esbuild: {
    // Strip console.log and debugger in production for smaller bundles and security
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  // Pre-bundle heavy/lazy-only deps so Vite doesn't re-optimize mid-session
  // (which invalidates browser chunk URLs and causes "504 Outdated Optimize Dep"
  // followed by "Failed to fetch dynamically imported module" on lazy routes).
  optimizeDeps: {
    include: [
      'papaparse',
      'exceljs',
      'mammoth',
      'pdfjs-dist',
      'tesseract.js',
      '@radix-ui/react-switch',
    ],
  },
  build: {
    // Target modern browsers (ES2020) to avoid transpiling to older, bulkier ES5 code
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for large dependencies
          if (id.includes('node_modules')) {
            // PDF/Export libraries — only safe to defer when not statically imported by lib files
            // papaparse and json2csv are excluded: they're imported in shared lib/*.ts files
            // that get hoisted to eager chunks, causing TDZ circular deps if placed here
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('xlsx') ||
                id.includes('pdfjs-dist') || id.includes('mammoth') || id.includes('exceljs')) {
              return 'vendor-export';
            }

            // Maps (Leaflet + MapLibre)
            if (id.includes('leaflet') || id.includes('react-leaflet') ||
                id.includes('maplibre-gl') || id.includes('react-map-gl') ||
                id.includes('@mapbox/mapbox-gl-draw')) {
              return 'vendor-maps';
            }

            // Charts
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }

            // Supabase
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }

            // Date utilities
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }

            // UI primitives — large but stable, cache independently
            if (id.includes('@radix-ui') || id.includes('lucide-react') ||
                id.includes('class-variance-authority') || id.includes('clsx') ||
                id.includes('tailwind-merge') || id.includes('cmdk') ||
                id.includes('vaul') || id.includes('sonner') || id.includes('next-themes') ||
                id.includes('embla-carousel')) {
              return 'vendor-ui';
            }

            // React core + routing — tiny but must load first
            if (id.includes('/react/') || id.includes('/react-dom/') ||
                id.includes('react-router') || id.includes('scheduler')) {
              return 'vendor-react';
            }

            // Form / validation
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/')) {
              return 'vendor-forms';
            }

            // State management + DnD
            if (id.includes('zustand') || id.includes('@tanstack') || id.includes('@dnd-kit')) {
              return 'vendor-state';
            }
          }
        },
      },
    },
    // Increase chunk size warning limit (we're splitting now)
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging (disable in production)
    sourcemap: mode === 'development',
  },
}));
