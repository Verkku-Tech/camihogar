import type React from "react"
import type { Metadata, Viewport } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { NavigationProvider } from "@/contexts/navigation-context"
import { CurrencyProvider } from "@/contexts/currency-context"
import { Toaster } from "@/components/ui/sonner"
import { RegisterServiceWorker } from "@/components/pwa/register-sw"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import "./globals.css"


export const metadata: Metadata = {
  title: "CamiHogar - Sistema de Gestión de Pedidos",
  description: "PWA para gestión de pedidos, inventario y proveedores",
  generator: "CamiHogar",
  manifest: "/manifest.json",
  keywords: ["pedidos", "inventario", "gestión", "muebles", "PWA"],
  authors: [{ name: "CamiHogar" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CamiHogar",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5B4EFF" },
    { media: "(prefers-color-scheme: dark)", color: "#5B4EFF" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RegisterServiceWorker />
        <InstallPrompt />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="camihogar-theme"
        >
          <CurrencyProvider>
            <NavigationProvider>
              <AuthProvider>{children}</AuthProvider>
            </NavigationProvider>
          </CurrencyProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
