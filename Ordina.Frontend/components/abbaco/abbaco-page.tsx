"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { useAuth } from "@/contexts/auth-context";
import {
  loadAbbacoOrders,
  normalizeDivisa,
  type AbbacoOrderView,
} from "@/lib/abbaco";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";

function estadoColor(estado: string): string {
  const e = estado.trim().toLowerCase();
  if (e === "validado")
    return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
  if (e === "borrador (a validar)")
    return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
  if (e === "emitido")
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
}

function buildSearchText(order: AbbacoOrderView): string {
  const parts = [
    order.codigo,
    order.tercero,
    order.autor,
    order.estado,
    order.client?.nombre,
    order.client?.rif,
    order.client?.telefono,
    order.client?.telefono2,
    order.client?.correo,
    ...order.lines.map((l) => l.descripcion),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function AbbacoPage() {
  const { hasPermission } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<AbbacoOrderView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const canView = hasPermission("orders.read");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadAbbacoOrders();
        if (!cancelled) {
          setOrders(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar los datos");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(orders.map((o) => o.estado.trim()).filter(Boolean))).sort(),
    [orders],
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.estado.trim() !== statusFilter) return false;
      if (!term) return true;
      return buildSearchText(o).includes(term);
    });
  }, [orders, searchTerm, statusFilter]);

  const {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination({ data: filtered, itemsPerPage });

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
              <span className="text-green-600 font-medium">Home</span>
              <span>/</span>
              <span>Pedidos Abbaco</span>
            </nav>

            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  Datos en crudo extraídos de Abbaco (snapshot). Información
                  provisional para visualizar pedidos en proceso; no está migrada
                  al sistema Camihogar.
                </div>
              </div>

              {!canView ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    No tienes permiso para ver esta sección.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Pedidos Abbaco</CardTitle>
                    <CardDescription>
                      Pedidos pendientes del sistema anterior (Abbaco)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 items-center mb-4">
                      <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          placeholder="Buscar por código, cliente, RIF, teléfono, descripción…"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Todos los estados" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          {statusOptions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="text-sm text-muted-foreground ml-auto">
                        {isLoading
                          ? "Cargando…"
                          : `${totalItems.toLocaleString("es-VE")} pedidos`}
                      </span>
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Cargando pedidos Abbaco…
                      </div>
                    ) : error ? (
                      <div className="py-10 text-center text-red-600">
                        {error}
                      </div>
                    ) : totalItems === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">
                        No se encontraron pedidos
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8" />
                                <TableHead>Código</TableHead>
                                <TableHead>Tercero</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Facturado</TableHead>
                                <TableHead>Líneas</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedData.map((order) => {
                                const isOpen = expanded.has(order.abaccoId);
                                return (
                                  <FragmentRow
                                    key={order.abaccoId}
                                    order={order}
                                    isOpen={isOpen}
                                    onToggle={() => toggleRow(order.abaccoId)}
                                  />
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
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function FragmentRow({
  order,
  isOpen,
  onToggle,
}: {
  order: AbbacoOrderView;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
        title={isOpen ? "Contraer" : "Expandir"}
      >
        <TableCell>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium whitespace-nowrap">
          {order.codigo}
        </TableCell>
        <TableCell>{order.tercero}</TableCell>
        <TableCell className="whitespace-nowrap">{order.fechaPedido}</TableCell>
        <TableCell className="whitespace-nowrap">
          {order.importeTotal} {normalizeDivisa(order.divisa)}
        </TableCell>
        <TableCell>
          <Badge className={cn("whitespace-nowrap", estadoColor(order.estado))}>
            {order.estado || "—"}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn(
              "whitespace-nowrap",
              order.facturado.trim().toLowerCase() === "sí" ||
                order.facturado.trim().toLowerCase() === "si"
                ? "text-green-700 border-green-500"
                : "text-muted-foreground",
            )}
          >
            {order.facturado || "—"}
          </Badge>
        </TableCell>
        <TableCell>{order.lines.length}</TableCell>
      </TableRow>

      {isOpen && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30">
            <div className="grid gap-4 md:grid-cols-2 py-2">
              <div className="text-sm space-y-1">
                <h4 className="font-semibold text-foreground">Cliente</h4>
                {order.client ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Nombre:</span>{" "}
                      {order.client.nombre}
                    </p>
                    <p>
                      <span className="text-muted-foreground">RIF / C.I:</span>{" "}
                      {order.client.rif || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Teléfono:</span>{" "}
                      {order.client.telefono || "—"}
                      {order.client.telefono2 ? ` / ${order.client.telefono2}` : ""}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Correo:</span>{" "}
                      {order.client.correo || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Dirección:</span>{" "}
                      {order.client.direccion || "—"}
                    </p>
                    {(order.client.poblacion || order.client.pais) && (
                      <p>
                        <span className="text-muted-foreground">Ubicación:</span>{" "}
                        {[order.client.poblacion, order.client.pais]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Cliente no encontrado</p>
                )}

                <div className="pt-2">
                  <h4 className="font-semibold text-foreground">Resumen</h4>
                  <p>
                    <span className="text-muted-foreground">Autor:</span>{" "}
                    {order.autor}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Base imponible:</span>{" "}
                    {order.baseImponible || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">IVA:</span>{" "}
                    {order.importeIva || "—"}
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <h4 className="font-semibold text-foreground mb-2">
                  Líneas ({order.lines.length})
                </h4>
                {order.lines.length === 0 ? (
                  <p className="text-muted-foreground">Sin líneas registradas</p>
                ) : (
                  <div className="space-y-1.5">
                    {order.lines.map((line, i) => (
                      <div
                        key={`${order.abaccoId}-${line.linea}-${i}`}
                        className="rounded border border-border p-2"
                      >
                        <p className="font-medium">{line.descripcion}</p>
                        <p className="text-muted-foreground text-xs">
                          Precio: {line.precio || "—"} · Cantidad:{" "}
                          {line.cantidad || "—"} · Descuento: {line.descuento || "—"}{" "}
                          · Total: {line.total || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
