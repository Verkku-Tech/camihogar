"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { OrderPdfDocument } from "./order-pdf-document";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import type { Order, Client } from "@/lib/storage";

export function OrderPdfDownloadButton({
  order,
  client,
  compact = false,
}: {
  order: Order;
  client: Client | null;
  /** Solo icono (p. ej. fila de tabla en lista de pedidos). */
  compact?: boolean;
}) {
  return (
    <PDFDownloadLink
      document={<OrderPdfDocument order={order} client={client} />}
      fileName={`Pedido-${order.orderNumber}.pdf`}
    >
      {({ loading }) =>
        compact ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={loading}
            title="Descargar PDF"
            aria-label="Descargar PDF del pedido"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Descargar PDF
              </>
            )}
          </Button>
        )
      }
    </PDFDownloadLink>
  );
}
