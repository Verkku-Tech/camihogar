"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Loader2, ClipboardCheck, Filter } from "lucide-react";
import { toast } from "sonner";
import {
  apiClient,
  type ClientResponseDto,
  type OrderResponseDto,
} from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { EditOrderDialog } from "@/components/orders/edit-order-dialog";
import { orderFromBackendDto, type Order } from "@/lib/storage";
import {
  isActiveReservation,
  isReservationOrder,
  ORDER_TYPE_RESERVATION,
} from "@/lib/order-document-types";

import {
  formatUsdOnlyFromOrderTotal,
  getActiveExchangeRates,
} from "@/lib/currency-utils";
import {
  getOrderPendingTotal,
  PAYMENT_BALANCE_EPSILON_BS,
} from "@/lib/order-payments";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUDGET_STATUSES, ORDER_STATUSES } from "../orders/constants";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "../ui/table-pagination";

const getStatusColor = (status: string) => {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300";
    case "Validado":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
    case "Por Fabricar":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "En Fabricación":
    case "Fabricación":
    case "Fabricándose":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "Almacén":
    case "En Almacén":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "Despacho":
    case "Por despachar":
    case "En Ruta":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "Entregado":
    case "Completada":
    case "Completado":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "Declinado":
    case "Cancelado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "Generado":
    case "Generada":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    case "Reserva":
    case "Por Confirmar":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "Convertido":
      return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function isOrderFullyPaid(order: OrderResponseDto): boolean {
  return getOrderPendingTotal(order) <= PAYMENT_BALANCE_EPSILON_BS;
}

function getPaymentStatusBadgeClass(paid: boolean) {
  return paid
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
    : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
}

function toDateFilterKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function applyHistoryFilters(
  list: OrderResponseDto[],
  documentType: string,
  status: string,
  filterDate: string,
): OrderResponseDto[] {
  return [...list]
    .filter((d) => {
      if (filterDate === "") return true;
      return toDateFilterKey(d.createdAt) === filterDate;
    })
    .filter((s) => {
      if (status === "all") return true;
      return s.status === status;
    })
    .filter((d) => {
      if (documentType === ORDER_TYPE_RESERVATION) {
        return isReservationOrder(d);
      }
      return d.type === documentType;
    })
    .filter((o) => {
      if (documentType === "Order") return true;
      return o.status !== "Convertido";
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

interface ClientOrdersHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientResponseDto | null;
}

export function ClientOrdersHistoryDialog({
  open,
  onOpenChange,
  client,
}: ClientOrdersHistoryDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [storeCreditBalanceUsd, setStoreCreditBalanceUsd] = useState<
    number | null
  >(null);
  const [reservationToConfirm, setReservationToConfirm] =
    useState<Order | null>(null);
  const [orderTotalsUsd, setOrderTotalsUsd] = useState<Record<string, string>>(
    {},
  );

  const canConfirmReservation =
    user &&
    (user.role === "Store Seller" ||
      user.role === "Administrator" ||
      user.role === "Super Administrator");
  const [documentTypeSelected, setDocumentTypeSelected] =
    useState<string>("Order");

  const [statusSelected, setStatusSelected] = useState<string>("all");

  const statusOptions = useMemo(() => {
    switch (documentTypeSelected) {
      case "Budget":
        return BUDGET_STATUSES;
      case ORDER_TYPE_RESERVATION:
        return ORDER_STATUSES;

      default:
        return ORDER_STATUSES;
    }
  }, [documentTypeSelected]);

  const documentTypes = [
    { value: ORDER_TYPE_RESERVATION, label: "Reservas" },
    { value: "Order", label: "Pedidos" },
    { value: "Budget", label: "Presupuesto" },
  ];

  const {
    currentPage,
    totalPages,
    paginatedData: paginatedOrders,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({
    data: orders,
    itemsPerPage,
  });

  useEffect(() => {
    setDocumentTypeSelected("Order");
    setStatusSelected("all");
    setFilterDate("");
  }, [open]);

  useEffect(() => {
    if (!open || !client) {
      setOrders([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const list = await apiClient.getOrdersByClient(client.id);
        if (cancelled) return;
        setOrders(
          applyHistoryFilters(
            list,
            documentTypeSelected,
            statusSelected,
            filterDate,
          ),
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error("No se pudo cargar el historial de pedidos del cliente.");
          setOrders([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, client?.id, documentTypeSelected, statusSelected, filterDate]);

  useEffect(() => {
    if (!open || !client?.id) {
      setStoreCreditBalanceUsd(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.getClientStoreCreditBalanceUsd(client.id);
        if (!cancelled) setStoreCreditBalanceUsd(res.balanceUsd);
      } catch {
        if (!cancelled) setStoreCreditBalanceUsd(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, client?.id]);

  useEffect(() => {
    if (orders.length === 0) {
      setOrderTotalsUsd({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      const fallbackRates = await getActiveExchangeRates();
      if (cancelled) return;
      const totals: Record<string, string> = {};
      for (const row of orders) {
        const formatted = await formatUsdOnlyFromOrderTotal(
          row.total,
          row,
          fallbackRates,
        );
        totals[row.id] = formatted;
      }
      if (!cancelled) setOrderTotalsUsd(totals);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [orders]);

  const title = client
    ? `Historial de pedidos — ${client.nombreRazonSocial}`
    : "Historial de pedidos";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {storeCreditBalanceUsd != null && storeCreditBalanceUsd > 0 && (
              <p className="text-sm text-muted-foreground">
                Saldo a favor:{" "}
                <span className="font-medium text-foreground">
                  USD {storeCreditBalanceUsd.toFixed(2)}
                </span>
              </p>
            )}
          </DialogHeader>

          <div className="flex gap-2">
            <Select
              value={documentTypeSelected}
              onValueChange={(value) => {
                setDocumentTypeSelected(value);
                setStatusSelected("all");
                setFilterDate("");
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {documentTypeSelected !== ORDER_TYPE_RESERVATION && (
              <Select value={statusSelected} onValueChange={setStatusSelected}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Fecha
              </span>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-[150px]"
                aria-label="Fecha"
              />
            </div>
          </div>

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
                    <TableHead>Estado de pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Convertido de</TableHead>
                    <TableHead className="text-right w-[120px]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => {
                    const isReservationPending = isActiveReservation(order);
                    const typeLabel = isReservationOrder(order)
                      ? "Reserva"
                      : order.type === "Budget"
                        ? "Presupuesto"
                        : "Pedido";
                    const fullyPaid = isOrderFullyPaid(order);
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
                        <TableCell>
                          <Badge
                            className={getPaymentStatusBadgeClass(fullyPaid)}
                          >
                            {fullyPaid ? "Pagada" : "Pendiente de pago"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {orderTotalsUsd[order.id] ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          {order.convertedFromNumber ? (
                            <button
                              type="button"
                              className="font-mono text-sm font-medium hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/pedidos/${encodeURIComponent(order.convertedFromNumber)}`,
                                );
                              }}
                            >
                              {order.convertedFromNumber}
                            </button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canConfirmReservation && isReservationPending && (
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="h-8 px-2"
                                title="Confirmar reserva en tienda"
                                onClick={() => {
                                  setReservationToConfirm(
                                    orderFromBackendDto(order),
                                  );
                                }}
                              >
                                <ClipboardCheck className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">
                                  Confirmar
                                </span>
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Ver detalle"
                              onClick={() => {
                                onOpenChange(false);
                                router.push(
                                  `/pedidos/${encodeURIComponent(order.orderNumber)}`,
                                );
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          {/* Paginación */}
          {!isLoading && orders.length > 0 && (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={goToPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          )}
        </DialogContent>
      </Dialog>

      <EditOrderDialog
        open={reservationToConfirm != null}
        onOpenChange={(o) => {
          if (!o) setReservationToConfirm(null);
        }}
        order={reservationToConfirm}
        mode="confirm-reservation"
        onConfirmed={() => {
          if (!client) return;
          void (async () => {
            try {
              const list = await apiClient.getOrdersByClient(client.id);
              setOrders(
                applyHistoryFilters(
                  list,
                  documentTypeSelected,
                  statusSelected,
                  filterDate,
                ),
              );
            } catch (e) {
              console.error(e);
              toast.error("No se pudo actualizar el historial.");
            }
          })();
        }}
      />
    </>
  );
}
