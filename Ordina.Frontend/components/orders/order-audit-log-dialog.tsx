"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { normalizeOrderNumberForAuditFilter } from "@/lib/order-audit-filter";

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
];

function formatAction(a: string) {
  return ACTION_OPTIONS.find((o) => o.value === a)?.label ?? a;
}

export interface OrderAuditLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 10;

export function OrderAuditLogDialog({
  open,
  onOpenChange,
}: OrderAuditLogDialogProps) {
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

  /** Valores con los que se hizo la última búsqueda; solo se actualizan con «Aplicar» o al abrir el diálogo. */
  const [appliedFilters, setAppliedFilters] =
    useState<AppliedAuditFilters>(defaultApplied);

  const [detailLog, setDetailLog] = useState<OrderAuditLogDto | null>(null);

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
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const orderQuery = appliedFilters.orderNumber.trim()
          ? normalizeOrderNumberForAuditFilter(appliedFilters.orderNumber)
          : "";

        const res = await apiClient.getOrderAuditLogs({
          page,
          pageSize: PAGE_SIZE,
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
        });
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
  }, [open, page, appliedFilters]);

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
                  logs.map((log) => (
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
                      <TableCell className="max-w-[240px] text-sm align-top break-words">
                        {log.summary}
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
                  ))
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
          <ul className="space-y-2 text-sm">
            {detailLog?.changes?.map((c, i) => (
              <li key={i} className="border-b pb-2 last:border-0">
                <span className="font-medium">{c.field}</span>
                <div className="text-muted-foreground mt-1 break-words space-y-1">
                  <div>Antes: {c.oldValue ?? "—"}</div>
                  <div>Después: {c.newValue ?? "—"}</div>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
