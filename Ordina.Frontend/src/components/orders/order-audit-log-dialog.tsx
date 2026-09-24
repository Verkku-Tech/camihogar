"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
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
  apiClient,
  type OrderAuditLogDto,
  type UserResponseDto,
} from "@/lib/api-client";
import { toast } from "sonner";
import { History, Search } from "lucide-react";
import { normalizeOrderNumberForAuditFilter } from "@/lib/order-audit-filter";
import { AuditTimelineItem } from "./audit-timeline/audit-timeline-item";
import { AuditTimelineSkeleton } from "./audit-timeline/audit-timeline-skeleton";

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
  { value: "order_declined", label: "Pedido declinado" },
  { value: "order_decline_reverted", label: "Declinación revertida" },
  { value: "manufacturing_queued", label: "Enviado a reporte de fabricación" },
  { value: "manufacturing_started", label: "Inició fabricación" },
  { value: "manufacturing_completed", label: "Completó fabricación" },
  { value: "manufacturing_reverted", label: "Devuelto a reporte de fabricación" },
];

export interface OrderAuditLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 10;

export function OrderAuditLogDialog({
  open,
  onOpenChange,
}: OrderAuditLogDialogProps): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserResponseDto[]>([]);
  const [logs, setLogs] = useState<OrderAuditLogDto[]>([]);
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
    if (!open) {
      setPage(1);
      setAppliedFilters({ ...defaultApplied });
      setFilterUserId(defaultApplied.userId);
      setFilterOrderNumber(defaultApplied.orderNumber);
      setFilterAction(defaultApplied.action);
      setFilterFrom(defaultApplied.from);
      setFilterTo(defaultApplied.to);
    }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border/80 shadow-2xl">
        {/* Dialog Header */}
        <DialogHeader className="p-5 px-6 border-b border-border/50 bg-card/40 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <History className="w-4 h-4 text-emerald-500" />
              </div>
              Auditoría de pedidos
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Registro histórico detallado de quién realizó qué cambios y cuándo sobre cada pedido.
          </DialogDescription>
        </DialogHeader>

        {/* Filter Bar */}
        <div className="p-4 px-6 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Usuario
              </Label>
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger className="h-9 text-xs bg-background border-border/70">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los usuarios</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Número de pedido
              </Label>
              <div className="relative">
                <Input
                  value={filterOrderNumber}
                  onChange={(e) => setFilterOrderNumber(e.target.value)}
                  placeholder="ORD-001 o 1642"
                  className="h-9 text-xs font-mono pr-8 bg-background border-border/70"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyFilters();
                    }
                  }}
                />
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-3" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Acción
              </Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="h-9 text-xs bg-background border-border/70">
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

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Desde
              </Label>
              <Input
                type="datetime-local"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="h-9 text-xs bg-background border-border/70"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Hasta
              </Label>
              <Input
                type="datetime-local"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="h-9 text-xs bg-background border-border/70"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-all cursor-pointer"
                onClick={handleApplyFilters}
              >
                Aplicar filtros
              </Button>
            </div>
          </div>
        </div>

        {/* Timeline Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 max-h-[550px] bg-background">
          {loading ? (
            <AuditTimelineSkeleton count={4} />
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-border/60 bg-muted/20">
              <History className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-foreground">
                No se encontraron registros de auditoría
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Pruebe ajustando los filtros de usuario, número de pedido o rango de fechas.
              </p>
            </div>
          ) : (
            <div className="relative pl-8 space-y-4 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-0.5 before:bg-border/60">
              {logs.map((log) => (
                <AuditTimelineItem
                  key={log.id}
                  log={log}
                  onSelectOrder={(orderNum) => {
                    onOpenChange(false);
                    router.push(`/pedidos/${encodeURIComponent(orderNum)}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dialog Footer with Pagination */}
        <div className="p-4 px-6 border-t border-border/50 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div>
            Total: <span className="font-semibold text-foreground font-mono">{totalCount}</span> registros · Página{" "}
            <span className="font-semibold text-foreground font-mono">{page}</span> de{" "}
            <span className="font-semibold text-foreground font-mono">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium cursor-pointer"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium cursor-pointer"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
