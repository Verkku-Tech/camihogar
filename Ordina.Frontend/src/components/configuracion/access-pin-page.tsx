"use client";

import { useCallback, useEffect, useState } from "react";
import { PinGeneratorCard } from "@/components/pin/pin-generator-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient, type AccessPinHistoryItemDto } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Activo";
    case "used":
      return "Usado";
    case "expired":
      return "Expirado";
    default:
      return status;
  }
}

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "used":
      return "secondary";
    case "expired":
      return "outline";
    default:
      return "outline";
  }
}

export function AccessPinPage() {
  const [items, setItems] = useState<AccessPinHistoryItemDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getAccessPinHistory(page, 20);
      setItems(res.items);
      setTotalCount(res.totalCount);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el historial de PINs");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">PIN de acceso</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Genera códigos temporales para que los vendedores editen productos al
          confirmar reservas.
        </p>
      </div>

      <PinGeneratorCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No hay PINs registrados aún.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PIN</TableHead>
                    <TableHead>Generado por</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Usado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono">{row.pinMasked}</TableCell>
                      <TableCell>{row.generatedByUserName}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)}>
                          {statusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.orderId ? row.orderId.slice(-8) : "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString("es-VE")}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {row.usedAt
                          ? new Date(row.usedAt).toLocaleString("es-VE")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
