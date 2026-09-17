import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages requires relative base for asset resolution
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      manifestFilename: "manifest.webmanifest",
      injectRegister: "script",
      manifest: {
        name: "LithoDrop: Orbital Syndicate",
        short_name: "LithoDrop",
        description:
          "Pilot delivery landers through treacherous atmospheres and build off-world colonies on alien planets.",
        start_url: "./",
        display: "fullscreen",
        // Landscape-lock for consistent physics UX across mobile devices
        orientation: "landscape",
        theme_color: "#070B14",
        background_color: "#070B14",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Cache all static game assets aggressively for offline play
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json,bin,webmanifest}"],
        runtimeCaching: [
          {
            // Game assets: cache-first (sprites, sounds bundled at build time)
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|bin)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "lithodrop-assets",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        // Deterministic chunk names for cache busting
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        // Vendor chunk splitting: rolldown requires a function
        manualChunks: (id: string) => {
          if (id.includes("node_modules/pixi.js") || id.includes("node_modules/@pixi")) {
            return "pixi";
          }
          if (id.includes("node_modules/matter-js")) {
            return "matter";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react";
          }
        },
      },
    },
  },
  // Web Workers must use ES module format for tree-shaking
  worker: {
    format: "es",
  },
  // Optimize deps that use CommonJS
  optimizeDeps: {
    include: ["matter-js"],
  },
});
