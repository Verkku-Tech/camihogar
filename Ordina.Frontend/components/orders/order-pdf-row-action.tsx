"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  getOrder,
  getOrderFromCache,
  getClient,
  getClientFromCache,
  type Order,
  type Client,
} from "@/lib/storage";
import { FileText, Loader2 } from "lucide-react";
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
  /** Pedido ya cargado (p. ej. desde lista); evita peticiones por fila. */
  order?: Order | null;
  /** Cliente ya cargado (p. ej. mapa de la página de pedidos). */
  client?: Client | null;
  /**
   * Si true y faltan datos, no se consulta la API al montar; solo al usar PDF.
   * Por defecto false cuando no hay `order` (intenta IndexedDB al montar).
   */
  lazyLoad?: boolean;
};

/** Botón PDF en tablas: solo pedidos (no presupuesto); incluye Generado/Generada. */
export function OrderPdfRowAction({
  orderId,
  orderType,
  order: orderProp,
  client: clientProp,
  lazyLoad = false,
}: Props) {
  const eligible = orderType === "order";

  const [order, setOrder] = useState<Order | null>(orderProp ?? null);
  const [client, setClient] = useState<Client | null>(clientProp ?? null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setOrder(orderProp ?? null);
  }, [orderProp]);

  useEffect(() => {
    setClient(clientProp ?? null);
  }, [clientProp]);

  const resolveClient = useCallback(
    async (o: Order): Promise<Client | null> => {
      if (clientProp) return clientProp;
      if (client && client.id === o.clientId) return client;
      if (!o.clientId) return null;
      const cached = await getClientFromCache(o.clientId);
      if (cached) return cached;
      return (await getClient(o.clientId)) ?? null;
    },
    [clientProp, client],
  );

  const ensureOrderAndClient = useCallback(async (): Promise<boolean> => {
    if (!eligible) return false;
    setLoading(true);
    setLoadError(false);
    try {
      let o = order ?? orderProp ?? null;
      if (!o) {
        o = (await getOrderFromCache(orderId)) ?? null;
      }
      if (!o) {
        o = (await getOrder(orderId)) ?? null;
      }
      if (!o) {
        setLoadError(true);
        return false;
      }
      setOrder(o);
      const c = await resolveClient(o);
      setClient(c);
      return true;
    } catch {
      setLoadError(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [eligible, order, orderProp, orderId, resolveClient]);

  useEffect(() => {
    if (!eligible || orderProp || lazyLoad) return;
    let cancelled = false;
    (async () => {
      const cached = await getOrderFromCache(orderId);
      if (cancelled) return;
      if (cached) {
        setOrder(cached);
        if (clientProp) {
          setClient(clientProp);
        } else if (cached.clientId) {
          const c = await getClientFromCache(cached.clientId);
          if (!cancelled) setClient(c ?? null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eligible, orderId, orderProp, clientProp, lazyLoad]);

  if (!eligible) return null;

  if (order) {
    return (
      <OrderPdfDownloadButton order={order} client={client} compact />
    );
  }

  if (loading) {
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

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      disabled={loadError}
      title={
        loadError
          ? "No se pudo cargar el pedido para PDF"
          : "Descargar PDF del pedido"
      }
      aria-label="Descargar PDF del pedido"
      onClick={() => void ensureOrderAndClient()}
    >
      <FileText className="h-4 w-4" />
    </Button>
  );
}
