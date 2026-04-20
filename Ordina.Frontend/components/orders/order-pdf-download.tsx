"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { OrderPdfDocument } from "./order-pdf-document";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import type { Order, Client } from "@/lib/storage";

export function OrderPdfDownloadButton({
  order,
  client,
}: {
  order: Order;
  client: Client | null;
}) {
  return (
    <PDFDownloadLink
      document={<OrderPdfDocument order={order} client={client} />}
      fileName={`Pedido-${order.orderNumber}.pdf`}
    >
      {({ loading }) => (
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
      )}
    </PDFDownloadLink>
  );
}
