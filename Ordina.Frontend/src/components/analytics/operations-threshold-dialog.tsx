"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import type {
  OperationsMetricsSettings,
  LeadTimeCategoryThreshold,
  OtifThreshold,
  FulfillmentThreshold
} from "@/lib/metrics-thresholds"
import { Clock, CheckCircle2, Flame, Truck, RotateCcw, Save, Loader2 } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentSettings?: OperationsMetricsSettings | null
  onSettingsUpdated: (updated: OperationsMetricsSettings) => void
}

const DEFAULT_SETTINGS: OperationsMetricsSettings = {
  defaultLeadTime: {
    minStandardDays: 5,
    maxStandardDays: 7,
    warningExtraPercentage: 30,
    criticalExtraPercentage: 50
  },
  categoryLeadTimes: {
    Cama: { minStandardDays: 5, maxStandardDays: 7, warningExtraPercentage: 30, criticalExtraPercentage: 50 },
    "Box solo": { minStandardDays: 3, maxStandardDays: 5, warningExtraPercentage: 30, criticalExtraPercentage: 50 },
    Colchones: { minStandardDays: 1, maxStandardDays: 2, warningExtraPercentage: 30, criticalExtraPercentage: 50 },
    Mueble: { minStandardDays: 4, maxStandardDays: 6, warningExtraPercentage: 30, criticalExtraPercentage: 50 },
    "Copete solo": { minStandardDays: 2, maxStandardDays: 4, warningExtraPercentage: 30, criticalExtraPercentage: 50 },
    ComboHogar: { minStandardDays: 5, maxStandardDays: 7, warningExtraPercentage: 30, criticalExtraPercentage: 50 }
  },
  otif: {
    targetPercentage: 95,
    warningPercentage: 90,
    criticalPercentage: 80
  },
  stageMaxStandardDays: {
    "Aprobación / Pago": 2.0,
    "Cola Taller / Fabricación": 7.0,
    "Almacén Central (Terrinca)": 3.0,
    "Ruta y Despacho": 3.0
  },
  fulfillment: {
    targetImmediatePercentage: 60,
    warningImmediatePercentage: 50,
    criticalImmediatePercentage: 40
  }
}

