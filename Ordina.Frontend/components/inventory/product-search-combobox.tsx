"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Package, Search, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { apiClient, type ProductListItemDto } from "@/lib/api-client"
import { type Product } from "@/lib/storage"
import { formatCurrency } from "@/lib/currency-utils"

interface ProductSearchComboboxProps {
  value?: Product | null
  onSelect: (product: Product | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  excludedProductIds?: number[]
}

function listItemToProduct(item: ProductListItemDto): Product {
  return {
    id: parseInt(item.id) || 0,
    name: item.name,
    category: item.category,
    price: item.price,
    priceCurrency: item.priceCurrency as any,
    stock: item.stock,
    status: item.status,
    sku: item.sku,
  }
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
  const [results, setResults] = useState<ProductListItemDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (value) {
      setSearchTerm(value.name)
      setShowResults(false)
    } else {
      setSearchTerm("")
    }
  }, [value])

  const doSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([])
      return
    }
    setIsLoading(true)
    try {
      const items = await apiClient.searchProducts(term, 20)
      setResults(items)
    } catch (error) {
      console.error("Error searching products:", error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchTerm(newValue)
    setShowResults(true)

    if (!newValue.trim()) {
      onSelect(null)
      setResults([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(newValue), 300)
  }

  const filteredResults = results.filter(
    (item) => !excludedProductIds.includes(parseInt(item.id) || 0)
  )

  const handleSelect = (item: ProductListItemDto) => {
    onSelect(listItemToProduct(item))
    setShowResults(false)
  }

  const handleClear = () => {
    setSearchTerm("")
    onSelect(null)
    setResults([])
    setShowResults(false)
    inputRef.current?.focus()
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    if (showResults) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showResults])

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            if (searchTerm.trim().length >= 2) {
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

      {showResults && searchTerm.trim().length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-popover border rounded-lg shadow-lg max-h-[400px] overflow-y-auto min-w-[450px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-base">Buscando...</span>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-8 text-center text-base text-muted-foreground">
              No se encontraron productos con ese criterio.
            </div>
          ) : (
            <div className="p-2">
              {filteredResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex items-center justify-between gap-4 p-3 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-b-0",
                    value?.id === (parseInt(item.id) || 0) && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Package className="h-6 w-6 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="flex flex-col flex-1 min-w-0 gap-1">
                      <span className="font-semibold text-base truncate">{item.name}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>SKU: {item.sku}</span>
                        <span>&bull;</span>
                        <span className="truncate">{item.category}</span>
                        {item.stock !== undefined && (
                          <>
                            <span>&bull;</span>
                            <span>Stock: {item.stock}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-semibold">
                      {formatCurrency(item.price, (item.priceCurrency as any) || "Bs")}
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
