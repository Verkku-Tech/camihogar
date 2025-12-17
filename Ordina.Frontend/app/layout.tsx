import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { NavigationProvider } from "@/contexts/navigation-context"
import { CurrencyProvider } from "@/contexts/currency-context"
import { Toaster } from "@/components/ui/sonner"
import { RegisterServiceWorker } from "@/components/pwa/register-sw"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "CamiHogar - Sistema de Gestión de Pedidos",
  description: "PWA para gestión de pedidos, inventario y proveedores",
  generator: "CamiHogar",
  manifest: "/manifest.json",
  keywords: ["pedidos", "inventario", "gestión", "muebles", "PWA"],
  authors: [{ name: "CamiHogar" }],
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
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