export function OperationsThresholdDialog({ open, onOpenChange, currentSettings, onSettingsUpdated }: Props) {
  const [settings, setSettings] = useState<OperationsMetricsSettings>(currentSettings || DEFAULT_SETTINGS)
  const [selectedCategory, setSelectedCategory] = useState<string>("Cama")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings)
    }
  }, [currentSettings])

  const currentCatThreshold: LeadTimeCategoryThreshold =
    settings.categoryLeadTimes[selectedCategory] || settings.defaultLeadTime

  const handleLeadTimeChange = (field: keyof LeadTimeCategoryThreshold, value: number) => {
    setSettings(prev => ({
      ...prev,
      categoryLeadTimes: {
        ...prev.categoryLeadTimes,
        [selectedCategory]: {
          ...currentCatThreshold,
          [field]: Math.max(0, value)
        }
      }
    }))
  }

  const handleOtifChange = (field: keyof OtifThreshold, value: number) => {
    setSettings(prev => ({
      ...prev,
      otif: {
        ...prev.otif,
        [field]: Math.min(100, Math.max(0, value))
      }
    }))
  }

  const handleStageChange = (stageName: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      stageMaxStandardDays: {
        ...prev.stageMaxStandardDays,
        [stageName]: Math.max(0.1, value)
      }
    }))
  }

  const handleFulfillmentChange = (field: keyof FulfillmentThreshold, value: number) => {
    setSettings(prev => ({
      ...prev,
      fulfillment: {
        ...prev.fulfillment,
        [field]: Math.min(100, Math.max(0, value))
      }
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const updated = await apiClient.updateOperationsMetricsSettings(settings)
      onSettingsUpdated(updated)
      toast.success("Umbrales de métricas guardados con éxito")
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || "Error guardando configuración de umbrales")
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefaults = () => {
    setSettings(DEFAULT_SETTINGS)
    toast.info("Valores restablecidos a predeterminados. Presiona Guardar para confirmar.")
  }

  const warningDays = Number((currentCatThreshold.maxStandardDays * (1 + currentCatThreshold.warningExtraPercentage / 100)).toFixed(1))
  const criticalDays = Number((currentCatThreshold.maxStandardDays * (1 + currentCatThreshold.criticalExtraPercentage / 100)).toFixed(1))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            Configurar Umbrales de Métricas Operativas
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ajusta los rangos estándar y tolerancias para determinar los colores (Verde, Azul, Naranja, Rojo) y disparar alertas semanales.
          </DialogDescription>
        </DialogHeader>

        {/* Dynamic Color Scale Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-muted-foreground">Bajo el estándar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <span className="text-muted-foreground">Rango estándar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-muted-foreground">Advertencia (+30%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="text-muted-foreground">Crítico (+50%)</span>
          </div>
        </div>

        <Tabs defaultValue="leadTime" className="w-full mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="leadTime" className="text-xs flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Lead Time
            </TabsTrigger>
            <TabsTrigger value="otif" className="text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              OTIF
            </TabsTrigger>
            <TabsTrigger value="dwellTime" className="text-xs flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              Etapas
            </TabsTrigger>
            <TabsTrigger value="fulfillment" className="text-xs flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              Stock
            </TabsTrigger>
          </TabsList>

          {/* 1. Lead Time Tab */}
          <TabsContent value="leadTime" className="space-y-4 pt-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.keys(settings.categoryLeadTimes).map(cat => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="cursor-pointer text-xs py-1 px-2.5 transition-colors"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>

            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-3">
              <div className="flex justify-between items-center border-b border-border/40 pb-2">
                <span className="text-xs font-semibold text-foreground">Categoría: {selectedCategory}</span>
                <span className="text-[11px] text-muted-foreground font-mono">Días promedio taller</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mínimo Estándar (días)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={currentCatThreshold.minStandardDays}
                    onChange={e => handleLeadTimeChange("minStandardDays", parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Máximo Estándar (días)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={currentCatThreshold.maxStandardDays}
                    onChange={e => handleLeadTimeChange("maxStandardDays", parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">% Extra Advertencia (Naranja)</Label>
                  <Input
                    type="number"
                    value={currentCatThreshold.warningExtraPercentage}
                    onChange={e => handleLeadTimeChange("warningExtraPercentage", parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">% Extra Crítico (Rojo)</Label>
                  <Input
                    type="number"
                    value={currentCatThreshold.criticalExtraPercentage}
                    onChange={e => handleLeadTimeChange("criticalExtraPercentage", parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Real-time ranges preview */}
              <div className="pt-2 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                  &lt; {currentCatThreshold.minStandardDays} d (Verde)
                </div>
                <div className="p-1.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">
                  {currentCatThreshold.minStandardDays} - {currentCatThreshold.maxStandardDays} d (Azul)
                </div>
                <div className="p-1.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
                  &gt; {currentCatThreshold.maxStandardDays} - {criticalDays} d (Naranja)
                </div>
                <div className="p-1.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono">
                  &gt; {criticalDays} d (Rojo)
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 2. OTIF Tab */}
          <TabsContent value="otif" className="space-y-3 pt-3">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Meta Estándar (Azul / Verde)</Label>
                <Input
                  type="number"
                  value={settings.otif.targetPercentage}
                  onChange={e => handleOtifChange("targetPercentage", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">Por encima de este valor se considera óptimo.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Umbral de Advertencia (Naranja)</Label>
                <Input
                  type="number"
                  value={settings.otif.warningPercentage}
                  onChange={e => handleOtifChange("warningPercentage", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Umbral Crítico (Rojo)</Label>
                <Input
                  type="number"
                  value={settings.otif.criticalPercentage}
                  onChange={e => handleOtifChange("criticalPercentage", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">Por debajo de este valor dispara alerta roja en reporte semanal.</p>
              </div>
            </div>
          </TabsContent>

          {/* 3. Dwell Times Tab */}
          <TabsContent value="dwellTime" className="space-y-3 pt-3">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Días máximos tolerados por etapa antes de considerarse cuello de botella:
              </p>
              {Object.entries(settings.stageMaxStandardDays).map(([stageName, days]) => (
                <div key={stageName} className="flex items-center justify-between gap-4 py-1">
                  <span className="text-xs font-medium text-foreground truncate max-w-[240px]">{stageName}</span>
                  <div className="flex items-center gap-1.5 w-28">
                    <Input
                      type="number"
                      step="0.5"
                      value={days}
                      onChange={e => handleStageChange(stageName, parseFloat(e.target.value) || 1)}
                      className="h-8 text-xs font-mono text-right"
                    />
                    <span className="text-xs text-muted-foreground">d</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 4. Fulfillment Tab */}
          <TabsContent value="fulfillment" className="space-y-3 pt-3">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Meta Despacho Stock Inmediato</Label>
                <Input
                  type="number"
                  value={settings.fulfillment.targetImmediatePercentage}
                  onChange={e => handleFulfillmentChange("targetImmediatePercentage", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Umbral Advertencia (Naranja)</Label>
                <Input
                  type="number"
                  value={settings.fulfillment.warningImmediatePercentage}
                  onChange={e => handleFulfillmentChange("warningImmediatePercentage", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Umbral Crítico (Rojo)</Label>
                <Input
                  type="number"
                  value={settings.fulfillment.criticalImmediatePercentage}
                  onChange={e => handleFulfillmentChange("criticalImmediatePercentage", parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 mt-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs text-muted-foreground flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="text-xs flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar Cambios
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
