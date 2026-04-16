"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Eye, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  apiClient,
  type ClientResponseDto,
  type OrderResponseDto,
} from "@/lib/api-client"

const getStatusColor = (status: string) => {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300"
    case "Validado":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
    case "Por Fabricar":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    case "En Fabricación":
    case "Fabricación":
    case "Fabricándose":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    case "Almacén":
    case "En Almacén":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    case "Despacho":
    case "Por despachar":
    case "En Ruta":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    case "Entregado":
    case "Completada":
    case "Completado":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "Declinado":
    case "Cancelado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    case "Generado":
    case "Generada":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

function formatBs(total: number) {
  return `Bs. ${total.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

interface ClientOrdersHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: ClientResponseDto | null
}

export function ClientOrdersHistoryDialog({
  open,
  onOpenChange,
  client,
}: ClientOrdersHistoryDialogProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderResponseDto[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !client) {
      setOrders([])
      return
    }

    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const list = await apiClient.getOrdersByClient(client.id)
        if (cancelled) return
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        setOrders(sorted)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          toast.error("No se pudo cargar el historial de pedidos del cliente.")
          setOrders([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, client?.id])

  const title = client
    ? `Historial de pedidos — ${client.nombreRazonSocial}`
    : "Historial de pedidos"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Cargando pedidos...
            </div>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Este cliente no tiene pedidos registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Método de pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[72px] text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {order.paymentMethod || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBs(order.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Ver detalle"
                        onClick={() => {
                          onOpenChange(false)
                          router.push(
                            `/pedidos/${encodeURIComponent(order.orderNumber)}`,
                          )
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
