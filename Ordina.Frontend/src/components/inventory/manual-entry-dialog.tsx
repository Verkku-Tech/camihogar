"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Hammer, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiClient, type ProductResponseDto } from "@/lib/api-client"
import { getStores, getWarehouses, type Store, type Warehouse } from "@/lib/storage"

interface ManualEntryDialogProps {
  onSuccess?: () => void
}

export function ManualEntryDialog({ onSuccess }: ManualEntryDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [stores, setStores] = useState<Store[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<ProductResponseDto[]>([])

  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [fabric, setFabric] = useState("Lino")
  const [customFabric, setCustomFabric] = useState("")
  const [color, setColor] = useState("Gris")
  const [customColor, setCustomColor] = useState("")
  const [size, setSize] = useState("Matrimonial")
  const [customSize, setCustomSize] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [costUsd, setCostUsd] = useState<number>(0)
  const [priceUsd, setPriceUsd] = useState<number>(0)
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open) {
      const loadInitial = async () => {
        try {
          setLoading(true)
          const [storesData, warehousesData, productsData] = await Promise.all([
            getStores("active"),
            getWarehouses(),
            apiClient.getProducts()
          ])
          setStores(storesData)
          setWarehouses(warehousesData)
          setProducts(productsData.filter(p => p.status !== "inactive"))

          // Default location: first store or central warehouse
          const central = warehousesData.find(w => w.isCentral)
          if (central) {
            setSelectedLocation(`warehouse:${central.id}`)
          } else if (storesData.length > 0) {
            setSelectedLocation(`store:${storesData[0].id}`)
          }
        } catch (err) {
          console.error("Error loading dialog catalogs:", err)
          toast.error("Error al cargar sedes o catálogo")
        } finally {
          setLoading(false)
        }
      }
      loadInitial()
    }
  }, [open])

  // Update suggested price when product changes
  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId)
    const prod = products.find(p => p.id === prodId)
    if (prod) {
      setPriceUsd(prod.price || 0)
    }
  }

  const resetForm = () => {
    setSelectedProductId("")
    setFabric("Lino")
    setCustomFabric("")
    setColor("Gris")
    setCustomColor("")
    setSize("Matrimonial")
    setCustomSize("")
    setQuantity(1)
    setCostUsd(0)
    setPriceUsd(0)
    setNote("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedLocation) {
      toast.error("Seleccione la sede de recepción")
      return
    }
    if (!selectedProductId) {
      toast.error("Seleccione el producto terminado")
      return
    }
    if (quantity <= 0) {
      toast.error("La cantidad debe ser al menos 1")
      return
    }

    const [locationType, locationId] = selectedLocation.split(":")
    const selectedProd = products.find(p => p.id === selectedProductId)

    const finalFabric = fabric === "Otra" ? customFabric.trim() : fabric
    const finalColor = color === "Otro" ? customColor.trim() : color
    const finalSize = size === "Otra" ? customSize.trim() : size

    const attributes: Record<string, string> = {}
    if (finalFabric) attributes["Tela"] = finalFabric
    if (finalColor) attributes["Color"] = finalColor
    if (finalSize) attributes["Medida"] = finalSize

    try {
      setSubmitting(true)
      await apiClient.addManualStock({
        productId: selectedProductId,
        locationType,
        locationId,
        attributes,
        quantity: Number(quantity),
        costUsd: Number(costUsd) || 0,
        priceUsd: Number(priceUsd) || (selectedProd?.price ?? 0),
        note: note.trim() || undefined
      })

      toast.success(`Alta registrada: ${quantity} unid. de ${selectedProd?.name ?? 'artículo'}`)
      resetForm()
      setOpen(false)
      onSuccess?.()
    } catch (err: any) {
      console.error("Error creating manual stock:", err)
      toast.error(err.message || "Error al registrar existencias físicas")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <PlusCircle className="w-4 h-4 mr-2" />
          Alta de Taller / Recepción
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Hammer className="w-5 h-5 text-indigo-600" />
            Registro Rápido de Stock Físico
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando sedes y catálogo...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Sede */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sede de Ingreso / Destino *</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sede física" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={`warehouse:${w.id}`} value={`warehouse:${w.id}`}>
                      🏢 {w.name} {w.isCentral ? "(Central Terrinca)" : "(Almacén)"}
                    </SelectItem>
                  ))}
                  {stores.map((s) => (
                    <SelectItem key={`store:${s.id}`} value={`store:${s.id}`}>
                      🏬 {s.name} (Tienda Exhibición)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Producto */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Producto del Catálogo *</Label>
              <Select value={selectedProductId} onValueChange={handleProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el modelo o mueble" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""} - ${p.price} USD
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Atributos: Tela, Color, Medida */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Tela</Label>
                <Select value={fabric} onValueChange={setFabric}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lino">Lino</SelectItem>
                    <SelectItem value="Terciopelo">Terciopelo</SelectItem>
                    <SelectItem value="Cuero Sintético">Cuero Sintético</SelectItem>
                    <SelectItem value="Chenille">Chenille</SelectItem>
                    <SelectItem value="Microfibra">Microfibra</SelectItem>
                    <SelectItem value="Otra">Otra...</SelectItem>
                  </SelectContent>
                </Select>
                {fabric === "Otra" && (
                  <Input
                    placeholder="Especificar tela"
                    value={customFabric}
                    onChange={e => setCustomFabric(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Color</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gris">Gris</SelectItem>
                    <SelectItem value="Azul">Azul</SelectItem>
                    <SelectItem value="Beige">Beige</SelectItem>
                    <SelectItem value="Negro">Negro</SelectItem>
                    <SelectItem value="Blanco">Blanco</SelectItem>
                    <SelectItem value="Marrón">Marrón</SelectItem>
                    <SelectItem value="Verde">Verde</SelectItem>
                    <SelectItem value="Otro">Otro...</SelectItem>
                  </SelectContent>
                </Select>
                {color === "Otro" && (
                  <Input
                    placeholder="Especificar color"
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Medida / Formato</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Matrimonial">Matrimonial</SelectItem>
                    <SelectItem value="Queen">Queen</SelectItem>
                    <SelectItem value="King">King</SelectItem>
                    <SelectItem value="Estándar">Estándar</SelectItem>
                    <SelectItem value="Otra">Otra...</SelectItem>
                  </SelectContent>
                </Select>
                {size === "Otra" && (
                  <Input
                    placeholder="Especificar medida"
                    value={customSize}
                    onChange={e => setCustomSize(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                )}
              </div>
            </div>

            {/* Cantidades y Costos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Cantidad Ingresada *</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Precio Venta (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={priceUsd}
                  onChange={e => setPriceUsd(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Costo Taller (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={costUsd}
                  onChange={e => setCostUsd(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Nota de lote */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Nota de Recepción / Lote (Opcional)</Label>
              <Input
                placeholder="Ej: Lote taller semana 38, lote Guatire 04"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Registrar Ingreso
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
