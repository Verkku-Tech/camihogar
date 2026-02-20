"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Search, Download, FileSpreadsheet, Wifi, WifiOff, Loader2, Check, ChevronsUpDown } from "lucide-react"
import { getProviders, getOrders, type Provider, type Order, type OrderProduct } from "@/lib/storage"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ManufacturingStatus = "debe_fabricar" | "fabricando" | "almacen_no_fabricado"

interface ManufacturingReportRow {
  fecha: string
  pedido: string
  estado: string
  cliente: string
  fabricante: string
  cantidad: number
  descripcion: string
  observacionesVendedor: string
  observacionesFabricante: string
}

export function ManufacturingReport() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrderNumbers, setFilteredOrderNumbers] = useState<string[]>([])
  const [orderComboboxOpen, setOrderComboboxOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ManufacturingStatus>("debe_fabricar")
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("all")
  const [orderNumber, setOrderNumber] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewData, setPreviewData] = useState<ManufacturingReportRow[]>([])
  const [isOnline, setIsOnline] = useState(true)

  // Detectar estado de conexión
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine)
      
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      
      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)
      
      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  }, [])

  // Cargar proveedores (fabricantes)
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const loadedProviders = await getProviders()
        // Filtrar solo proveedores de servicios/productos-terminados (fabricantes)
        const manufacturers = loadedProviders.filter(
          p => p.estado === "activo" && 
          (p.tipo === "servicios" || p.tipo === "productos-terminados")
        )
        setProviders(manufacturers)
      } catch (error) {
        console.error("Error loading providers:", error)
      }
    }
    loadProviders()
  }, [])

  // Cargar vista previa desde el backend
  useEffect(() => {
    const loadPreview = async () => {
      if (!isOnline) {
        setPreviewData([])
        return
      }

      setIsLoadingPreview(true)
      try {
        const token = localStorage.getItem("auth_token")
        if (!token) {
          console.warn("No hay token de autenticación")
          setPreviewData([])
          return
        }

        const params = new URLSearchParams()
        params.append("status", activeTab)

        // Agregar searchTerm si existe
        if (searchTerm && searchTerm.trim()) {
          params.append("searchTerm", searchTerm.trim())
        }

        // Para "Por Fabricar": pedido y fechas
        if (activeTab === "debe_fabricar") {
          if (orderNumber.trim()) {
            params.append("orderNumber", orderNumber.trim())
          }
          if (startDate) {
            params.append("startDate", startDate)
          }
          if (endDate) {
            params.append("endDate", endDate)
          }
        } else {
          // Para "Fabricando" y "Fabricado": solo fabricante
          if (selectedManufacturer !== "all") {
            params.append("manufacturerId", selectedManufacturer)
          }
        }

        const url = `/api/proxy/orders/api/Reports/Manufacturing/Preview?${params.toString()}`
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          console.error("Error loading preview:", response.status, response.statusText)
          setPreviewData([])
          return
        }

        const data = await response.json()
        console.log("📊 Datos recibidos del backend:", data)
        // Mapear las propiedades del backend (puede ser PascalCase o camelCase dependiendo de la configuración JSON)
        const mappedData: ManufacturingReportRow[] = data.map((row: any) => ({
          fecha: row.Fecha || row.fecha,
          pedido: row.Pedido || row.pedido,
          estado: row.Estado || row.estado,
          cliente: row.Cliente || row.cliente,
          fabricante: row.Fabricante || row.fabricante,
          cantidad: row.Cantidad || row.cantidad || 0,
          descripcion: row.Descripcion || row.descripcion || "",
          observacionesVendedor: row.ObservacionesVendedor || row.observacionesVendedor || "",
          observacionesFabricante: row.ObservacionesFabricante || row.observacionesFabricante || "",
        }))
        console.log("📋 Datos mapeados:", mappedData)
        
        setPreviewData(mappedData)
        console.log("✅ Vista previa cargada desde backend:", mappedData.length, "filas")
      } catch (error) {
        console.error("Error loading preview:", error)
        setPreviewData([])
      } finally {
        setIsLoadingPreview(false)
      }
    }

    loadPreview()
  }, [activeTab, selectedManufacturer, orderNumber, startDate, endDate, searchTerm, isOnline])

  // Cargar pedidos según la pestaña activa
  useEffect(() => {
    const loadOrders = async () => {
      try {
        const loadedOrders = await getOrders()
        console.log("📦 Pedidos cargados:", loadedOrders.length)
        setOrders(loadedOrders)
        
        // Solo filtrar números de pedido para la pestaña "Por fabricar" (necesitamos el combobox)
        if (activeTab === "debe_fabricar") {
          // Filtrar pedidos que tienen productos "Por fabricar"
          const ordersWithPendingManufacturing = loadedOrders.filter(order => {
            return order.products.some(product => {
              // Solo productos que deben mandarse a fabricar
              if (product.locationStatus !== "FABRICACION") {
                return false
              }
              // Determinar el estado real del producto
              const productStatus = product.manufacturingStatus || "debe_fabricar"
              // Solo "debe_fabricar" (Por fabricar)
              return productStatus === "debe_fabricar"
            })
          })
          
          console.log("✅ Pedidos con productos 'Por fabricar':", ordersWithPendingManufacturing.length)
          console.log("📋 Productos encontrados:", ordersWithPendingManufacturing.flatMap(o => 
            o.products.filter(p => {
              if (p.locationStatus !== "FABRICACION") return false
              const status = p.manufacturingStatus || "debe_fabricar"
              return status === "debe_fabricar"
            }).map(p => ({
              order: o.orderNumber,
              product: p.name,
              locationStatus: p.locationStatus,
              manufacturingStatus: p.manufacturingStatus
            }))
          ))
          
          // Extraer números de pedido únicos para el combobox
          const orderNumbers = ordersWithPendingManufacturing
            .map(order => order.orderNumber)
            .filter((value, index, self) => self.indexOf(value) === index)
            .sort()
          
          console.log("🔢 Números de pedido filtrados:", orderNumbers)
          setFilteredOrderNumbers(orderNumbers)
        } else {
          // Para otras pestañas, no necesitamos filtrar números de pedido (no hay combobox)
          setFilteredOrderNumbers([])
        }
      } catch (error) {
        console.error("❌ Error loading orders:", error)
        setFilteredOrderNumbers([])
        setOrders([])
      }
    }
    
    // Cargar pedidos para todas las pestañas (necesitamos los datos para la vista previa)
    loadOrders()
  }, [activeTab])

  // Resetear filtros cuando cambia la pestaña
  useEffect(() => {
    setSelectedManufacturer("all")
    setOrderNumber("")
    setStartDate("")
    setEndDate("")
    setSearchTerm("")
  }, [activeTab])

  // Descargar reporte desde el backend
  const downloadReport = async () => {
    if (!isOnline) {
      toast.error("No hay conexión. El reporte debe generarse desde el servidor.")
      return
    }

    setIsDownloading(true)
    try {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        toast.error("Debes iniciar sesión para descargar reportes")
        return
      }

      // Construir URL con parámetros
      const params = new URLSearchParams()
      params.append("status", activeTab)
      
      // Agregar searchTerm si existe (para todas las pestañas)
      if (searchTerm && searchTerm.trim()) {
        params.append("searchTerm", searchTerm.trim())
      }
      
      // Para "Por Fabricar": pedido y fechas
      if (activeTab === "debe_fabricar") {
        if (orderNumber.trim()) {
          params.append("orderNumber", orderNumber.trim())
        }
        
        if (startDate) {
          params.append("startDate", startDate)
        }
        
        if (endDate) {
          params.append("endDate", endDate)
        }
      } else {
        // Para "Fabricando" y "Fabricado": solo fabricante
        if (selectedManufacturer !== "all") {
          params.append("manufacturerId", selectedManufacturer)
        }
      }

      // Usar el proxy de Next.js para evitar problemas de CORS
      const url = `/api/proxy/orders/api/Reports/Manufacturing?${params.toString()}`

      // Hacer petición al backend a través del proxy
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errorMessage = `Error ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch {
          // Si no es JSON, intentar obtener texto
          try {
            const errorText = await response.text()
            if (errorText) errorMessage = errorText
          } catch {
            // Si falla todo, usar el mensaje por defecto
          }
        }
        
        if (response.status === 503) {
          errorMessage = "El servicio de reportes no está disponible. Verifica que el backend esté corriendo."
        }
        
        throw new Error(errorMessage)
      }

      // Obtener el blob del Excel
      const blob = await response.blob()
      
      // Crear URL temporal y descargar
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      
      // Obtener nombre del archivo desde headers o usar uno por defecto
      const contentDisposition = response.headers.get("content-disposition")
      let fileName = `Reporte_Fabricacion_${activeTab}_${new Date().toISOString().split("T")[0]}.xlsx`
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (fileNameMatch) {
          fileName = fileNameMatch[1]
        }
      }
      
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      toast.success("Reporte descargado correctamente")
    } catch (error: any) {
      console.error("Error downloading report:", error)
      toast.error(error.message || "Error al descargar el reporte")
    } finally {
      setIsDownloading(false)
    }
  }

  const getStatusLabel = (status: ManufacturingStatus): string => {
    switch (status) {
      case "debe_fabricar":
        return "Por Fabricar"
      case "fabricando":
        return "Fabricando"
      case "almacen_no_fabricado":
        return "En almacén"
      default:
        return status
    }
  }

  // Función para filtrar productos según el estado y filtros aplicados
  // (Ya no se usa para la vista previa, solo para el combobox de números de pedido)
  const getFilteredProducts = (): Array<{
    order: Order
    product: OrderProduct
    orderDate: string
  }> => {
    const result: Array<{ order: Order; product: OrderProduct; orderDate: string }> = []

    orders.forEach(order => {
      // Filtrar por número de pedido si se especifica
      if (orderNumber && order.orderNumber !== orderNumber) {
        return
      }

      // Filtrar por rango de fechas si se especifica
      const orderDate = new Date(order.createdAt)
      if (startDate) {
        const start = new Date(startDate)
        if (orderDate < start) {
          return
        }
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999) // Incluir todo el día
        if (orderDate > end) {
          return
        }
      }

      order.products.forEach(product => {
        // Solo productos que deben mandarse a fabricar
        if (product.locationStatus !== "FABRICACION") {
          return
        }

        // Determinar el estado real del producto
        const productStatus = product.manufacturingStatus || "debe_fabricar"

        // Filtrar por el estado solicitado
        if (productStatus !== activeTab) {
          return
        }

        // Filtrar por fabricante si se especifica (solo para fabricando y en almacén)
        if (activeTab !== "debe_fabricar" && selectedManufacturer !== "all") {
          if (!product.manufacturingProviderId || product.manufacturingProviderId !== selectedManufacturer) {
            return
          }
        }

        // Filtrar por término de búsqueda
        if (searchTerm) {
          const search = searchTerm.toLowerCase()
          const matchesOrder = order.orderNumber.toLowerCase().includes(search)
          const matchesClient = order.clientName.toLowerCase().includes(search)
          const matchesProduct = product.name.toLowerCase().includes(search)
          
          if (!matchesOrder && !matchesClient && !matchesProduct) {
            return
          }
        }

        result.push({
          order,
          product,
          orderDate: order.createdAt
        })
      })
    })

    // Ordenar por fecha (más reciente primero) y luego por número de pedido
    result.sort((a, b) => {
      const dateCompare = new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.order.orderNumber.localeCompare(b.order.orderNumber)
    })

    return result
  }

  // Ya no necesitamos filteredProducts, usamos previewData del backend

  return (
    <div className="space-y-6">
      {/* Indicador de estado de conexión */}
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">
                    Conectado - El reporte se genera desde el servidor
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-muted-foreground">
                    Sin conexión - Los reportes requieren conexión al servidor
                  </span>
                </>
              )}
            </div>
            <Badge variant={isOnline ? "default" : "secondary"}>
              {isOnline ? "Online" : "Offline"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Reporte de Fabricación */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Reporte de Fabricación
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Botón de descarga */}
            <div className="flex items-center justify-end">
              <Button 
                onClick={downloadReport} 
                className="bg-green-600 hover:bg-green-700"
                disabled={!isOnline || isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Descargar Excel
                  </>
                )}
              </Button>
            </div>

            {/* Filtros - Condicionales según el estado */}
            <div className="space-y-4">
              <div className="text-sm font-medium">Filtros:</div>
              
              {/* Select de Estado - Dentro de filtros */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estado de Fabricación</label>
                <Select value={activeTab} onValueChange={(value) => setActiveTab(value as ManufacturingStatus)}>
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debe_fabricar">Por Fabricar</SelectItem>
                    <SelectItem value="fabricando">Fabricando</SelectItem>
                    <SelectItem value="almacen_no_fabricado">En almacén</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Para "Por Fabricar": Pedido y Fechas */}
              {activeTab === "debe_fabricar" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Filtro por Pedido - Combobox */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Número de Pedido
                    </label>
                    <Popover open={orderComboboxOpen} onOpenChange={setOrderComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={orderComboboxOpen}
                          className="w-full justify-between"
                        >
                          {orderNumber
                            ? filteredOrderNumbers.find((num) => num === orderNumber) || orderNumber
                            : "Seleccionar pedido..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar pedido..." />
                          <CommandList>
                            <CommandEmpty>No se encontraron pedidos.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="Todos los pedidos"
                                keywords={["todos", "all", "ninguno"]}
                                onSelect={() => {
                                  setOrderNumber("")
                                  setOrderComboboxOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    orderNumber === "" ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                Todos los pedidos
                              </CommandItem>
                              {filteredOrderNumbers.map((orderNum) => (
                                <CommandItem
                                  key={orderNum}
                                  value={orderNum}
                                  onSelect={() => {
                                    setOrderNumber(orderNum === orderNumber ? "" : orderNum)
                                    setOrderComboboxOpen(false)
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      orderNumber === orderNum ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {orderNum}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Filtro por Fecha Inicio */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Fecha Inicio
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  {/* Filtro por Fecha Fin */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Fecha Fin
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Para estados distintos de "Por Fabricar": filtro por Fabricante */}
              {activeTab !== "debe_fabricar" && (
                <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Fabricante
                    </label>
                    <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los fabricantes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los fabricantes</SelectItem>
                        {providers
                          .filter((provider) => provider.id && provider.id.trim() !== "")
                          .map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              {provider.razonSocial}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Botón Limpiar Filtros */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedManufacturer("all")
                    setOrderNumber("")
                    setStartDate("")
                    setEndDate("")
                    setSearchTerm("")
                  }}
                >
                  Limpiar Filtros
                </Button>
              </div>

              {/* Nota sobre filtros */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Nota:</strong> Este reporte muestra productos con estado "{getStatusLabel(activeTab)}". 
                  {activeTab === "debe_fabricar"
                    ? " Puedes filtrar por pedido y rango de fechas."
                    : " Puedes filtrar por fabricante."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista previa - Siempre visible */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar cliente, pedido o descripción... (Ctrl+F también funciona)"
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Usa Ctrl+F en tu navegador para búsqueda rápida en toda la página. El término de búsqueda también se aplicará al Excel descargado.
            </p>
          </div>
          
          <div className="rounded-md border">
            {isLoadingPreview ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
                <p>Cargando vista previa desde el servidor...</p>
              </div>
            ) : previewData.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">No hay productos para mostrar</p>
                <p className="text-sm">
                  No se encontraron productos con estado "{getStatusLabel(activeTab)}" que coincidan con los filtros aplicados.
                  <br />
                  Intenta ajustar los filtros o descarga el reporte en Excel.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-medium text-muted-foreground">Fecha</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Fabricante</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Cantidad</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Descripción</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Obs. Vendedor</TableHead>
                      <TableHead className="font-medium text-muted-foreground">Obs. Fabricante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={`${row.pedido}-${index}`}>
                        <TableCell className="text-sm">
                          {row.fecha ? (() => {
                            // Intentar parsear la fecha (puede venir como "yyyy-MM-dd" o Date ISO string)
                            try {
                              const date = row.fecha.includes('T') 
                                ? new Date(row.fecha)
                                : new Date(row.fecha + 'T00:00:00');
                              if (isNaN(date.getTime())) {
                                return row.fecha; // Si no se puede parsear, mostrar el string original
                              }
                              return date.toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              });
                            } catch {
                              return row.fecha; // Si hay error, mostrar el string original
                            }
                          })() : "-"}
                        </TableCell>
                        <TableCell className="font-medium text-green-600">{row.pedido}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="secondary">
                            {row.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{row.cliente}</TableCell>
                        <TableCell className="text-sm">
                          {row.fabricante || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-center">{row.cantidad}</TableCell>
                        <TableCell className="text-sm">{row.descripcion}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.observacionesVendedor || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.observacionesFabricante || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-4 bg-muted/50 text-sm text-muted-foreground text-center">
                  Mostrando <strong>{previewData.length}</strong> producto(s) - La vista previa se genera desde el servidor. 
                  Usa el botón "Descargar Excel" para exportar el reporte completo con los filtros aplicados.
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
