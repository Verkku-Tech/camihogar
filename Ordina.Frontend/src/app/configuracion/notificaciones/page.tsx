"use client"

import React, { useState, useEffect } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { apiClient, type NotificationRuleSettings } from "@/lib/api-client"
import {
  BellRing,
  Calendar,
  Clock,
  Shield,
  Volume2,
  Save,
  Send,
  Loader2,
  AlertTriangle,
  Flame,
  KeyRound,
  RefreshCw,
  DollarSign
} from "lucide-react"

const DEFAULT_SETTINGS: NotificationRuleSettings = {
  biAlertsEnabled: true,
  biFrequency: "Weekly",
  biDayOfWeek: 1, // 1 = Monday
  biHourOfDay: 9,
  biMinuteOfHour: 0,
  biTargetRoles: ["Administrator", "Super Administrator"],
  manufacturingDelayEnabled: true,
  manufacturingDelayDays: 25,
  reservationExpiringEnabled: true,
  reservationExpiringDays: 30,
  emergencyPinUsedEnabled: true,
  exchangeRateChangedEnabled: true,
  syncConflictEnabled: true,
  soundEnabled: true
}

const AVAILABLE_ROLES = ["Administrator", "Super Administrator", "Supervisor", "Seller", "Vendedor"]

export default function ConfiguracionNotificacionesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settings, setSettings] = useState<NotificationRuleSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    let isMounted = true
    apiClient.getNotificationSettings()
      .then(res => {
        if (isMounted && res) {
          setSettings(res)
        }
      })
      .catch(() => {
        toast.error("No se pudo cargar la configuración del servidor; mostrando valores actuales.")
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => { isMounted = false }
  }, [])

  const handleToggleRole = (role: string) => {
    setSettings(prev => {
      const current = prev.biTargetRoles || []
      const exists = current.includes(role)
      const next = exists ? current.filter(r => r !== role) : [...current, role]
      return { ...prev, biTargetRoles: next }
    })
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const updated = await apiClient.updateNotificationSettings(settings)
      setSettings(updated)
      toast.success("Configuración de notificaciones guardada con éxito")
    } catch (err: any) {
      toast.error(err?.message || "Error guardando configuración de notificaciones")
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestAlert = async () => {
    try {
      setIsTesting(true)
      await apiClient.testNotificationAlert()
      toast.success("Alerta de prueba enviada exitosamente a los roles administradores")
    } catch (err: any) {
      toast.error(err?.message || "Error al disparar alerta de prueba")
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="flex h-full bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6 space-y-6">
          <AppBreadcrumb />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <BellRing className="w-6 h-6 text-primary" />
                Configuración de Notificaciones
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Administre las alertas automáticas de métricas operativas de BI, avisos de producción y canales de comunicación.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAlert}
                disabled={isTesting}
                className="text-xs flex items-center gap-1.5"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Alerta de Prueba
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar Cambios
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="h-64 rounded-xl bg-muted/40 animate-pulse flex items-center justify-center text-xs text-muted-foreground">
              Cargando reglas de notificaciones...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* 1. Alertas Periódicas de BI & Operaciones */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">Reporte Periódico de Métricas BI</CardTitle>
                        <CardDescription className="text-xs">
                          Despacho automático cuando se detectan métricas en rango naranja o rojo.
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={settings.biAlertsEnabled}
                      onCheckedChange={checked => setSettings(prev => ({ ...prev, biAlertsEnabled: checked }))}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Frecuencia</Label>
                      <Select
                        value={settings.biFrequency}
                        onValueChange={val => setSettings(prev => ({ ...prev, biFrequency: val }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccione frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Weekly">Semanalmente</SelectItem>
                          <SelectItem value="Daily">Diariamente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Día de la semana</Label>
                      <Select
                        value={settings.biDayOfWeek.toString()}
                        onValueChange={val => setSettings(prev => ({ ...prev, biDayOfWeek: parseInt(val, 10) }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccione día" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Lunes (Predeterminado)</SelectItem>
                          <SelectItem value="2">Martes</SelectItem>
                          <SelectItem value="3">Miércoles</SelectItem>
                          <SelectItem value="4">Jueves</SelectItem>
                          <SelectItem value="5">Viernes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      Hora de Envío (Hora Local Venezuela UTC-4)
                    </Label>
                    <Select
                      value={settings.biHourOfDay.toString()}
                      onValueChange={val => setSettings(prev => ({ ...prev, biHourOfDay: parseInt(val, 10) }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccione hora" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">07:00 AM</SelectItem>
                        <SelectItem value="8">08:00 AM</SelectItem>
                        <SelectItem value="9">09:00 AM (Predeterminado)</SelectItem>
                        <SelectItem value="10">10:00 AM</SelectItem>
                        <SelectItem value="11">11:00 AM</SelectItem>
                        <SelectItem value="14">02:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <Label className="text-xs text-muted-foreground">Roles Destinatarios</Label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {AVAILABLE_ROLES.map(role => {
                        const isSelected = settings.biTargetRoles?.includes(role)
                        return (
                          <Badge
                            key={role}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer text-[11px] py-0.5 px-2"
                            onClick={() => handleToggleRole(role)}
                          >
                            {role}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Reglas Operativas de Pedidos y Fabricación */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Reglas Operativas y de Pedidos</CardTitle>
                      <CardDescription className="text-xs">
                        Ajuste de tiempos de tolerancia antes de emitir alertas de retraso.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">

                  {/* Manufacturing Delay */}
                  <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Retraso en Fabricación (Taller)</span>
                      <Switch
                        checked={settings.manufacturingDelayEnabled}
                        onCheckedChange={checked => setSettings(prev => ({ ...prev, manufacturingDelayEnabled: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground text-[11px]">Días en taller sin cambio de estatus:</span>
                      <div className="flex items-center gap-1.5 w-24">
                        <Input
                          type="number"
                          value={settings.manufacturingDelayDays}
                          onChange={e => setSettings(prev => ({ ...prev, manufacturingDelayDays: parseInt(e.target.value, 10) || 25 }))}
                          className="h-7 text-xs font-mono text-right"
                        />
                        <span className="text-muted-foreground text-[11px]">días</span>
                      </div>
                    </div>
                  </div>

                  {/* Expired Reservations */}
                  <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Expiración de Reservas (Repesca)</span>
                      <Switch
                        checked={settings.reservationExpiringEnabled}
                        onCheckedChange={checked => setSettings(prev => ({ ...prev, reservationExpiringEnabled: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground text-[11px]">Días sin concretar la venta:</span>
                      <div className="flex items-center gap-1.5 w-24">
                        <Input
                          type="number"
                          value={settings.reservationExpiringDays}
                          onChange={e => setSettings(prev => ({ ...prev, reservationExpiringDays: parseInt(e.target.value, 10) || 30 }))}
                          className="h-7 text-xs font-mono text-right"
                        />
                        <span className="text-muted-foreground text-[11px]">días</span>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>

              {/* 3. Seguridad y Sistema */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Seguridad, Finanzas y Sistema</CardTitle>
                      <CardDescription className="text-xs">
                        Active o desactive avisos para eventos críticos de la aplicación.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                        Uso de PIN de Emergencia
                      </div>
                      <p className="text-[11px] text-muted-foreground">Notificar cuando un usuario use un PIN de acceso de emergencia.</p>
                    </div>
                    <Switch
                      checked={settings.emergencyPinUsedEnabled}
                      onCheckedChange={checked => setSettings(prev => ({ ...prev, emergencyPinUsedEnabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-b border-border/30">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                        Cambio de Tasa de Cambio (BCV / USD)
                      </div>
                      <p className="text-[11px] text-muted-foreground">Aviso informativo general cuando se actualice la tasa.</p>
                    </div>
                    <Switch
                      checked={settings.exchangeRateChangedEnabled}
                      onCheckedChange={checked => setSettings(prev => ({ ...prev, exchangeRateChangedEnabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                        Conflicto de Sincronización Offline
                      </div>
                      <p className="text-[11px] text-muted-foreground">Alerta en caso de errores de concurrencia 409 al sincronizar pedidos.</p>
                    </div>
                    <Switch
                      checked={settings.syncConflictEnabled}
                      onCheckedChange={checked => setSettings(prev => ({ ...prev, syncConflictEnabled: checked }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 4. Preferencias Generales */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">Preferencias Generales</CardTitle>
                      <CardDescription className="text-xs">
                        Configuración de sonido y notificaciones en navegador.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1.5">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground">Alertas Sonoras en Navegador</div>
                      <p className="text-[11px] text-muted-foreground">Emitir un sonido audible al recibir una notificación en tiempo real.</p>
                    </div>
                    <Switch
                      checked={settings.soundEnabled}
                      onCheckedChange={checked => setSettings(prev => ({ ...prev, soundEnabled: checked }))}
                    />
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}
