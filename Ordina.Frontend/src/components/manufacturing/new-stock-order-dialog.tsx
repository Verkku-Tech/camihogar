"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PlusCircle, Hammer, Loader2, Building2, Warehouse as WarehouseIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { apiClient, type ProductResponseDto, type ProviderResponseDto } from "@/lib/api-client"
import { getStores, getWarehouses, type Store, type Warehouse } from "@/lib/storage"

interface NewStockOrderDialogProps {
  onSuccess?: () => void
  triggerButton?: React.ReactNode
}

export function NewStockOrderDialog({ onSuccess, triggerButton }: NewStockOrderDialogProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [stores, setStores] = useState<Store[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<ProductResponseDto[]>([])
  const [providers, setProviders] = useState<ProviderResponseDto[]>([])

  const [selectedProductId, setSelectedProductId] = useState("")
  const [destinationKey, setDestinationKey] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [requestedBy, setRequestedBy] = useState(user?.name || "")
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const [costUsd, setCostUsd] = useState<number>(0)
  const [notes, setNotes] = useState("")

  // Variant attributes
  const [fabric, setFabric] = useState("Lino")
  const [color, setColor] = useState("Gris")
  const [size, setSize] = useState("Matrimonial")

  useEffect(() => {
    if (open) {
      if (user?.name && !requestedBy) {
        setRequestedBy(user.name)
      }
      const loadCatalogs = async () => {
        try {
          setLoading(true)
          const [storesData, warehousesData, productsData, providersData] = await Promise.all([
            getStores("active"),
            getWarehouses(),
            apiClient.getProducts(),
            apiClient.getProviders()
          ])
          setStores(storesData)
          setWarehouses(warehousesData)
          setProducts(productsData.filter(p => p.status !== "inactive"))
          setProviders(providersData.filter(p => !p.estado || p.estado !== "inactivo"))

          // Default destination: Central warehouse if available
          const central = warehousesData.find(w => w.isCentral)
          if (central) {
            setDestinationKey(`warehouse:${central.id}`)
          } else if (storesData.length > 0) {
            setDestinationKey(`store:${storesData[0].id}`)
          }
        } catch (err) {
          console.error("Error loading catalogs for new stock order:", err)
          toast.error("Error al cargar sedes o catálogo")
        } finally {
          setLoading(false)
        }
      }
      loadCatalogs()
    }
  }, [open, user, requestedBy])

  const selectedProduct = products.find(p => p.id === selectedProductId)

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId)
    const p = products.find(prod => prod.id === prodId)
    if (p && p.price) {
      setCostUsd(p.price)
    }
  }

  const resetForm = () => {
    setSelectedProductId("")
    setQuantity(1)
    setSelectedProviderId("")
    setCostUsd(0)
    setNotes("")
    setFabric("Lino")
    setColor("Gris")
    setSize("Matrimonial")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedProduct) {
      toast.error("Seleccione un producto para fabricar")
      return
    }

    if (!destinationKey) {
      toast.error("Seleccione la sede de destino para el stock")
      return
    }

    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a 0")
      return
    }

    const [destType, destId] = destinationKey.split(":")
    const destName =
      destType === "store"
        ? stores.find(s => s.id === destId)?.name || "Tienda"
        : warehouses.find(w => w.id === destId)?.name || "Almacén"

    const selectedProv = providers.find(p => p.id === selectedProviderId)

    const attributes: Record<string, string> = {
      Tela: fabric,
      Color: color,
      Medida: size
    }

    try {
      setSubmitting(true)
      const res = await apiClient.createManufacturingOrder({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku || "",
        attributes,
        quantity,
        destinationLocationId: destId,
        destinationLocationName: destName,
        destinationLocationType: destType,
        requestedBy: requestedBy || user?.name || "Solicitante",
        providerId: selectedProv?.id,
        providerName: selectedProv?.nombre || selectedProv?.razonSocial || undefined,
        costUsd,
        notes: notes.trim() || undefined
      })

      toast.success(`Orden de fabricación ${res.orderNumber} creada con éxito`)
      resetForm()
      setOpen(false)
      onSuccess?.()
    } catch (err: any) {
      console.error("Error creating manufacturing order:", err)
      toast.error(err.message || "Error al crear orden de fabricación para stock")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button size="sm" className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
            <PlusCircle className="w-4 h-4" />
            <span>Nueva Orden de Stock</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Hammer className="w-5 h-5 text-indigo-600" />
            Nueva Orden de Fabricación para Stock
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs mt-2">Cargando catálogo y sedes...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Info Banner */}
            <div className="rounded border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-2.5 text-[11px] text-indigo-900 dark:text-indigo-300">
              ℹ️ <strong>Stock Interno:</strong> Esta orden se genera con correlativo <code>OF-XXXX</code>, no afecta métricas de ventas comerciales y al completarse ingresará automáticamente al inventario físico de la sede de destino.
            </div>

            {/* Product Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Producto del Catálogo *</Label>
              <Select value={selectedProductId} onValueChange={handleProductChange}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Seleccione el modelo a fabricar..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sede Destino */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sede Destino del Stock *</Label>
              <Select value={destinationKey} onValueChange={setDestinationKey}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Seleccione tienda o almacén de recepción..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" disabled>Seleccione sede...</SelectItem>
                  {warehouses.map(w => (
                    <SelectItem key={`warehouse:${w.id}`} value={`warehouse:${w.id}`} className="text-xs">
                      🏢 Almacén: {w.name} {w.isCentral ? "(Central)" : ""}
                    </SelectItem>
                  ))}
                  {stores.map(s => (
                    <SelectItem key={`store:${s.id}`} value={`store:${s.id}`} className="text-xs">
                      🏬 Tienda: {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Attributes Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Tela</Label>
                <Select value={fabric} onValueChange={setFabric}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lino">Lino</SelectItem>
                    <SelectItem value="Microfibra">Microfibra</SelectItem>
                    <SelectItem value="Cuero Sintético">Cuero Sintético</SelectItem>
                    <SelectItem value="Terciopelo">Terciopelo</SelectItem>
                    <SelectItem value="Pana">Pana</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Color</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gris">Gris</SelectItem>
                    <SelectItem value="Beige">Beige</SelectItem>
                    <SelectItem value="Azul">Azul</SelectItem>
                    <SelectItem value="Negro">Negro</SelectItem>
                    <SelectItem value="Verde">Verde</SelectItem>
                    <SelectItem value="Mostaza">Mostaza</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium">Medida</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Matrimonial">Matrimonial</SelectItem>
                    <SelectItem value="Queen">Queen</SelectItem>
                    <SelectItem value="King">King</SelectItem>
                    <SelectItem value="Estándar">Estándar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantity and Estimated Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cantidad a Fabricar *</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Costo Est. Taller (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={costUsd || ""}
                  onChange={e => setCostUsd(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Solicitante and Provider */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Solicitante *</Label>
                <Input
                  value={requestedBy}
                  onChange={e => setRequestedBy(e.target.value)}
                  placeholder="Nombre del solicitante"
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Taller / Fabricante</Label>
                <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Seleccione taller..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin taller asignado aún</SelectItem>
                    {providers.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.nombre || p.razonSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Instrucciones / Observaciones de Taller</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Especificaciones técnicas, reposición de tope de tienda..."
                className="text-xs resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={submitting || !selectedProductId || !destinationKey}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Crear Orden de Stock
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
