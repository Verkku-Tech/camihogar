import type { ReactNode } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Order, Client, PartialPayment } from "@/lib/storage";
import {
  getActivePaymentsList,
  getOrderPendingTotal,
} from "@/lib/order-payments";
import {
  formatCurrency,
  normalizeExchangeRatesAtCreation,
  type Currency,
} from "@/lib/currency-utils";
import {
  DISCOUNT_UI_CURRENCY_KEY,
  DISCOUNT_UI_PERCENT_KEY,
  DISCOUNT_UI_TYPE_KEY,
} from "@/lib/product-discount-ui";

/** Ajuste en UI o variables de entorno según tienda; valores por defecto para encabezado del PDF. */
export const DEFAULT_ORDER_PDF_COMPANY = {
  name: "Ordina",
  subtitle: "Pedido confirmado",
  address: "",
  phone: "",
  email: "",
} as const;

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111",
  },
  headerBlock: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  muted: { fontSize: 8, color: "#555" },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 6,
  },
  grid2: {
    flexDirection: "row",
    gap: 24,
  },
  col: { flex: 1 },
  label: { fontSize: 8, color: "#666", marginBottom: 2 },
  value: { fontSize: 9, marginBottom: 4 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 4,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 5,
  },
  colDesc: { width: "42%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "22%", textAlign: "right" },
  colTot: { width: "26%", textAlign: "right" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  td: { fontSize: 8 },
  totalsBox: {
    marginTop: 10,
    alignSelf: "flex-end",
    width: "55%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 9,
  },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  smallNote: { fontSize: 7, color: "#666", marginTop: 3, fontStyle: "italic" },
  amountPrimary: { fontSize: 8, textAlign: "right" },
  amountSecondary: { fontSize: 7, color: "#555", textAlign: "right", marginTop: 1 },
});

const PDF_INTERNAL_ATTR_KEYS = new Set([
  DISCOUNT_UI_TYPE_KEY,
  DISCOUNT_UI_CURRENCY_KEY,
  DISCOUNT_UI_PERCENT_KEY,
]);

function getUsdRateFromOrder(order: Order): number | undefined {
  const n = normalizeExchangeRatesAtCreation(
    order.exchangeRatesAtCreation as Parameters<
      typeof normalizeExchangeRatesAtCreation
    >[0],
  );
  const r = n?.USD?.rate;
  return r != null && r > 0 ? r : undefined;
}

/** Monto original en la moneda del pago (alineado con la vista del pedido). */
function getOriginalPaymentAmountForPdf(
  payment: PartialPayment,
  order: Order,
): { amount: number; currency: Currency } {
  const usdRate = getUsdRateFromOrder(order);
  const eurN = normalizeExchangeRatesAtCreation(
    order.exchangeRatesAtCreation as Parameters<
      typeof normalizeExchangeRatesAtCreation
    >[0],
  );
  const eurRate = eurN?.EUR?.rate;

  if (payment.method === "Efectivo" && payment.paymentDetails?.cashReceived) {
    const c = (payment.paymentDetails.cashCurrency ||
      payment.currency ||
      "Bs") as Currency;
    return {
      amount: payment.paymentDetails.cashReceived,
      currency: c === "EUR" || c === "USD" || c === "Bs" ? c : "Bs",
    };
  }
  if (payment.paymentDetails?.originalAmount !== undefined) {
    const c = (payment.paymentDetails.originalCurrency ||
      payment.currency ||
      "Bs") as Currency;
    return {
      amount: payment.paymentDetails.originalAmount,
      currency: c === "EUR" || c === "USD" || c === "Bs" ? c : "Bs",
    };
  }
  const paymentCurrency = (payment.currency || "Bs") as Currency;
  if (paymentCurrency === "Bs") {
    return { amount: payment.amount, currency: "Bs" };
  }
  const rate =
    payment.paymentDetails?.exchangeRate ??
    (paymentCurrency === "USD"
      ? usdRate
      : paymentCurrency === "EUR"
        ? eurRate
        : undefined);
  if (rate && rate > 0) {
    return {
      amount: payment.amount / rate,
      currency: paymentCurrency,
    };
  }
  return { amount: payment.amount, currency: "Bs" };
}

/**
 * Misma lógica que el detalle del pedido: USD (tasa del pedido) + Bs de referencia, o solo Bs si no hay tasa.
 */
function getOrderLineAmountPair(
  amountInBs: number,
  usdRate: number | undefined,
): { primary: string; secondary?: string } {
  if (usdRate && usdRate > 0) {
    return {
      primary: formatCurrency(amountInBs / usdRate, "USD"),
      secondary: formatCurrency(amountInBs, "Bs"),
    };
  }
  return { primary: formatCurrency(amountInBs, "Bs") };
}

