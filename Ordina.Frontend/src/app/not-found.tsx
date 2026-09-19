"use client"

import Link from "next/link"
import { Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* 404 Illustration */}
        <div className="space-y-4">
          <div className="text-8xl font-bold text-indigo-600 dark:text-indigo-400">404</div>
          <h1 className="text-2xl font-semibold text-foreground">Página no encontrada</h1>
          <p className="text-muted-foreground">Lo sentimos, la página que estás buscando no existe o ha sido movida.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Ir al Dashboard
            </Link>
          </Button>

          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver atrás
          </Button>
        </div>

        {/* Additional Help */}
        <div className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            ¿Necesitas ayuda? Contacta con el{" "}
            <Link href="#" className="text-indigo-600 hover:text-indigo-700 underline">
              soporte técnico
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
