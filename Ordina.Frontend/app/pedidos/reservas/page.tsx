"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Eye, ClipboardCheck, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { getReservations, getClients, type Order, type Client } from "@/lib/storage";
import { buildClientFilterHaystack, digitsOnly } from "@/lib/order-client-search";
import { getActiveExchangeRates } from "@/lib/currency-utils";
import {
  commercialRatesToExchangeRatesInput,
  formatOrderAmountForDisplay,
} from "@/lib/order-currency-display";
import { useAuth } from "@/contexts/auth-context";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { EditOrderDialog } from "@/components/orders/edit-order-dialog";
import { isActiveReservation } from "@/lib/order-document-types";
import { matchesLocalDateRange } from "@/lib/date-utils";

const getStatusColor = (status: string) => {
  switch (status) {
    case "Reserva":
    case "Por Confirmar":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
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

function reservationOnlineVendor(order: Order): string {
  const source = order.sourceReservationVendorName?.trim();
  if (source) return source;
  return order.vendorName?.trim() || "—";
}

export default function ReservasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [clientById, setClientById] = useState<Map<string, Client>>(new Map());
  const [orderTotals, setOrderTotals] = useState<Record<string, string>>({});
  const [reservationToConfirm, setReservationToConfirm] = useState<Order | null>(
    null,
  );

  const canConfirmReservation =
    user &&
    (user.role === "Store Seller" ||
      user.role === "Administrator" ||
      user.role === "Super Administrator");

  const loadReservations = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await getReservations();
      setReservations(list);
    } catch (error) {
      console.error("Error loading reservations:", error);
      toast.error("No se pudieron cargar las reservas.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const list = await getClients();
        const map = new Map<string, Client>();
        for (const c of list) {
          map.set(c.id, c);
        }
        setClientById(map);
      } catch (e) {
        console.error("Error cargando clientes para filtro:", e);
      }
    };
    void loadClients();
  }, []);

  useEffect(() => {
    const updateTotals = async () => {
      if (reservations.length === 0) {
        setOrderTotals({});
        return;
      }
      const rates = await getActiveExchangeRates();
      const live = commercialRatesToExchangeRatesInput({
        USD: rates.USD,
        EUR: rates.EUR,
      });
      const totals: Record<string, string> = {};
      for (const order of reservations) {
        totals[order.id] = formatOrderAmountForDisplay(
          order.total,
          order,
          live,
        );
      }
      setOrderTotals(totals);
    };
    void updateTotals();
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    let rangeFrom = dateFrom;
    let rangeTo = dateTo;
    if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
      [rangeFrom, rangeTo] = [rangeTo, rangeFrom];
    }

    const q = searchTerm.trim().toLowerCase();
    const qDigits = digitsOnly(searchTerm);

    return reservations.filter((order) => {
      const on = (order.orderNumber ?? "").toLowerCase();
      const vendor = reservationOnlineVendor(order).toLowerCase();
      const haystack = buildClientFilterHaystack(
        order.clientName,
        clientById.get(order.clientId),
      ).toLowerCase();
      const haystackDigits = digitsOnly(haystack);

      const matchesSearch =
        q === "" ||
        on.includes(q) ||
        haystack.includes(q) ||
        vendor.includes(q) ||
        (qDigits !== "" && haystackDigits.includes(qDigits));

      const matchesDate = matchesLocalDateRange(
        order.createdAt,
        rangeFrom,
        rangeTo,
      );

      return matchesSearch && matchesDate;
    });
  }, [reservations, searchTerm, clientById, dateFrom, dateTo]);

  const {
    currentPage,
    totalPages,
    paginatedData: paginatedReservations,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({
    data: filteredReservations,
    itemsPerPage,
  });

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6">
            <nav className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground sm:mb-6">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Pedidos</span>
              <span>/</span>
              <span>Reservas</span>
            </nav>

            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="relative w-full lg:max-w-md lg:flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por #reserva, cliente, teléfono, CI o vendedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9"
                    aria-label="Buscar reservas"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Label
                      htmlFor="dateFrom"
                      className="w-12 shrink-0 text-xs text-muted-foreground sm:w-auto"
                    >
                      Desde
                    </Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="min-w-0 flex-1 sm:w-[150px] sm:flex-none"
                      aria-label="Fecha desde"
                    />
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Label
                      htmlFor="dateTo"
                      className="w-12 shrink-0 text-xs text-muted-foreground sm:w-auto"
                    >
                      Hasta
                    </Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="min-w-0 flex-1 sm:w-[150px] sm:flex-none"
                      aria-label="Fecha hasta"
                    />
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <ClipboardList className="h-5 w-5 shrink-0" />
                    Reservas
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Reservas creadas en línea (RES-) pendientes de confirmación en
                    tienda. Usa Confirmar para convertirlas en pedido (ORD).
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Cargando reservas...
                    </div>
                  ) : filteredReservations.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                      {reservations.length === 0
                        ? "No hay reservas registradas."
                        : "No hay reservas que coincidan con los filtros."}
                    </p>
                  ) : (
                    <>
                      <div className="-mx-1 overflow-x-auto rounded-md border sm:mx-0">
                        <Table className="min-w-[720px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="whitespace-nowrap">
                                N° reserva
                              </TableHead>
                              <TableHead className="min-w-[120px]">
                                Cliente
                              </TableHead>
                              <TableHead className="min-w-[110px] whitespace-nowrap">
                                Vendedor online
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Fecha
                              </TableHead>
                              <TableHead className="whitespace-nowrap">
                                Estado
                              </TableHead>
                              <TableHead className="whitespace-nowrap text-right">
                                Total
                              </TableHead>
                              <TableHead className="w-[120px] whitespace-nowrap text-right sm:w-[140px]">
                                Acciones
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedReservations.map((order) => {
                              const pending = isActiveReservation(order);
                              return (
                                <TableRow key={order.id}>
                                  <TableCell className="whitespace-nowrap font-mono text-sm font-medium">
                                    {order.orderNumber}
                                  </TableCell>
                                  <TableCell className="max-w-[160px] truncate sm:max-w-none sm:whitespace-normal">
                                    {order.clientName}
                                  </TableCell>
                                  <TableCell className="max-w-[120px] truncate text-sm text-muted-foreground sm:max-w-none sm:whitespace-normal">
                                    {reservationOnlineVendor(order)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {formatDate(order.createdAt)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Badge className={getStatusColor(order.status)}>
                                      {order.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                                    {orderTotals[order.id] ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {canConfirmReservation && pending && (
                                        <Button
                                          type="button"
                                          variant="default"
                                          size="sm"
                                          className="h-8 shrink-0 px-2"
                                          title="Confirmar reserva en tienda"
                                          onClick={() =>
                                            setReservationToConfirm(order)
                                          }
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
                                        className="h-8 w-8 shrink-0"
                                        title="Ver detalle"
                                        onClick={() =>
                                          router.push(
                                            `/pedidos/${encodeURIComponent(order.orderNumber)}`,
                                          )
                                        }
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
                      </div>
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
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      <EditOrderDialog
        open={reservationToConfirm != null}
        onOpenChange={(o) => {
          if (!o) setReservationToConfirm(null);
        }}
        order={reservationToConfirm}
        mode="confirm-reservation"
        onConfirmed={() => {
          setReservationToConfirm(null);
          void loadReservations();
        }}
      />
    </ProtectedRoute>
  );
}
