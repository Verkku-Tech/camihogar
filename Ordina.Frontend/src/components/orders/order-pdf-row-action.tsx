"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  getOrder,
  getOrderFromCache,
  getClient,
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
  /** Pedido ya cargado (p. ej. desde lista); evita IndexedDB desactualizado. */
  order?: Order | null;
  /** Cliente del mapa de la página; se complementa con getClient si falta. */
  client?: Client | null;
  /**
   * Si true y faltan datos, no se consulta la API al montar; solo al usar PDF.
   */
  lazyLoad?: boolean;
};

function clientMatchesOrder(c: Client | null | undefined, clientId: string) {
  return Boolean(c && c.id === clientId);
}

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
  const [client, setClient] = useState<Client | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setOrder(orderProp ?? null);
  }, [orderProp]);

  const resolveClient = useCallback(
    async (o: Order): Promise<Client | null> => {
      if (!o.clientId) return null;
      if (clientMatchesOrder(clientProp, o.clientId)) return clientProp!;
      if (clientMatchesOrder(client, o.clientId)) return client;
      return (await getClient(o.clientId)) ?? null;
    },
    [clientProp, client],
  );

  const loadOrderAndClient = useCallback(async () => {
    if (!eligible) return false;
    setLoading(true);
    setLoadError(false);
    setDataReady(false);
    try {
      let o = orderProp ?? order ?? null;
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
      setDataReady(true);
      return true;
    } catch {
      setLoadError(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [eligible, order, orderProp, orderId, resolveClient]);

  useEffect(() => {
    if (!eligible || lazyLoad) return;

    let cancelled = false;

    (async () => {
      setDataReady(false);
      setLoadError(false);

      let o = orderProp ?? null;
      if (!o) {
        o = (await getOrderFromCache(orderId)) ?? null;
      }

      if (cancelled) return;

      if (!o) {
        setOrder(null);
        setClient(null);
        setDataReady(true);
        return;
      }

      setOrder(o);

      if (!o.clientId) {
        setClient(null);
        setDataReady(true);
        return;
      }

      if (clientMatchesOrder(clientProp, o.clientId)) {
        setClient(clientProp!);
        setDataReady(true);
        return;
      }

      try {
        const c = (await getClient(o.clientId)) ?? null;
        if (!cancelled) {
          setClient(c);
          setDataReady(true);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setDataReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eligible, orderId, orderProp, clientProp, lazyLoad]);

  if (!eligible) return null;

  if (order && dataReady) {
    return (
      <OrderPdfDownloadButton
        key={`${order.id}-${client?.id ?? "no-client"}`}
        order={order}
        client={client}
        compact
      />
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

  if (!dataReady && orderProp && !lazyLoad) {
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
      onClick={() => void loadOrderAndClient()}
    >
      <FileText className="h-4 w-4" />
    </Button>
  );
}