function OrderAmountBlock({
  amountInBs,
  usdRate,
  align = "right",
}: {
  amountInBs: number;
  usdRate: number | undefined;
  align?: "left" | "right";
}) {
  const { primary, secondary } = getOrderLineAmountPair(amountInBs, usdRate);
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <Text style={styles.amountPrimary}>{primary}</Text>
      {secondary ? (
        <Text style={styles.amountSecondary}>{secondary}</Text>
      ) : null}
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatAttributes(
  attrs?: Record<string, string | number | string[]>,
): string {
  if (!attrs || Object.keys(attrs).length === 0) return "";
  return Object.entries(attrs)
    .filter(
      ([k]) =>
        !PDF_INTERNAL_ATTR_KEYS.has(k) &&
        !k.toLowerCase().startsWith("discountui")
    )
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join(", ") : String(v);
      return `${k}: ${val}`;
    })
    .join(" · ");
}

function paymentSummaryLine(p: PartialPayment): string {
  const lines: string[] = [p.method];
  const d = p.paymentDetails;
  if (!d) return lines.join(" ");
  if (p.method === "Zelle" && d.envia?.trim()) {
    lines.push(`Remitente: ${d.envia.trim()}`);
  }
  if (d.pagomovilReference)
    lines.push(`Ref. ${d.pagomovilReference}`);
  if (d.transferenciaReference)
    lines.push(`Ref. ${d.transferenciaReference}`);
  if (d.cardReference) lines.push(`Ref. ${d.cardReference}`);
  return lines.filter(Boolean).join(" — ");
}

function PaymentAmountCell({
  payment: p,
  order,
  usdRate,
}: {
  payment: PartialPayment;
  order: Order;
  usdRate: number | undefined;
}) {
  const orig = getOriginalPaymentAmountForPdf(p, order);
  const line1 = formatCurrency(orig.amount, orig.currency);
  const wrap = (inner: ReactNode) => (
    <View style={{ flex: 0.9, alignItems: "flex-end" }}>{inner}</View>
  );
  if (orig.currency === "Bs" && usdRate && usdRate > 0) {
    return wrap(
      <>
        <Text style={styles.amountPrimary}>{line1}</Text>
        <Text style={styles.amountSecondary}>
          (≈ {formatCurrency(orig.amount / usdRate, "USD")})
        </Text>
      </>
    );
  }
  if (
    (orig.currency === "USD" || orig.currency === "EUR") &&
    p.amount != null
  ) {
    return wrap(
      <>
        <Text style={styles.amountPrimary}>{line1}</Text>
        <Text style={styles.amountSecondary}>
          {formatCurrency(p.amount, "Bs")}
        </Text>
      </>
    );
  }
  return wrap(<Text style={styles.amountPrimary}>{line1}</Text>);
}

type CompanyInfo = {
  name: string;
  subtitle?: string;
  address?: string;
  phone?: string;
  email?: string;
};

