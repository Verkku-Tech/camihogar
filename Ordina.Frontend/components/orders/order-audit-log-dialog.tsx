"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  apiClient,
  type OrderAuditLogDto,
  type UserResponseDto,
} from "@/lib/api-client";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Factory,
  Loader2,
  Package,
  RotateCcw,
} from "lucide-react";
import { normalizeOrderNumberForAuditFilter } from "@/lib/order-audit-filter";
import {
  formatAuditAction,
  getDisplayField,
  getDisplayNewValue,
  getDisplayOldValue,
  getSummaryPreview,
  groupChangesByProduct,
} from "@/lib/audit-log-labels";

type AppliedAuditFilters = {
  userId: string;
  orderNumber: string;
  action: string;
  from: string;
  to: string;
};

const defaultApplied: AppliedAuditFilters = {
  userId: "__all__",
  orderNumber: "",
  action: "__all__",
  from: "",
  to: "",
};

const ACTION_OPTIONS = [
  { value: "__all__", label: "Todas las acciones" },
  { value: "created", label: "Creado" },
  { value: "updated", label: "Actualizado" },
  { value: "deleted", label: "Eliminado" },
  { value: "payment_conciliated", label: "Conciliación pagos" },
  { value: "item_validated", label: "Ítem validado" },
  { value: "manufacturing_queued", label: "Enviado a reporte de fabricación" },
  { value: "manufacturing_started", label: "Inició fabricación" },
  { value: "manufacturing_completed", label: "Completó fabricación" },
  { value: "manufacturing_reverted", label: "Devuelto a reporte de fabricación" },
];

function formatAction(a: string) {
  return ACTION_OPTIONS.find((o) => o.value === a)?.label ?? formatAuditAction(a);
}

