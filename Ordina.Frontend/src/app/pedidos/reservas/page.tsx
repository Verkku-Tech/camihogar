"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Search,
  Eye,
  ClipboardCheck,
  Loader2,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  orderFromBackendDto,
  deleteOrder,
  type Order,
} from "@/lib/storage";
import { apiClient } from "@/lib/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getActiveExchangeRates } from "@/lib/currency-utils";
import {
  commercialRatesToExchangeRatesInput,
  formatOrderAmountForDisplay,
} from "@/lib/order-currency-display";
import { useAuth } from "@/contexts/auth-context";
import { useOnlineSellerVisibility } from "@/hooks/use-online-seller-visibility";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { EditOrderDialog } from "@/components/orders/edit-order-dialog";
import { isActiveReservation } from "@/lib/order-document-types";
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"


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
  const { user, hasPermission } = useAuth();
  const { applies: onlineSellerFilter } = useOnlineSellerVisibility();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orderTotals, setOrderTotals] = useState<Record<string, string>>({});
  const [reservationToConfirm, setReservationToConfirm] = useState<Order | null>(
    null,
  );
  const [reservationToDelete, setReservationToDelete] = useState<Order | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const canDeleteReservation = hasPermission("orders.delete");

  const canConfirmReservation =
    user &&
    (user.role === "Store Seller" ||
      user.role === "Online Seller" ||
      user.role === "Administrator" ||
      user.role === "Super Administrator");

  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchPage = useCallback(
    async (page: number, signal?: AbortSignal) => {
      const filters: {
        status: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        vendor?: string;
      } = { status: "Reserva" };

      if (debouncedSearchTerm.trim()) filters.search = debouncedSearchTerm.trim();
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (onlineSellerFilter && user?.name) filters.vendor = user.name;

      const response = await apiClient.getOrdersPaged(
        page,
        itemsPerPage,
        undefined,
        filters,
        signal,
      );
      return {
        items: (response.orders ?? []).map(orderFromBackendDto),
        totalCount: response.totalCount,
        totalPages: response.totalPages,
      };
    },
    [debouncedSearchTerm, dateFrom, dateTo, onlineSellerFilter, user?.name, itemsPerPage],
  );

  const fetchCount = useCallback(
    async (signal?: AbortSignal) => {
      const filters: {
        status: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        vendor?: string;
      } = { status: "Reserva" };

      if (debouncedSearchTerm.trim()) filters.search = debouncedSearchTerm.trim();
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (onlineSellerFilter && user?.name) filters.vendor = user.name;

      const response = await apiClient.getOrderCount(filters, signal);
      return {
        totalCount: response.totalCount,
        totalPages: response.totalPages,
      };
    },
    [debouncedSearchTerm, dateFrom, dateTo, onlineSellerFilter, user?.name],
  );

  const {
    currentPage,
    totalPages,
    totalCount,
    currentItems,
    isLoadingCount,
    isLoadingPages,
    goToPage,
    refetch,
  } = useServerPagination({
    fetchPage,
    fetchCount,
    itemsPerPage,
  });

  const isLoading = isLoadingCount;

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  useEffect(() => {
    const updateTotals = async () => {
      if (currentItems.length === 0) {
        setOrderTotals({});
        return;
      }
      const rates = await getActiveExchangeRates();
      const live = commercialRatesToExchangeRatesInput({
        USD: rates.USD,
        EUR: rates.EUR,
      });
      const totals: Record<string, string> = {};
      for (const order of currentItems) {
        totals[order.id] = formatOrderAmountForDisplay(
          order.total,
          order,
          live,
        );
      }
      setOrderTotals(totals);
    };
    void updateTotals();
  }, [currentItems]);

  const handleDeleteClick = (order: Order) => {
    if (!canDeleteReservation) {
      toast.error("No tienes permiso para eliminar reservas.");
      return;
    }
    setReservationToDelete(order);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!reservationToDelete) return;
    if (!canDeleteReservation) {
      toast.error("No tienes permiso para eliminar reservas.");
      setIsDeleteDialogOpen(false);
      setReservationToDelete(null);
      return;
    }

    try {
      await deleteOrder(reservationToDelete.id);
      setIsDeleteDialogOpen(false);
      setReservationToDelete(null);
      toast.success("Reserva eliminada");
      refetch();
    } catch (error) {
      console.error("Error deleting reservation:", error);
      toast.error("Error al eliminar la reserva. Por favor intenta nuevamente.");
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6">
            

            <AppBreadcrumb />
<div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="relative w-full lg:max-w-md lg:flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por #reserva, cliente, teléfono, CI o vendedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-9"
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
                  ) : currentItems.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                      {totalCount === 0
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
                            {currentItems.map((order) => {
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
                                      {canDeleteReservation && pending && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                                          title="Eliminar reserva"
                                          onClick={() => handleDeleteClick(order)}
                                        >
                                          <Trash2 className="h-4 w-4" />
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
                        totalItems={totalCount}
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
          refetch();
        }}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la reserva &quot;
              {reservationToDelete?.orderNumber}&quot;?
              <br />
              <span className="mt-2 block text-sm text-muted-foreground">
                Cliente: {reservationToDelete?.clientName} — Total:{" "}
                {reservationToDelete
                  ? (orderTotals[reservationToDelete.id] ?? "—")
                  : "—"}
              </span>
              <br />
              <span className="mt-2 block text-sm font-medium text-red-600">
                Esta acción no se puede deshacer.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReservationToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}
