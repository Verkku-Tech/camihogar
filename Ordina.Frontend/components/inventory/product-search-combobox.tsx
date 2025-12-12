"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { Package, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { getProducts, type Product } from "@/lib/storage"
import { formatCurrency } from "@/lib/currency-utils"

interface ProductSearchComboboxProps {
  value?: Product | null
  onSelect: (product: Product | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  excludedProductIds?: number[]
}

export function ProductSearchCombobox({
  value,
  onSelect,
  placeholder = "Buscar producto...",
  disabled = false,
  className,
  excludedProductIds = [],
}: ProductSearchComboboxProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cargar productos al montar
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true)
        const loadedProducts = await getProducts()
        const activeProducts = loadedProducts.filter(
          (p) => p.status === "Disponible" || p.status === "active"
        )
        setProducts(activeProducts)
      } catch (error) {
        console.error("Error loading products:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadProducts()
  }, [])

  // Mostrar el producto seleccionado en el input
  useEffect(() => {
    if (value) {
      setSearchTerm(value.name)
      setShowResults(false)
    } else {
      setSearchTerm("")
    }
  }, [value])

  // Filtrar productos excluidos
  const availableProducts = useMemo(() => {
    return products.filter((product) => {
      return !excludedProductIds.includes(product.id)
    })
  }, [products, excludedProductIds])

  // Filtrar por término de búsqueda
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return []
    }
    
    const search = searchTerm.toLowerCase().trim()
    return availableProducts.filter((product) => {
      return (
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search)
      )
    })
  }, [availableProducts, searchTerm])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchTerm(newValue)
    setShowResults(true)
    
    // Si se limpia el input, limpiar la selección
    if (!newValue.trim()) {
      onSelect(null)
    }
  }

  const handleSelect = (product: Product) => {
    onSelect(product)
    setShowResults(false)
  }

  const handleClear = () => {
    setSearchTerm("")
    onSelect(null)
    setShowResults(false)
    inputRef.current?.focus()
  }

  // Cerrar resultados al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    if (showResults) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [showResults])

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Input de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            if (searchTerm.trim()) {
              setShowResults(true)
            }
          }}
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista de resultados */}
      {showResults && searchTerm.trim() && (
        <div className="absolute z-50 w-full mt-2 bg-popover border rounded-lg shadow-lg max-h-[400px] overflow-y-auto min-w-[450px]">
          {isLoading ? (
            <div className="py-8 text-center text-base text-muted-foreground">
              Cargando productos...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-8 text-center text-base text-muted-foreground">
              No se encontraron productos con ese criterio.
            </div>
          ) : (
            <div className="p-2">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className={cn(
                    "flex items-center justify-between gap-4 p-3 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-b-0",
                    value?.id === product.id && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Package className="h-6 w-6 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="flex flex-col flex-1 min-w-0 gap-1">
                      <span className="font-semibold text-base truncate">{product.name}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>SKU: {product.sku}</span>
                        <span>•</span>
                        <span className="truncate">{product.category}</span>
                        {product.stock !== undefined && (
                          <>
                            <span>•</span>
                            <span>Stock: {product.stock}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-semibold">
                      {formatCurrency(product.price, product.priceCurrency || "Bs")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}