"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  SlidersHorizontal,
  Search,
  Package,
  Layers,
  AlertTriangle,
  Minus,
  Plus,
  Save,
  RotateCcw
} from "lucide-react"
import { toast } from "sonner"
import {
  getProducts,
  getCategories,
  updateStoreDisplayLimits,
  type Store,
  type Product,
  type Category
} from "@/lib/storage"
import { apiClient, type PhysicalStockDto } from "@/lib/api-client"

interface StoreProductLimitsEditorProps {
  store: Store
  onSaved?: (updatedStore: Store) => void
  onClose?: () => void
}

export function StoreProductLimitsEditor({ store, onSaved, onClose }: StoreProductLimitsEditorProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stockList, setStockList] = useState<PhysicalStockDto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Local limits dictionary { [productKey: string]: number }
  const [limits, setLimits] = useState<Record<string, number>>({})

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [onlyConfigured, setOnlyConfigured] = useState(false)

  const getProductKey = (p: Product): string => {
    return p.backendId || String(p.id)
  }

  useEffect(() => {
    // Initialize limits from store
    setLimits(store.productDisplayLimits || {})

    const loadData = async () => {
      try {
        setLoading(true)
        const [prods, cats, stocks] = await Promise.all([
          getProducts(),
          getCategories(),
          apiClient.getStockList().catch(() => [])
        ])
        setProducts(prods.filter(p => p.status === "active"))
        setCategories(cats)
        setStockList(stocks)
      } catch (err) {
        console.error("Error loading products for store limits:", err)
        toast.error("Error al cargar productos para topes de exhibición")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [store])

  // Stock maps by productId and sku for this store and for Terrinca
  const stockByProduct = useMemo(() => {
    const storeMap = new Map<string, number>()
    const terrincaMap = new Map<string, number>()

    stockList.forEach(item => {
      if (item.locationId === store.id) {
        if (item.productId) storeMap.set(item.productId, (storeMap.get(item.productId) || 0) + item.availableQuantity)
        if (item.sku) storeMap.set(item.sku, (storeMap.get(item.sku) || 0) + item.availableQuantity)
      }
      if (item.locationType === "warehouse") {
        if (item.productId) terrincaMap.set(item.productId, (terrincaMap.get(item.productId) || 0) + item.availableQuantity)
        if (item.sku) terrincaMap.set(item.sku, (terrincaMap.get(item.sku) || 0) + item.availableQuantity)
      }
    })

    return { storeMap, terrincaMap }
  }, [stockList, store.id])

  // Total allocated pieces vs store showroom capacity
  const totalAllocated = useMemo(() => {
    return Object.values(limits).reduce((acc, val) => acc + (Number(val) || 0), 0)
  }, [limits])

  const showroomCapacity = store.maxCapacity ?? 25
  const isOverCapacity = totalAllocated > showroomCapacity

  // Handlers for limit change
  const handleLimitChange = (key: string, value: number) => {
    const sanitized = Math.max(0, isNaN(value) ? 0 : Math.floor(value))
    setLimits(prev => {
      const next = { ...prev }
      if (sanitized === 0) {
        delete next[key]
      } else {
        next[key] = sanitized
      }
      return next
    })
  }

  const handleIncrement = (key: string) => {
    const current = limits[key] || 0
    handleLimitChange(key, current + 1)
  }

  const handleDecrement = (key: string) => {
    const current = limits[key] || 0
    if (current > 0) {
      handleLimitChange(key, current - 1)
    }
  }

  const handleReset = () => {
    if (confirm("¿Desea restablecer todos los topes de exhibición a cero para esta tienda?")) {
      setLimits({})
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const updated = await updateStoreDisplayLimits(store.id, limits)
      toast.success(`Topes de exhibición guardados para ${store.name}`)
      if (onSaved) onSaved(updated)
      if (onClose) onClose()
    } catch (err) {
      console.error("Error saving display limits:", err)
      toast.error("Error al guardar los topes de exhibición")
    } finally {
      setSaving(false)
    }
  }

  // Filtered product list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const key = getProductKey(p)
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCat =
        selectedCategory === "all" ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase())

      const limitVal = limits[key] || (p.sku ? limits[p.sku] : 0) || 0
      const matchesConfigured = !onlyConfigured || limitVal > 0

      return matchesSearch && matchesCat && matchesConfigured
    })
  }, [products, searchTerm, selectedCategory, onlyConfigured, limits])

  return (
    <div className="space-y-4">
      {/* Showroom Capacity Indicator Bar */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isOverCapacity
          ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
          : "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200/60 dark:border-indigo-800/50"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isOverCapacity ? "bg-amber-500 text-white" : "bg-indigo-600 text-white"}`}>
            {isOverCapacity ? <AlertTriangle className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <span>Capacidad Showroom: {showroomCapacity} piezas</span>
              <span className="text-muted-foreground font-normal">|</span>
              <span className={`font-mono ${isOverCapacity ? "text-amber-600 dark:text-amber-400 font-bold" : "text-indigo-600 dark:text-indigo-400"}`}>
                Asignado en topes: {totalAllocated} piezas
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isOverCapacity
                ? `Alerta: La suma de los topes (${totalAllocated}) supera el límite de espacio físico de piso (${showroomCapacity}).`
                : `Espacio disponible en showroom: ${Math.max(0, showroomCapacity - totalAllocated)} piezas restantes.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Limpiar Topes
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs font-semibold shadow-sm"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Guardando..." : "Guardar Topes"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mueble por nombre o SKU..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map(c => (
              <SelectItem key={String(c.id)} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 cursor-pointer text-xs select-none shrink-0 border px-3 py-2 rounded-md bg-muted/30">
          <input
            type="checkbox"
            checked={onlyConfigured}
            onChange={e => setOnlyConfigured(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
          />
          <span>Solo con tope (&gt; 0)</span>
        </label>
      </div>

      {/* Products Table */}
      <div className="border rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
        {loading ? (
          <div className="text-center py-12 text-xs text-muted-foreground">Cargando catálogo de muebles...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-10 px-4 space-y-2">
            <Package className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <div className="text-xs font-medium">No se encontraron muebles</div>
            <p className="text-[11px] text-muted-foreground">Ajuste los filtros o agregue nuevos productos al catálogo.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow>
                <TableHead className="text-xs">Producto / Modelo</TableHead>
                <TableHead className="text-xs">Categoría</TableHead>
                <TableHead className="text-xs text-center">En Tienda</TableHead>
                <TableHead className="text-xs text-center">En Terrinca</TableHead>
                <TableHead className="text-xs text-right pr-6">Tope de Exhibición</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(p => {
                const key = getProductKey(p)
                const currentInStore =
                  (p.backendId && stockByProduct.storeMap.get(p.backendId)) ||
                  (p.sku && stockByProduct.storeMap.get(p.sku)) ||
                  stockByProduct.storeMap.get(String(p.id)) ||
                  0

                const currentInTerrinca =
                  (p.backendId && stockByProduct.terrincaMap.get(p.backendId)) ||
                  (p.sku && stockByProduct.terrincaMap.get(p.sku)) ||
                  stockByProduct.terrincaMap.get(String(p.id)) ||
                  0

                const limitVal = limits[key] || (p.sku ? limits[p.sku] : 0) || 0

                return (
                  <TableRow key={key} className={limitVal > 0 ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""}>
                    <TableCell className="py-2.5">
                      <div className="font-medium text-xs text-foreground">{p.name}</div>
                      {p.sku && <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>}
                    </TableCell>

                    <TableCell className="py-2.5">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {p.category || "General"}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-2.5 text-center">
                      <Badge
                        variant={currentInStore > 0 ? "default" : "outline"}
                        className={`text-[10px] ${currentInStore > 0 ? "bg-emerald-600 text-white" : "text-muted-foreground"}`}
                      >
                        {currentInStore} unid.
                      </Badge>
                    </TableCell>

                    <TableCell className="py-2.5 text-center">
                      <span className="text-xs text-muted-foreground font-mono">
                        {currentInTerrinca} unid.
                      </span>
                    </TableCell>

                    <TableCell className="py-2.5 text-right pr-4">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleDecrement(key)}
                          disabled={limitVal === 0}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>

                        <Input
                          type="number"
                          min="0"
                          value={limitVal === 0 ? "" : limitVal}
                          placeholder="0"
                          onChange={e => handleLimitChange(key, parseInt(e.target.value) || 0)}
                          className={`w-14 h-7 text-center font-bold text-xs ${
                            limitVal > 0 ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5" : ""
                          }`}
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleIncrement(key)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

interface StoreProductLimitsDialogProps {
  store: Store | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (updatedStore: Store) => void
}

export function StoreProductLimitsDialog({ store, open, onOpenChange, onSaved }: StoreProductLimitsDialogProps) {
  if (!store) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
            Topes de Exhibición - {store.name} ({store.code})
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure la cantidad máxima de piezas de cada mueble que pueden exhibirse en esta sede. Estos topes alimentan el cálculo automático de reposición desde Depósito Central Terrinca.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <StoreProductLimitsEditor
            store={store}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
