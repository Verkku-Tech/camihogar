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
import { formatCurrency } from "@/lib/currency-utils"
import { useCurrency } from "@/contexts/currency-context"
import type { AttributeValue } from "@/lib/storage"

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

  useEffect(() => {
    const loadBudget = async () => {
      try {
        const loadedBudget = await getBudgetByNumber(budgetNumber)
        if (loadedBudget) {
          setBudget(loadedBudget)
          
          // Cargar cliente
          const loadedClient = await getClient(loadedBudget.clientId)
          if (loadedClient) {
            setClient(loadedClient)
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedCategories, loadedProducts] = await Promise.all([
          getCategories(),
          getProducts(),
        ])
        setCategories(loadedCategories)
        setAllProducts(loadedProducts)
      } catch (error) {
        console.error("Error loading categories/products:", error)
      }
    }

    loadData()
  }, [])

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
                                  Descuento: -{formatCurrency(product.discount, "Bs")}
                                </p>
                              )}
                              {product.observations && (
                                <p className="text-sm text-muted-foreground mt-2 italic">
                                  {product.observations}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-lg">
                                {formatCurrency(
                                  product.total - (product.discount || 0),
                                  budget.baseCurrency || "Bs"
                                )}
                              </p>
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
                    <FileText className="w-4 h-4" />
                    Resumen de Costos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">
                        {formatCurrency(budget.subtotalBeforeDiscounts || budget.subtotal, budget.baseCurrency || "Bs")}
                      </span>
                    </div>
                    {budget.productDiscountTotal && budget.productDiscountTotal > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Descuentos individuales:</span>
                        <span>-{formatCurrency(budget.productDiscountTotal, budget.baseCurrency || "Bs")}</span>
                      </div>
                    )}
                    {budget.generalDiscountAmount && budget.generalDiscountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Descuento general:</span>
                        <span>-{formatCurrency(budget.generalDiscountAmount, budget.baseCurrency || "Bs")}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between">
                      <span>Subtotal después de descuentos:</span>
                      <span className="font-medium">
                        {formatCurrency(budget.subtotal, budget.baseCurrency || "Bs")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Impuesto (16%):</span>
                      <span className="font-medium">
                        {formatCurrency(budget.taxAmount, budget.baseCurrency || "Bs")}
                      </span>
                    </div>
                    {budget.deliveryCost > 0 && (
                      <div className="flex justify-between">
                        <span>Delivery:</span>
                        <span className="font-medium">
                          {formatCurrency(budget.deliveryCost, budget.baseCurrency || "Bs")}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(budget.total, budget.baseCurrency || "Bs")}</span>
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

