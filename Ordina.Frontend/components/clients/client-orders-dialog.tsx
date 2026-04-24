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
import { Eye, Loader2, ClipboardCheck } from "lucide-react"
import { toast } from "sonner"
import {
  apiClient,
  type ClientResponseDto,
  type OrderResponseDto,
} from "@/lib/api-client"
import { useAuth } from "@/contexts/auth-context"
import { EditOrderDialog } from "@/components/orders/edit-order-dialog"
import { orderFromBackendDto, type Order } from "@/lib/storage"
import {
  formatUsdOnlyFromOrderTotal,
  getActiveExchangeRates,
} from "@/lib/currency-utils"

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
    case "Por Confirmar":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
    case "Convertido":
      return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
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
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderResponseDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pcfOrderToConfirm, setPcfOrderToConfirm] = useState<Order | null>(null)
  const [orderTotalsUsd, setOrderTotalsUsd] = useState<Record<string, string>>({})

  const canConfirmPcf =
    user &&
    (user.role === "Store Seller" ||
      user.role === "Administrator" ||
      user.role === "Super Administrator")

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

  useEffect(() => {
    if (orders.length === 0) {
      setOrderTotalsUsd({})
      return
    }
    let cancelled = false
    const run = async () => {
      const fallbackRates = await getActiveExchangeRates()
      if (cancelled) return
      const totals: Record<string, string> = {}
      for (const row of orders) {
        const formatted = await formatUsdOnlyFromOrderTotal(row.total, row, fallbackRates)
        totals[row.id] = formatted
      }
      if (!cancelled) setOrderTotalsUsd(totals)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [orders])

  const title = client
    ? `Historial de pedidos — ${client.nombreRazonSocial}`
    : "Historial de pedidos"

  return (
    <>
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Método de pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const isPcfPending =
                    order.type === "PendingConfirmation" && order.status === "Por Confirmar"
                  const typeLabel =
                    order.type === "PendingConfirmation"
                      ? "Por confirmar"
                      : order.type === "Budget"
                        ? "Presupuesto"
                        : "Pedido"
                  return (
                    <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {typeLabel}
                      </Badge>
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
                      {orderTotalsUsd[order.id] ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canConfirmPcf && isPcfPending && (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-8 px-2"
                            title="Confirmar pedido en tienda"
                            onClick={() => {
                              setPcfOrderToConfirm(orderFromBackendDto(order))
                            }}
                          >
                            <ClipboardCheck className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Confirmar</span>
                          </Button>
                        )}
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
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <EditOrderDialog
      open={pcfOrderToConfirm != null}
      onOpenChange={(o) => {
        if (!o) setPcfOrderToConfirm(null)
      }}
      order={pcfOrderToConfirm}
      mode="confirm-pcf"
      onConfirmed={() => {
        if (!client) return
        void (async () => {
          try {
            const list = await apiClient.getOrdersByClient(client.id)
            const sorted = [...list].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
            setOrders(sorted)
          } catch (e) {
            console.error(e)
            toast.error("No se pudo actualizar el historial.")
          }
        })()
      }}
    />
    </>
  )
}
