"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  HelpCircle,
  User,
  LogOut,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getAll } from "@/lib/indexeddb";
import { ExchangeRate } from "@/lib/currency-utils";
import { useRouter } from "next/navigation";

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const [hasActiveExchangeRates, setHasActiveExchangeRates] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Verificar si hay tasas de cambio activas
  useEffect(() => {
    const checkExchangeRates = async () => {
      try {
        const allRates = await getAll<ExchangeRate>("exchange_rates");
        const activeRates = allRates.filter((r) => r.isActive);
        setHasActiveExchangeRates(activeRates.length > 0);
      } catch (error) {
        console.error("Error checking exchange rates:", error);
        setHasActiveExchangeRates(true); // Por defecto asumir que hay tasas
      }
    };

    checkExchangeRates();

    // Escuchar cambios en las tasas
    const handleRateUpdate = () => {
      checkExchangeRates();
    };
    window.addEventListener("exchangeRateUpdated", handleRateUpdate);

    return () => {
      window.removeEventListener("exchangeRateUpdated", handleRateUpdate);
    };
  }, []);

  const toggleTheme = () => {
    // Default to light if theme is undefined or system
    const currentTheme = theme === "dark" ? "dark" : "light";

    if (currentTheme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (!mounted) {
    return (
      <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-10 w-64" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-5 h-5" />
                {!hasActiveExchangeRates && (
                  <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full border-2 border-background" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              {!hasActiveExchangeRates ? (
                <>
                  <div className="px-3 py-2">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-amber-800 dark:text-amber-200 mb-1">
                          No hay tasas de cambio configuradas
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                          Es necesario crear al menos una tasa de cambio (USD o EUR) para poder 
                          realizar conversiones de moneda en pedidos y presupuestos.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => router.push("/configuracion/tasas")}
                          className="w-full"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Ir a Tasas de Cambio
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No hay notificaciones
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <Button variant="ghost" size="sm">
            <HelpCircle className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-sm">
                <User className="w-4 h-4 mr-2" />
                Cargando...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 z-[9999]"
              sideOffset={5}
              alignOffset={-5}
            >
              <DropdownMenuItem
                onSelect={handleLogout}
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer font-medium hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    );
  }

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-10 w-64" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="w-5 h-5" />
              {!hasActiveExchangeRates && (
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full border-2 border-background" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            {!hasActiveExchangeRates ? (
              <>
                <div className="px-3 py-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-amber-800 dark:text-amber-200 mb-1">
                        No hay tasas de cambio configuradas
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                        Es necesario crear al menos una tasa de cambio (USD o EUR) para poder 
                        realizar conversiones de moneda en pedidos y presupuestos.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => router.push("/configuracion/tasas")}
                        className="w-full"
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Ir a Tasas de Cambio
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No hay notificaciones
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>

        <Button variant="ghost" size="sm">
          <HelpCircle className="w-5 h-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm hover:bg-accent focus:bg-accent"
            >
              <User className="w-4 h-4 mr-2" />
              {user?.name || user?.email || "Usuario"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 z-[9999]"
            sideOffset={5}
            alignOffset={-5}
          >
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">{user?.name}</div>
              <div className="truncate">{user?.email}</div>
              <div className="text-xs">{user?.role}</div>
            </div>
            <DropdownMenuSeparator />

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer font-medium hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
