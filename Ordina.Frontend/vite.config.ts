import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'

const certPath = path.resolve(import.meta.dirname, './.certs/localhost.pem')
const keyPath = path.resolve(import.meta.dirname, './.certs/localhost.key')
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)
const isProd = process.env.NODE_ENV === 'production'
// En desarrollo levantamos en HTTP por defecto. En producción o con HTTPS=true explícito usamos HTTPS si hay certificados.
const useHttps = (process.env.HTTPS === 'true' || (isProd && process.env.HTTPS !== 'false')) && hasCerts

const httpsConfig = useHttps
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    }
  : undefined

const defaultApiUrl = useHttps ? 'https://localhost:5001' : 'http://localhost:5000'
const apiUrl = process.env.VITE_API_URL || defaultApiUrl

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
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
    https: httpsConfig,
    allowedHosts: ['local.verkku.com', '.verkku.com'],
    hmr: process.env.HMR_CLIENT_PORT
      ? { clientPort: parseInt(process.env.HMR_CLIENT_PORT, 10) }
      : undefined,
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    host: true,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5173,
    strictPort: true,
    https: httpsConfig,
    allowedHosts: ['local.verkku.com', '.verkku.com'],
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        secure: false
      }
    }
  }
})
