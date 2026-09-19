import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'Ordina ERP - Camihogar',
        short_name: 'Ordina',
        description: 'Sistema Integral de Gestión Comercial, Manufactura y Despacho - Camihogar',
        theme_color: '#1CB569',
        background_color: '#111418',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/finance/exchange-rates') || url.pathname.startsWith('/api/categories'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-reference-data',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