export function OrderPdfDocument({
  order,
  client,
  company,
}: {
  order: Order;
  client: Client | null;
  company?: CompanyInfo;
}) {
  const co = { ...DEFAULT_ORDER_PDF_COMPANY, ...company };
  const products = order.products ?? [];
  const payments = getActivePaymentsList(order);
  const usdRate = getUsdRateFromOrder(order);
  const pendingBs = getOrderPendingTotal(order);
  const paidBs = Math.max(0, order.total - pendingBs);

  const addressForDelivery =
    order.deliveryAddress?.trim() ||
    client?.direccion?.trim() ||
    "—";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBlock}>
          <Text style={styles.companyName}>{co.name}</Text>
          {co.subtitle ? (
            <Text style={styles.muted}>{co.subtitle}</Text>
          ) : null}
          {co.address ? <Text style={styles.muted}>{co.address}</Text> : null}
          <Text style={styles.muted}>
            {[
              co.phone && `Tel. ${co.phone}`,
              co.email && co.email,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
            Pedido {order.orderNumber}
          </Text>
          <Text style={styles.muted}>
            Estado: {order.status} · Creado: {formatDate(order.createdAt)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Cliente</Text>
        <View style={styles.grid2}>
          <View style={styles.col}>
            <Text style={styles.label}>Nombre / razón social</Text>
            <Text style={styles.value}>{order.clientName}</Text>
            {client?.rutId ? (
              <>
                <Text style={styles.label}>RIF / Documento</Text>
                <Text style={styles.value}>{client.rutId}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.col}>
            {client?.telefono ? (
              <>
                <Text style={styles.label}>Teléfono</Text>
                <Text style={styles.value}>{client.telefono}</Text>
              </>
            ) : null}
            {client?.telefono2 ? (
              <>
                <Text style={styles.label}>Teléfono 2</Text>
                <Text style={styles.value}>{client.telefono2}</Text>
              </>
            ) : null}
            {client?.email ? (
              <>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{client.email}</Text>
              </>
            ) : null}
          </View>
        </View>
        <Text style={styles.label}>Dirección de entrega / fiscal</Text>
        <Text style={styles.value}>{addressForDelivery}</Text>

        <Text style={styles.sectionTitle}>Productos</Text>
        {usdRate ? (
          <Text style={[styles.muted, { marginBottom: 4 }]}>
            Montos con referencia: USD a la tasa Bs/USD del pedido (1 USD ={" "}
            {formatCurrency(usdRate, "Bs")}).
          </Text>
        ) : (
          <Text style={[styles.muted, { marginBottom: 4 }]}>
            Montos en bolívares (no hay tasa USD guardada en el pedido).
          </Text>
        )}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDesc]}>Descripción</Text>
          <Text style={[styles.th, styles.colQty]}>Cant.</Text>
          <Text style={[styles.th, styles.colUnit]}>P. unit.</Text>
          <Text style={[styles.th, styles.colTot]}>Subtotal línea</Text>
        </View>
        {products.map((p) => {
          const extra = [
            formatAttributes(p.attributes),
            p.observations ? `Obs.: ${p.observations}` : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <View key={p.id} style={styles.tableRow} wrap={false}>
              <View style={styles.colDesc}>
                <Text style={styles.td}>{p.name}</Text>
                {extra ? (
                  <Text style={[styles.smallNote, { marginTop: 2 }]}>
                    {extra}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.td, styles.colQty]}>{p.quantity}</Text>
              <View style={[styles.colUnit, { paddingRight: 2 }]}>
                <OrderAmountBlock
                  amountInBs={p.price}
                  usdRate={usdRate}
                />
              </View>
              <View style={[styles.colTot, { paddingLeft: 2 }]}>
                <OrderAmountBlock
                  amountInBs={p.total}
                  usdRate={usdRate}
                />
              </View>
            </View>
          );
        })}

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <OrderAmountBlock amountInBs={order.subtotal} usdRate={usdRate} />
          </View>
          <View style={styles.totalRow}>
            <Text>IVA / impuestos</Text>
            <OrderAmountBlock
              amountInBs={order.taxAmount ?? 0}
              usdRate={usdRate}
            />
          </View>
          <View style={styles.totalRow}>
            <Text>Delivery / envío</Text>
            <OrderAmountBlock
              amountInBs={order.deliveryCost ?? 0}
              usdRate={usdRate}
            />
          </View>
          <View style={styles.totalGrand}>
            <Text>Total</Text>
            <OrderAmountBlock amountInBs={order.total} usdRate={usdRate} />
          </View>
          <View style={styles.totalRow}>
            <Text>Pagado</Text>
            <OrderAmountBlock amountInBs={paidBs} usdRate={usdRate} />
          </View>
          <View style={styles.totalRow}>
            <Text>Resta por pagar</Text>
            <OrderAmountBlock amountInBs={pendingBs} usdRate={usdRate} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Pagos registrados</Text>
        <View
          style={[
            styles.tableHeader,
            { flexDirection: "row", paddingBottom: 4 },
          ]}
        >
          <Text style={[styles.th, { flex: 1.1 }]}>Fecha</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Método</Text>
          <Text style={[styles.th, { flex: 2.2 }]}>Detalle</Text>
          <Text style={[styles.th, { flex: 0.9, textAlign: "right" }]}>
            Monto
          </Text>
        </View>
        {payments.length === 0 ? (
          <Text style={[styles.td, { marginTop: 4 }]}>
            Sin pagos registrados en el pedido.
          </Text>
        ) : (
          payments.map((p) => (
            <View
              key={p.id}
              style={[styles.tableRow, { alignItems: "flex-start" }]}
              wrap={false}
            >
              <Text style={[styles.td, { flex: 1.1 }]}>{formatDate(p.date)}</Text>
              <Text style={[styles.td, { flex: 1.2 }]}>{p.method}</Text>
              <Text style={[styles.td, { flex: 2.2 }]}>
                {paymentSummaryLine(p)}
                {p.paymentDetails?.casheaFinancedPortion
                  ? " (financiación Cashea)"
                  : ""}
              </Text>
              <PaymentAmountCell
                payment={p}
                order={order}
                usdRate={usdRate}
              />
            </View>
          ))
        )}

        {order.observations ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
              Observaciones del pedido
            </Text>
            <Text style={styles.td}>{order.observations}</Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}