function AuditActionIcon({ action }: { action: string }) {
  switch (action) {
    case "manufacturing_started":
      return <Factory className="h-4 w-4 shrink-0 text-orange-600" />;
    case "manufacturing_completed":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
    case "manufacturing_queued":
      return <Package className="h-4 w-4 shrink-0 text-amber-600" />;
    case "manufacturing_reverted":
      return <RotateCcw className="h-4 w-4 shrink-0 text-amber-700" />;
    case "item_validated":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />;
    default:
      return <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

export interface OrderAuditLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 10;
const TIMELINE_PAGE_SIZE = 100;

export function OrderAuditLogDialog({
  open,
  onOpenChange,
}: OrderAuditLogDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [users, setUsers] = useState<UserResponseDto[]>([]);
  const [logs, setLogs] = useState<OrderAuditLogDto[]>([]);
  const [timelineLogs, setTimelineLogs] = useState<OrderAuditLogDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [filterUserId, setFilterUserId] = useState<string>("__all__");
  const [filterOrderNumber, setFilterOrderNumber] = useState("");
  const [filterAction, setFilterAction] = useState<string>("__all__");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [appliedFilters, setAppliedFilters] =
    useState<AppliedAuditFilters>(defaultApplied);

  const [detailLog, setDetailLog] = useState<OrderAuditLogDto | null>(null);

  const showTimeline = appliedFilters.orderNumber.trim().length > 0;

  const loadUsers = useCallback(async () => {
    try {
      const list = await apiClient.getUsers();
      setUsers(list);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadUsers();
    }
  }, [open, loadUsers]);

  useEffect(() => {
    if (open) return;
    setPage(1);
    setAppliedFilters({ ...defaultApplied });
    setFilterUserId(defaultApplied.userId);
    setFilterOrderNumber(defaultApplied.orderNumber);
    setFilterAction(defaultApplied.action);
    setFilterFrom(defaultApplied.from);
    setFilterTo(defaultApplied.to);
    setTimelineLogs([]);
  }, [open]);

  const buildQueryParams = useCallback(
    (opts: { page: number; pageSize: number; sortAscending?: boolean }) => {
      const orderQuery = appliedFilters.orderNumber.trim()
        ? normalizeOrderNumberForAuditFilter(appliedFilters.orderNumber)
        : "";

      return {
        page: opts.page,
        pageSize: opts.pageSize,
        userId:
          appliedFilters.userId && appliedFilters.userId !== "__all__"
            ? appliedFilters.userId
            : undefined,
        orderNumber: orderQuery || undefined,
        action:
          appliedFilters.action && appliedFilters.action !== "__all__"
            ? appliedFilters.action
            : undefined,
        from: appliedFilters.from
          ? new Date(appliedFilters.from).toISOString()
          : undefined,
        to: appliedFilters.to
          ? new Date(appliedFilters.to).toISOString()
          : undefined,
        sortAscending: opts.sortAscending,
      };
    },
    [appliedFilters],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getOrderAuditLogs(
          buildQueryParams({ page, pageSize: PAGE_SIZE }),
        );
        if (!cancelled) {
          setLogs(res.items);
          setTotalPages(Math.max(1, res.totalPages));
          setTotalCount(res.totalCount);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : "Error al cargar auditoría",
          );
          setLogs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, page, buildQueryParams]);

  useEffect(() => {
    if (!open || !showTimeline) {
      setTimelineLogs([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setTimelineLoading(true);
      try {
        const res = await apiClient.getOrderAuditLogs(
          buildQueryParams({
            page: 1,
            pageSize: TIMELINE_PAGE_SIZE,
            sortAscending: true,
          }),
        );
        if (!cancelled) {
          setTimelineLogs(res.items);
        }
      } catch {
        if (!cancelled) setTimelineLogs([]);
      } finally {
        if (!cancelled) setTimelineLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, showTimeline, buildQueryParams]);

  const detailGroups = useMemo(
    () => groupChangesByProduct(detailLog?.changes ?? []),
    [detailLog],
  );

  const handleApplyFilters = () => {
    const normOrder = filterOrderNumber.trim()
      ? normalizeOrderNumberForAuditFilter(filterOrderNumber)
      : "";
    setFilterOrderNumber(normOrder);
    setAppliedFilters({
      userId: filterUserId,
      orderNumber: normOrder,
      action: filterAction,
      from: filterFrom,
      to: filterTo,
    });
    setPage(1);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auditoría de pedidos</DialogTitle>
            <DialogDescription>
              Registro de quién hizo qué y cuándo sobre los pedidos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Usuario</Label>
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Número de pedido</Label>
              <Input
                value={filterOrderNumber}
                onChange={(e) => setFilterOrderNumber(e.target.value)}
                placeholder="ORD-001 o 038"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyFilters();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Usa <span className="font-medium">Aplicar filtros</span> o Enter
                para buscar. Acepta ORD-xxx o solo el número (se normaliza, p. ej.{" "}
                <span className="whitespace-nowrap">038 → ORD-038</span>).
              </p>
            </div>
            <div className="space-y-1">
              <Label>Acción</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input
                type="datetime-local"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input
                type="datetime-local"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={handleApplyFilters}>
                Aplicar filtros
              </Button>
            </div>
          </div>

          {showTimeline && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Secuencia del pedido {appliedFilters.orderNumber}
                </h3>
                {timelineLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {timelineLogs.length === 0 && !timelineLoading ? (
                <p className="text-sm text-muted-foreground">
                  No hay eventos para este pedido.
                </p>
              ) : (
                <ol className="space-y-0 border-l-2 border-primary/30 ml-2 pl-4">
                  {timelineLogs.map((log) => (
                    <li key={`tl-${log.id}`} className="relative pb-4 last:pb-0">
                      <span className="absolute -left-[1.35rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border-2 border-primary/40">
                        <AuditActionIcon action={log.action} />
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                        {" · "}
                        {log.userName}
                      </div>
                      <div className="text-sm font-medium mt-0.5">{log.summary}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatAction(log.action)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {totalCount > TIMELINE_PAGE_SIZE && (
                <p className="text-xs text-muted-foreground">
                  Mostrando los primeros {TIMELINE_PAGE_SIZE} eventos en orden cronológico.
                </p>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Resumen</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay registros
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const preview = getSummaryPreview(log);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs align-top">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm align-top">{log.userName}</TableCell>
                        <TableCell className="align-top">
                          <button
                            type="button"
                            className="text-primary underline font-medium text-left"
                            onClick={() =>
                              router.push(
                                `/pedidos/${encodeURIComponent(log.orderNumber)}`,
                              )
                            }
                          >
                            {log.orderNumber}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm align-top">
                          {formatAction(log.action)}
                        </TableCell>
                        <TableCell className="max-w-[320px] text-sm align-top break-words">
                          <div>{log.summary}</div>
                          {preview && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {preview}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailLog(log)}
                            disabled={!log.changes?.length}
                          >
                            Detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Total: {totalCount} · Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailLog} onOpenChange={(o) => !o && setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de cambios</DialogTitle>
            <DialogDescription>{detailLog?.summary}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {detailGroups.map((group) => (
              <div key={group.key} className="rounded-md border p-3 space-y-2">
                <p className="font-semibold">
                  {group.productName
                    ? `Producto: ${group.productName}`
                    : "Pedido"}
                </p>
                <ul className="space-y-2">
                  {group.changes.map((c, i) => (
                    <li key={`${group.key}-${i}`} className="space-y-1">
                      <div className="font-medium">{getDisplayField(c)}</div>
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <span>{getDisplayOldValue(c)}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-foreground font-medium">
                          {getDisplayNewValue(c)}
                        </span>
                      </div>
                      <p
                        className="text-xs text-muted-foreground/80 truncate"
                        title={`${c.field}: ${c.oldValue ?? "—"} → ${c.newValue ?? "—"}`}
                      >
                        Técnico: {c.field}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
