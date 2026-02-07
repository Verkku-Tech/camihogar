"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  User,
  Package,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  AlertCircle,
} from "lucide-react"
import {
  getBudgetByNumber,
  getClient,
  type Budget,
  type Client,
  getCategories,
  getProducts,
  type Product,
  type Category,
  type OrderProduct,
} from "@/lib/storage"
import { formatCurrency, type ExchangeRate } from "@/lib/currency-utils"
import { useCurrency } from "@/contexts/currency-context"
import type { AttributeValue } from "@/lib/storage"
import { getAll } from "@/lib/indexeddb"

// Función helper para formatear moneda siempre en USD como principal, Bs como secundario
const formatCurrencyWithUsdPrimary = (
  amountInBs: number,
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } }
): { primary: string; secondary?: string } => {
  // Intentar convertir a USD si hay tasa disponible
  const usdRate = exchangeRates?.USD?.rate
  
  if (usdRate && usdRate > 0) {
    const amountInUsd = amountInBs / usdRate
    return {
      primary: formatCurrency(amountInUsd, "USD"),
      secondary: formatCurrency(amountInBs, "Bs"),
    }
  }
  
  // Si no hay tasa USD, mostrar solo en Bs
  return {
    primary: formatCurrency(amountInBs, "Bs"),
  }
}

// Componente para renderizar moneda con formato USD principal / Bs secundario
const CurrencyDisplay = ({ 
  amountInBs, 
  exchangeRates,
  className = "",
  inline = false
}: { 
  amountInBs: number
  exchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } }
  className?: string
  inline?: boolean
}) => {
  const formatted = formatCurrencyWithUsdPrimary(amountInBs, exchangeRates)
  
  if (inline) {
    return (
      <span className={className}>
        <span className="font-medium">{formatted.primary}</span>
        {formatted.secondary && (
          <span className="text-xs text-muted-foreground ml-1">
            ({formatted.secondary})
          </span>
        )}
      </span>
    )
  }
  
  return (
    <div className={`text-right ${className}`}>
      <div className="font-medium">
        {formatted.primary}
      </div>
      {formatted.secondary && (
        <div className="text-xs text-muted-foreground">
          {formatted.secondary}
        </div>
      )}
    </div>
  )
}

// Helper para renderizar un valor formateado (objeto con primary/secondary)
const FormattedCurrencyDisplay = ({
  formatted,
  className = "",
  inline = false
}: {
  formatted: { primary: string; secondary?: string }
  className?: string
  inline?: boolean
}) => {
  if (inline) {
    return (
      <span className={className}>
        <span className="font-medium">{formatted.primary}</span>
        {formatted.secondary && (
          <span className="text-xs text-muted-foreground ml-1">
            ({formatted.secondary})
          </span>
        )}
      </span>
    )
  }
  
  return (
    <div className={`text-right ${className}`}>
      <div className="font-medium">
        {formatted.primary}
      </div>
      {formatted.secondary && (
        <div className="text-xs text-muted-foreground">
          {formatted.secondary}
        </div>
      )}
    </div>
  )
}

