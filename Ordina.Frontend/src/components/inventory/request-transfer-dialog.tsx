"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftRight, Truck, Loader2, Building2, Warehouse as WarehouseIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { apiClient, type PhysicalStockDto } from "@/lib/api-client"
import { getStores, getWarehouses, type Store, type Warehouse } from "@/lib/storage"

interface RequestTransferDialogProps {
  initialItem?: PhysicalStockDto
  triggerButton?: React.ReactNode
  onSuccess?: () => void
}

export function RequestTransferDialog({ initialItem, triggerButton, onSuccess }: RequestTransferDialogProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [stores, setStores] = useState<Store[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stockList, setStockList] = useState<PhysicalStockDto[]>([])

  const [selectedStockId, setSelectedStockId] = useState<string>(initialItem?.id || "")
  const [destinationKey, setDestinationKey] = useState<string>("")
  const [quantity, setQuantity] = useState<number>(1)
  const [reasonCategory, setReasonCategory] = useState<string>("Reposición de tope de exhibición")
  const [customReason, setCustomReason] = useState<string>("")

  const activeItem = initialItem || stockList.find(s => s.id === selectedStockId)

  useEffect(() => {
    if (initialItem) {
      setSelectedStockId(initialItem.id)
    }
  }, [initialItem])

  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          setLoadingCatalogs(true)
          const [storesData, warehousesData, stocks] = await Promise.all([
            getStores("active"),
            getWarehouses(),
            initialItem ? Promise.resolve([]) : apiClient.getStockList()
          ])
          setStores(storesData)
          setWarehouses(warehousesData)
          if (!initialItem) {
            setStockList(stocks.filter(s => s.availableQuantity > 0))
          }
        } catch (err) {
          console.error("Error loading transfer catalogs:", err)
          toast.error("Error al cargar sedes para el traslado")
        } finally {
          setLoadingCatalogs(false)
        }
      }
      load()
    }
  }, [open, initialItem])

  const maxAvailable = activeItem ? activeItem.availableQuantity : 1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeItem) {
      toast.error("Seleccione un artículo con stock disponible")
      return
    }

    if (!destinationKey) {
      toast.error("Seleccione la sede de destino")
      return
    }

    if (quantity <= 0 || quantity > maxAvailable) {
      toast.error(`La cantidad debe ser entre 1 y ${maxAvailable}`)
      return
    }

    const [destType, destId] = destinationKey.split(":")
    const destName =
      destType === "store"
        ? stores.find(s => s.id === destId)?.name || "Tienda"
        : warehouses.find(w => w.id === destId)?.name || "Almacén"

    const finalReason = reasonCategory === "Otro" ? customReason : reasonCategory

    try {
      setSubmitting(true)
      await apiClient.createStockTransfer({
        stockId: activeItem.id,
        destinationLocationId: destId,
        destinationLocationName: destName,
        destinationLocationType: destType,
        quantity,
        requestedBy: user?.name || "Operador",
        reason: finalReason
      })

      toast.success(`Traslado solicitado con éxito para ${quantity} unid. a ${destName}`)
      setOpen(false)
      onSuccess?.()
    } catch (err: any) {
      console.error("Error creating transfer:", err)
      toast.error(err.message || "Error al solicitar el traslado")
    } finally {
      setSubmitting(false)
    }
  }

  // Filter destination locations so the user cannot select the origin location
  const availableDestinations = [
    ...stores
      .filter(s => s.id !== activeItem?.locationId)
      .map(s => ({ key: `store:${s.id}`, name: `${s.name} (Tienda)`, type: "store" })),
    ...warehouses
      .filter(w => w.id !== activeItem?.locationId)
      .map(w => ({ key: `warehouse:${w.id}`, name: `${w.name} (Almacén)`, type: "warehouse" }))
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-dashed border-indigo-300 dark:border-indigo-700">
            <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
            <span>Solicitar Traslado</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Truck className="w-5 h-5 text-indigo-600" />
            Solicitar Traslado de Mercancía
          </DialogTitle>
        </DialogHeader>

        {loadingCatalogs ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs mt-2">Cargando catálogo y sedes...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* If no initial item, let the user select from available stock */}
            {!initialItem && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Producto / Existencia de Origen *</Label>
                <Select value={selectedStockId} onValueChange={setSelectedStockId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Seleccione producto con stock disponible..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {stockList.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.productName} ({s.locationName}) - Disp: {s.availableQuantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Origin Information Card */}
            {activeItem && (
              <div className="rounded-lg border border-border/70 p-3 bg-muted/30 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-sm">{activeItem.productName}</span>
                  <span className="text-emerald-600 font-semibold">{activeItem.availableQuantity} disponibles</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Origen:</span>
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    {activeItem.locationType === "warehouse" ? (
                      <WarehouseIcon className="w-3.5 h-3.5 text-indigo-500" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    {activeItem.locationName}
                  </span>
                </div>
                {activeItem.sku && (
                  <p className="text-[11px] text-muted-foreground">SKU: {activeItem.sku}</p>
                )}
              </div>
            )}

            {/* Destination Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sede de Destino *</Label>
              <Select value={destinationKey} onValueChange={setDestinationKey}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Seleccione sede de recepción..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinations.map(d => (
                    <SelectItem key={d.key} value={d.key} className="text-xs">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold">Cantidad a Trasladar *</Label>
                <span className="text-[11px] text-muted-foreground">
                  Máximo disponible: {maxAvailable} unid.
                </span>
              </div>
              <Input
                type="number"
                min={1}
                max={maxAvailable}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Math.min(maxAvailable, parseInt(e.target.value) || 1)))}
                className="text-xs"
              />
            </div>

            {/* Motivo del Traslado */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo del Traslado</Label>
              <Select value={reasonCategory} onValueChange={setReasonCategory}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reposición de tope de exhibición">Reposición de tope de exhibición</SelectItem>
                  <SelectItem value="Traspaso por venta urgente">Traspaso por venta urgente</SelectItem>
                  <SelectItem value="Reorganización física de almacenes">Reorganización física de almacenes</SelectItem>
                  <SelectItem value="Devolución o reenvío a taller">Devolución o reenvío a taller</SelectItem>
                  <SelectItem value="Otro">Otro motivo personalizado</SelectItem>
                </SelectContent>
              </Select>
              {reasonCategory === "Otro" && (
                <Input
                  placeholder="Especifique el motivo..."
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  className="text-xs mt-1.5"
                />
              )}
            </div>

            <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
              💡 <strong>Regla Operativa:</strong> Al solicitar el traslado, las unidades se apartan inmediatamente como <em>en tránsito</em> en el origen, evitando sobreventas. Se acreditarán al destino una vez confirmada la recepción física.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={submitting || !activeItem || !destinationKey}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Confirmar Solicitud
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
