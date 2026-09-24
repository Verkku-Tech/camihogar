import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Forge ERP — Camihogar',
        short_name: 'Forge',
        description: 'Sistema Integral de Gestión Comercial, Manufactura y Despacho — Camihogar',
        start_url: '/',
        scope: '/',
        theme_color: '#1AD96D',
        background_color: '#111418',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/logos/Imagotipo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/logos/Imagotipo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
      '@': path.resolve(import.meta.dirname, './src'),
      'next/link': path.resolve(import.meta.dirname, './src/lib/next-shims/link.tsx'),
      'next/navigation': path.resolve(import.meta.dirname, './src/lib/next-shims/navigation.tsx'),
      'next/image': path.resolve(import.meta.dirname, './src/lib/next-shims/image.tsx'),
      'next/dynamic': path.resolve(import.meta.dirname, './src/lib/next-shims/dynamic.tsx'),
      'next-themes': path.resolve(import.meta.dirname, './src/lib/next-shims/themes.tsx')
    }
  },
  server: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5173,
    strictPort: true,
    allowedHosts: ['local.verkku.com', '.verkku.com'],
    hmr: {
      clientPort: 443
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5173,
    strictPort: true,
    allowedHosts: ['local.verkku.com', '.verkku.com'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