function getStatusColor(status: string) {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300"
    case "Aprobado":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "Rechazado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    case "Vencido":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    case "Convertido":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

// Helper para obtener el label de un valor de atributo
const getAttributeValueLabel = (
  selectedValue: any,
  categoryAttribute: Category["attributes"][0] | undefined
): string => {
  if (!categoryAttribute) {
    return String(selectedValue)
  }

  if (categoryAttribute.valueType === "Number") {
    return selectedValue !== undefined && selectedValue !== null && selectedValue !== ""
      ? selectedValue.toString()
      : ""
  }

  if (!categoryAttribute.values || categoryAttribute.values.length === 0) {
    return String(selectedValue)
  }

  const getValueLabel = (value: string | AttributeValue): string => {
    if (typeof value === "string") return value
    return value.label || value.id || String(value)
  }

  if (Array.isArray(selectedValue)) {
    const labels: string[] = []
    selectedValue.forEach((valStr) => {
      const attributeValue = categoryAttribute.values!.find(
        (val: string | AttributeValue) => {
          if (typeof val === "string") {
            return val === valStr
          }
          return val.id === valStr || val.label === valStr
        }
      )
      if (attributeValue) {
        labels.push(getValueLabel(attributeValue))
      } else {
        labels.push(String(valStr))
      }
    })
    return labels.join(", ")
  } else {
    const selectedValueStr = selectedValue?.toString()
    if (selectedValueStr) {
      const attributeValue = categoryAttribute.values.find(
        (val: string | AttributeValue) => {
          if (typeof val === "string") {
            return val === selectedValueStr
          }
          return val.id === selectedValueStr || val.label === selectedValueStr
        }
      )
      if (attributeValue) {
        return getValueLabel(attributeValue)
      }
    }
    return String(selectedValue)
  }
}

export default function BudgetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const budgetNumber = params.budgetNumber as string
  const { formatWithPreference } = useCurrency()
  const [budget, setBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [localExchangeRates, setLocalExchangeRates] = useState<{
    USD?: ExchangeRate
    EUR?: ExchangeRate
  }>({})
  const [formattedTotals, setFormattedTotals] = useState<
    Record<string, { primary: string; secondary?: string }>
  >({})
  const [formattedProductTotals, setFormattedProductTotals] = useState<
    Record<string, { primary: string; secondary?: string }>
  >({})
  const [formattedProductDiscounts, setFormattedProductDiscounts] = useState<
    Record<string, { primary: string; secondary?: string }>
  >({})

  useEffect(() => {
    const loadBudget = async () => {
      try {
        // Cargar categorías y productos primero
        const [loadedCategories, loadedProducts] = await Promise.all([
          getCategories(),
          getProducts(),
        ])
        setCategories(loadedCategories)
        setAllProducts(loadedProducts)

        const loadedBudget = await getBudgetByNumber(budgetNumber)
        if (loadedBudget) {
          setBudget(loadedBudget)
          
          // Cargar cliente
          const loadedClient = await getClient(loadedBudget.clientId)
          if (loadedClient) {
            setClient(loadedClient)
          }

          // Cargar tasas de cambio para el día del presupuesto
          // PRIORIDAD: Usar las tasas guardadas en el presupuesto si existen
          if (loadedBudget.exchangeRatesAtCreation) {
            // Convertir las tasas guardadas al formato ExchangeRate
            const savedRates: { USD?: ExchangeRate; EUR?: ExchangeRate } = {}

            if (loadedBudget.exchangeRatesAtCreation.USD) {
              savedRates.USD = {
                id: `saved-usd-${loadedBudget.id}`,
                fromCurrency: "Bs",
                toCurrency: "USD",
                rate: loadedBudget.exchangeRatesAtCreation.USD.rate,
                effectiveDate: loadedBudget.exchangeRatesAtCreation.USD.effectiveDate,
                isActive: true,
                createdAt: loadedBudget.createdAt,
                updatedAt: loadedBudget.createdAt,
              }
            }

            if (loadedBudget.exchangeRatesAtCreation.EUR) {
              savedRates.EUR = {
                id: `saved-eur-${loadedBudget.id}`,
                fromCurrency: "Bs",
                toCurrency: "EUR",
                rate: loadedBudget.exchangeRatesAtCreation.EUR.rate,
                effectiveDate: loadedBudget.exchangeRatesAtCreation.EUR.effectiveDate,
                isActive: true,
                createdAt: loadedBudget.createdAt,
                updatedAt: loadedBudget.createdAt,
              }
            }

            setLocalExchangeRates(savedRates)
          } else {
            // Fallback: Buscar tasas del día del presupuesto si no están guardadas
            const budgetDateObj = new Date(loadedBudget.createdAt)
            budgetDateObj.setHours(0, 0, 0, 0)

            const allRates = await getAll<ExchangeRate>("exchange_rates")
            const activeRates = allRates
              .filter((r) => r.isActive)
              .sort(
                (a, b) =>
                  new Date(b.effectiveDate).getTime() -
                  new Date(a.effectiveDate).getTime()
              )

            // Buscar la tasa más reciente hasta el día del presupuesto
            const usdRate = activeRates.find(
              (r) =>
                r.toCurrency === "USD" &&
                new Date(r.effectiveDate).getTime() <= budgetDateObj.getTime()
            )
            const eurRate = activeRates.find(
              (r) =>
                r.toCurrency === "EUR" &&
                new Date(r.effectiveDate).getTime() <= budgetDateObj.getTime()
            )

            // Si no hay tasa para el día del presupuesto, usar la más reciente disponible
            const latestUsd = activeRates.find((r) => r.toCurrency === "USD")
            const latestEur = activeRates.find((r) => r.toCurrency === "EUR")

            setLocalExchangeRates({
              USD: usdRate || latestUsd,
              EUR: eurRate || latestEur,
            })
          }
        }
      } catch (error) {
        console.error("Error loading budget:", error)
      } finally {
        setLoading(false)
      }
    }

    if (budgetNumber) {
      loadBudget()
    }
  }, [budgetNumber])

  // Formatear totales siempre en USD como principal, Bs como secundario
  useEffect(() => {
    const formatTotals = () => {
      if (!budget) return

      const totals: Record<string, { primary: string; secondary?: string }> = {}
      
      // Usar siempre USD como principal
      totals.total = formatCurrencyWithUsdPrimary(budget.total, localExchangeRates)
      totals.subtotal = formatCurrencyWithUsdPrimary(budget.subtotal, localExchangeRates)
      totals.tax = formatCurrencyWithUsdPrimary(budget.taxAmount, localExchangeRates)
      totals.subtotalBeforeDiscounts = formatCurrencyWithUsdPrimary(
        budget.subtotalBeforeDiscounts || budget.subtotal,
        localExchangeRates
      )
      
      if (budget.productDiscountTotal && budget.productDiscountTotal > 0) {
        totals.productDiscountTotal = formatCurrencyWithUsdPrimary(
          budget.productDiscountTotal,
          localExchangeRates
        )
      }
      
      if (budget.generalDiscountAmount && budget.generalDiscountAmount > 0) {
        totals.generalDiscountAmount = formatCurrencyWithUsdPrimary(
          budget.generalDiscountAmount,
          localExchangeRates
        )
      }
      
      if (budget.deliveryCost > 0) {
        totals.deliveryCost = formatCurrencyWithUsdPrimary(
          budget.deliveryCost,
          localExchangeRates
        )
      }
      
      setFormattedTotals(totals)
    }

    formatTotals()
  }, [budget, localExchangeRates])

  // Formatear precios y descuentos de productos
  useEffect(() => {
    const formatProductData = () => {
      if (!budget) return

      const formattedDiscounts: Record<string, { primary: string; secondary?: string }> = {}
      const formattedTotals: Record<string, { primary: string; secondary?: string }> = {}

      for (const budgetProduct of budget.products) {
        if (budgetProduct.discount && budgetProduct.discount > 0) {
          formattedDiscounts[budgetProduct.id] = formatCurrencyWithUsdPrimary(
            budgetProduct.discount,
            localExchangeRates
          )
        }
        const productTotal = budgetProduct.total - (budgetProduct.discount || 0)
        formattedTotals[budgetProduct.id] = formatCurrencyWithUsdPrimary(
          productTotal,
          localExchangeRates
        )
      }

      setFormattedProductDiscounts(formattedDiscounts)
      setFormattedProductTotals(formattedTotals)
    }
    formatProductData()
  }, [budget, localExchangeRates])

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen items-center justify-center">
          <p>Cargando presupuesto...</p>
        </div>
      </ProtectedRoute>
    )
  }

  if (!budget) {
    return (
      <ProtectedRoute>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-semibold mb-2">Presupuesto no encontrado</p>
            <Button onClick={() => router.push("/")}>Volver al inicio</Button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const isExpired = new Date(budget.expiresAt) < new Date()
  const displayStatus = isExpired && budget.status === "Presupuesto" ? "Vencido" : budget.status

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    onClick={() => router.push("/")}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold">
                      Presupuesto {budget.budgetNumber}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {new Date(budget.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(displayStatus)}>
                  {displayStatus}
                </Badge>
              </div>

              {/* Información General */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Información General
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Cliente</p>
                      <p className="font-medium">{budget.clientName}</p>
                      {client?.rutId && (
                        <p className="text-xs text-muted-foreground">RUT/ID: {client.rutId}</p>
                      )}
                    </div>
                    {client?.telefono && (
                      <div>
                        <p className="text-sm text-muted-foreground">Teléfono</p>
                        <p className="font-medium">{client.telefono}</p>
                      </div>
                    )}
                    {client?.email && (
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{client.email}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Vendedor</p>
                      <p className="font-medium">{budget.vendorName}</p>
                    </div>
                    {budget.referrerName && (
                      <div>
                        <p className="text-sm text-muted-foreground">Referidor</p>
                        <p className="font-medium">{budget.referrerName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                      <p className="font-medium">
                        {new Date(budget.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Válido Hasta
                      </p>
                      <p className={`font-medium ${isExpired ? "text-red-600" : ""}`}>
                        {new Date(budget.expiresAt).toLocaleDateString()}
                      </p>
                      {isExpired && (
                        <p className="text-xs text-red-600">Este presupuesto ha vencido</p>
                      )}
                    </div>
                    {budget.deliveryAddress && (
                      <div className="col-span-2 md:col-span-3">
                        <p className="text-sm text-muted-foreground">Dirección de Entrega</p>
                        <p className="font-medium">{budget.deliveryAddress}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Observaciones */}
              {budget.observations && (
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <AlertCircle className="w-5 h-5" />
                      Observaciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap bg-amber-50 dark:bg-amber-950 p-3 rounded">
                      {budget.observations}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Productos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Productos ({budget.products.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {budget.products.map((product, idx) => {
                      const category = categories.find(c => c.name === product.category)
                      
                      return (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-lg">{product.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Cantidad: {product.quantity}
                              </p>
                              {product.discount && product.discount > 0 && (
                                <p className="text-sm text-red-600 mt-1">
                                  Descuento: -
                                  {formattedProductDiscounts[product.id] ? (
                                    <FormattedCurrencyDisplay 
                                      formatted={formattedProductDiscounts[product.id]} 
                                      inline={true}
                                      className="inline"
                                    />
                                  ) : (
                                    formatCurrency(product.discount, "Bs")
                                  )}
                                </p>
                              )}
                              {product.observations && (
                                <p className="text-sm text-muted-foreground mt-2 italic">
                                  {product.observations}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              {formattedProductTotals[product.id] ? (
                                <FormattedCurrencyDisplay 
                                  formatted={formattedProductTotals[product.id]} 
                                  className="font-semibold text-lg"
                                />
                              ) : (
                                <p className="font-semibold text-lg">
                                  {formatCurrency(
                                    product.total - (product.discount || 0),
                                    "Bs"
                                  )}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Atributos */}
                          {product.attributes && Object.keys(product.attributes).length > 0 && category && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-sm font-semibold mb-2">Atributos:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                {Object.entries(product.attributes).map(([attrKey, attrValue]) => {
                                  const categoryAttribute = category.attributes?.find(
                                    attr => attr.id?.toString() === attrKey || attr.title === attrKey
                                  )
                                  const label = getAttributeValueLabel(attrValue, categoryAttribute)
                                  const attrName = categoryAttribute?.title || attrKey

                                  return (
                                    <div key={attrKey} className="flex justify-between">
                                      <span className="text-muted-foreground">{attrName}:</span>
                                      <span className="font-medium">{label}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Totales */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Resumen de Costos
                  </CardTitle>
                  {(localExchangeRates.USD || localExchangeRates.EUR) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tasas del día del presupuesto:{" "}
                      {localExchangeRates.USD &&
                        `USD: ${formatCurrency(localExchangeRates.USD.rate, "Bs")}`}
                      {localExchangeRates.USD &&
                        localExchangeRates.EUR &&
                        " | "}
                      {localExchangeRates.EUR &&
                        `EUR: ${formatCurrency(localExchangeRates.EUR.rate, "Bs")}`}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      {formattedTotals.subtotalBeforeDiscounts ? (
                        <FormattedCurrencyDisplay formatted={formattedTotals.subtotalBeforeDiscounts} />
                      ) : (
                        <CurrencyDisplay 
                          amountInBs={budget.subtotalBeforeDiscounts || budget.subtotal} 
                          exchangeRates={localExchangeRates}
                        />
                      )}
                    </div>
                    {budget.productDiscountTotal && budget.productDiscountTotal > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Descuentos individuales:</span>
                        {formattedTotals.productDiscountTotal ? (
                          <FormattedCurrencyDisplay formatted={formattedTotals.productDiscountTotal} />
                        ) : (
                          <CurrencyDisplay 
                            amountInBs={budget.productDiscountTotal} 
                            exchangeRates={localExchangeRates}
                          />
                        )}
                      </div>
                    )}
                    {budget.generalDiscountAmount && budget.generalDiscountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Descuento general:</span>
                        {formattedTotals.generalDiscountAmount ? (
                          <FormattedCurrencyDisplay formatted={formattedTotals.generalDiscountAmount} />
                        ) : (
                          <CurrencyDisplay 
                            amountInBs={budget.generalDiscountAmount} 
                            exchangeRates={localExchangeRates}
                          />
                        )}
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between">
                      <span>Subtotal después de descuentos:</span>
                      {formattedTotals.subtotal ? (
                        <FormattedCurrencyDisplay formatted={formattedTotals.subtotal} />
                      ) : (
                        <CurrencyDisplay 
                          amountInBs={budget.subtotal} 
                          exchangeRates={localExchangeRates}
                        />
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span>Impuesto (16%):</span>
                      {formattedTotals.tax ? (
                        <FormattedCurrencyDisplay formatted={formattedTotals.tax} />
                      ) : (
                        <CurrencyDisplay 
                          amountInBs={budget.taxAmount} 
                          exchangeRates={localExchangeRates}
                        />
                      )}
                    </div>
                    {budget.deliveryCost > 0 && (
                      <div className="flex justify-between">
                        <span>Delivery:</span>
                        {formattedTotals.deliveryCost ? (
                          <FormattedCurrencyDisplay formatted={formattedTotals.deliveryCost} />
                        ) : (
                          <CurrencyDisplay 
                            amountInBs={budget.deliveryCost} 
                            exchangeRates={localExchangeRates}
                          />
                        )}
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      {formattedTotals.total ? (
                        <FormattedCurrencyDisplay formatted={formattedTotals.total} />
                      ) : (
                        <CurrencyDisplay 
                          amountInBs={budget.total} 
                          exchangeRates={localExchangeRates}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}

