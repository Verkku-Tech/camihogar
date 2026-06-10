"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getOrder, getClient, type Order, type Client } from "@/lib/storage";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const OrderPdfDownloadButton = dynamic(
  () =>
    import("@/components/orders/order-pdf-download").then(
      (m) => m.OrderPdfDownloadButton,
    ),
  { ssr: false },
);

type Props = {
  orderId: string;
  orderType: "order" | "budget";
  /** Cliente ya cargado (p. ej. mapa de la página de pedidos). */
  client?: Client | null;
};

/** Botón PDF en tablas: solo pedidos (no presupuesto); incluye Generado/Generada. */
export function OrderPdfRowAction({
  orderId,
  orderType,
  client: clientProp,
}: Props) {
  const eligible = orderType === "order";

  const [order, setOrder] = useState<Order | null>(null);
  const [client, setClient] = useState<Client | null>(clientProp ?? null);

  useEffect(() => {
    setClient(clientProp ?? null);
  }, [clientProp]);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    (async () => {
      const o = await getOrder(orderId);
      if (cancelled || !o) return;
      setOrder(o);
      if (clientProp) return;
      if (o.clientId) {
        const c = await getClient(o.clientId);
        if (!cancelled) setClient(c ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, eligible, clientProp]);

  if (!eligible) return null;

  if (!order) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        disabled
        aria-hidden
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Button>
    );
  }

  return <OrderPdfDownloadButton order={order} client={client} compact />;
}
