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
  KeyRound,
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

import { ExchangeRate } from "@/lib/currency-utils";
import { useRouter } from "next/navigation";

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

import { CurrencyCalculatorDialog } from "@/components/currency/currency-calculator-dialog";
import { OrderAuditLogDialog } from "@/components/orders/order-audit-log-dialog";
import { Calculator, ScrollText } from "lucide-react";
import { OrderSearchCombobox } from "@/components/dashboard/order-search-combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const [hasActiveExchangeRates, setHasActiveExchangeRates] = useState(true);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ... existing useEffects ...

  // Verificar si hay tasas de cambio activas
  useEffect(() => {
    const checkExchangeRates = async () => {
      try {
        const { ApiClient } = await import("@/lib/api-client");
        const client = new ApiClient();
        const activeRates = await client.getActiveExchangeRates();
        setHasActiveExchangeRates(activeRates && activeRates.length > 0);
      } catch (error) {
        console.error("Error checking exchange rates:", error);
        // Si hay error (ej: backend caído), asumimos que no hay tasas para alertar al usuario
        // O podríamos dejarlo en true para no molestar. 
        // En este caso, si falla el check, mejor mostrar alerta si no estamos seguros, o false?
        // El código original ponía true en catch. Si falla el backend, quizás no queremos bloquear.
        // Pero si el usuario dice que "no muestra notificación", es porque quiere verla.
        // Si falla la conexión, hasActiveExchangeRates = false mostraría la alerta.
        setHasActiveExchangeRates(false);
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

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    setIsChangingPassword(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      toast.success("Contraseña actualizada correctamente");
      setIsChangePasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al cambiar la contraseña";
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const canViewOrderAuditLogs =
    user?.role === "Super Administrator" || user?.role === "Administrator";

  const CalculatorButton = () => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsCalculatorOpen(true)}
      title="Calculadora de Divisas"
    >
      <Calculator className="w-5 h-5" />
    </Button>
  );

  const AuditLogButton = () =>
    canViewOrderAuditLogs ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsAuditLogOpen(true)}
        title="Auditoría de pedidos"
      >
        <ScrollText className="w-5 h-5" />
      </Button>
    ) : null;

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
          <OrderSearchCombobox />

          <CalculatorButton />
          <AuditLogButton />

          <DropdownMenu>
            {/* ... Bell Dropdown ... */}
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
        <CurrencyCalculatorDialog open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />
        <OrderAuditLogDialog open={isAuditLogOpen} onOpenChange={setIsAuditLogOpen} />
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
        <OrderSearchCombobox />

        <CalculatorButton />
        <AuditLogButton />

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
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Cambiar contraseña
            </DropdownMenuItem>
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
      <Dialog
        open={isChangePasswordOpen}
        onOpenChange={(open) => {
          setIsChangePasswordOpen(open);
          if (!open) {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleChangePasswordSubmit}>
            <DialogHeader>
              <DialogTitle>Cambiar contraseña</DialogTitle>
              <DialogDescription>
                Introduce tu contraseña actual y la nueva contraseña que
                deseas usar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="current-password">Contraseña actual</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">
                  Confirmar nueva contraseña
                </Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsChangePasswordOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CurrencyCalculatorDialog open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />
      <OrderAuditLogDialog open={isAuditLogOpen} onOpenChange={setIsAuditLogOpen} />
    </header>
  );
}
