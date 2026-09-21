"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Edit, Trash2, KeyRound, User as UserIcon, Search } from "lucide-react";
import { PinValidationPanel } from "@/components/orders/pin-validation-panel";
import { Badge } from "@/components/ui/badge";
import { CommissionLineSourceBadge } from "@/components/orders/commission-line-source-badge";
import type { UseOrderFormReturn } from "../hooks/use-order-form";
import { formatCurrency, type Currency } from "@/lib/currency-utils";
import {
  commercialRatesToExchangeRatesInput,
  formatCommercialDualDisplay,
  formatDualCurrencyAmounts,
} from "@/lib/order-currency-display";
import { cn } from "@/lib/utils";
import {
  getLineDiscountInBaseCurrency,
  getLinePriceCurrency,
  getProductDiscountCurrencyForTotals,
  normalizeMonetaryAmountFromLegacy,
  ORDER_BASE_CURRENCY,
} from "@/lib/order-line-pricing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/contexts/currency-context";
import { useAuth } from "@/contexts/auth-context";

function roundDisplayAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

type Step1OrderForm = UseOrderFormReturn & {
  commercialExchangeRates?: { USD?: { rate: number }; EUR?: { rate: number } };
  formBaseCurrency?: Currency;
};

function formatStep1Money(
  orderForm: Step1OrderForm,
  amount: number,
  amountCurrency: Currency,
): string {
  const commercial = orderForm.commercialExchangeRates
    ? commercialRatesToExchangeRatesInput(orderForm.commercialExchangeRates)
    : undefined;
  return formatCommercialDualDisplay(amount, amountCurrency, {
    commercialRates: commercial,
    liveRates: orderForm.exchangeRates,
  });
}

function Step1MoneyDisplay({
  orderForm,
  amount,
  amountCurrency,
  primaryClassName = "font-medium text-sm text-foreground",
  secondaryClassName = "text-xs text-muted-foreground font-normal block leading-tight",
  align = "right",
}: {
  orderForm: Step1OrderForm;
  amount: number;
  amountCurrency: Currency;
  primaryClassName?: string;
  secondaryClassName?: string;
  align?: "left" | "right" | "center";
}) {
  const commercial = orderForm.commercialExchangeRates
    ? commercialRatesToExchangeRatesInput(orderForm.commercialExchangeRates)
    : undefined;
  const { primary, secondary } = formatDualCurrencyAmounts(
    amount,
    amountCurrency,
    {
      commercialRates: commercial,
      liveRates: orderForm.exchangeRates,
    },
  );

  return (
    <div
      className={cn(
        "flex flex-col min-w-0 leading-tight",
        align === "right"
          ? "items-end text-right"
          : align === "center"
            ? "items-center text-center"
            : "items-start text-left",
      )}
    >
      <span className={primaryClassName}>{primary}</span>
      {secondary && <span className={secondaryClassName}>{secondary}</span>}
    </div>
  );
}

function ProductDiscountControl({
  product,
  orderForm,
  rates,
  lineBase,
  preferredCurrency,
  isMobile = false,
}: {
  product: any;
  orderForm: UseOrderFormReturn;
  rates: any;
  lineBase: number;
  preferredCurrency: Currency;
  isMobile?: boolean;
}) {
  const discount = product.discount || 0;
  const discountType = orderForm.productDiscountTypes[product.id] || "monto";
  const discountCurrency =
    orderForm.productDiscountCurrencies[product.id] || preferredCurrency;
  const discountInputCurrency = discountCurrency;

  const currentMode =
    discountType === "porcentaje" ? "porcentaje" : discountCurrency;

  const handleModeChange = (newMode: string) => {
    if (newMode === "porcentaje") {
      if (discountType !== "porcentaje") {
        orderForm.handleProductDiscountTypeChange(product.id, "porcentaje");
      }
      return;
    }

    const newCurrency = newMode as Currency;
    if (discountType === "porcentaje") {
      orderForm.handleProductDiscountTypeChange(product.id, "monto");
    }

    orderForm.setProductDiscountCurrencies((prev) => ({
      ...prev,
      [product.id]: newCurrency,
    }));

    if (discountCurrency !== newCurrency && discountType === "monto") {
      let discountInNewCurrency = discount;
      if (discountCurrency === "Bs") {
        const rate =
          newCurrency === "USD"
            ? orderForm.exchangeRates.USD?.rate
            : orderForm.exchangeRates.EUR?.rate;
        if (rate && rate > 0) discountInNewCurrency = discount / rate;
      } else if (newCurrency === "Bs") {
        const rate =
          discountCurrency === "USD"
            ? orderForm.exchangeRates.USD?.rate
            : orderForm.exchangeRates.EUR?.rate;
        if (rate && rate > 0) discountInNewCurrency = discount * rate;
      } else {
        const currentRate =
          discountCurrency === "USD"
            ? orderForm.exchangeRates.USD?.rate
            : orderForm.exchangeRates.EUR?.rate;
        const newRate =
          newCurrency === "USD"
            ? orderForm.exchangeRates.USD?.rate
            : orderForm.exchangeRates.EUR?.rate;
        if (currentRate && newRate && currentRate > 0) {
          discountInNewCurrency = (discount * currentRate) / newRate;
        }
      }
      orderForm.handleProductDiscountChange(
        product.id,
        discountInNewCurrency,
        { inputCurrency: newCurrency },
      );
    }
  };

  const maxValue = (() => {
    if (discountType === "porcentaje") return 100;
    const category = orderForm.categories.find(
      (cat) => cat.name === product.category,
    );
    if (category && category.maxDiscount > 0) {
      let maxDiscountInBs = category.maxDiscount;
      if (
        category.maxDiscountCurrency &&
        category.maxDiscountCurrency !== "Bs"
      ) {
        const rate =
          category.maxDiscountCurrency === "USD"
            ? orderForm.exchangeRates.USD?.rate
            : orderForm.exchangeRates.EUR?.rate;
        if (rate && rate > 0) {
          maxDiscountInBs = category.maxDiscount * rate;
        }
      }
      return Math.min(lineBase, maxDiscountInBs);
    }
    return lineBase;
  })();

  const displayValue = (() => {
    if (discount === 0) return "";
    if (discountType === "porcentaje") {
      const percentage = lineBase > 0 ? (discount / lineBase) * 100 : 0;
      return Math.round(percentage * 100) / 100;
    }
    return roundDisplayAmount(
      normalizeMonetaryAmountFromLegacy(discount, discountCurrency, rates),
    );
  })();

  return (
    <div
      className={cn(
        "flex flex-col gap-1 min-w-0",
        isMobile ? "w-full" : "items-center",
      )}
    >
      <div
        className={cn(
          "flex items-center rounded-lg border bg-background shadow-2xs transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
          isMobile ? "w-full h-10" : "w-[145px] h-8",
        )}
      >
        <Select value={currentMode} onValueChange={handleModeChange}>
          <SelectTrigger
            className={cn(
              "border-0 bg-muted/40 hover:bg-muted/70 px-2 font-semibold text-muted-foreground hover:text-foreground rounded-r-none focus:ring-0 focus:ring-offset-0 shrink-0 transition-colors",
              isMobile ? "w-[80px] h-10 text-sm" : "w-[62px] h-8 text-xs",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">$ USD</SelectItem>
            <SelectItem value="Bs">Bs.</SelectItem>
            <SelectItem value="porcentaje">%</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          min="0"
          step={discountType === "porcentaje" ? "1" : "0.01"}
          max={maxValue}
          value={displayValue}
          onChange={(e) =>
            orderForm.handleProductDiscountChange(
              product.id,
              Number.parseFloat(e.target.value) || 0,
              { inputCurrency: discountInputCurrency },
            )
          }
          className={cn(
            "border-0 rounded-l-none text-right font-medium focus-visible:ring-0 shadow-none flex-1 min-w-0 pr-2.5",
            isMobile ? "h-10 text-sm" : "h-8 text-xs",
          )}
          placeholder={
            discountType === "porcentaje" ? "0%" : "0.00"
          }
        />
      </div>
      {discountType === "porcentaje" && discount > 0 && (
        <span className="text-[11px] text-muted-foreground/80 leading-tight">
          −{formatCurrency(discount, "Bs")}
        </span>
      )}
    </div>
  );
}

function getStep1TotalsCurrency(orderForm: Step1OrderForm): Currency {
  return orderForm.formBaseCurrency ?? ORDER_BASE_CURRENCY;
}

interface Step1BudgetProps {
  orderForm: UseOrderFormReturn;
  onClientLookup: () => void;
  onProductSelection: () => void;
  onEditProduct: (product: any) => void;
  onRemoveProduct: (product: any) => void;
  /** Si true, el referidor se muestra solo lectura (p. ej. confirmación de reserva en tienda). */
  referrerLocked?: boolean;
  /** Requiere PIN para editar productos (confirmación de reserva, vendedor tienda). */
  pinEditMode?: boolean;
  pinSessionActive?: boolean;
  pinRemainingFormatted?: string;
  showPinPanel?: boolean;
  onTogglePinPanel?: () => void;
  onValidatePin?: (pin: string) => Promise<boolean>;
  isValidatingPin?: boolean;
}

export function Step1Budget({
  orderForm,
  onClientLookup,
  onProductSelection,
  onEditProduct,
  onRemoveProduct,
  referrerLocked = false,
  pinEditMode = false,
  pinSessionActive = false,
  pinRemainingFormatted,
  showPinPanel = false,
  onTogglePinPanel,
  onValidatePin,
  isValidatingPin = false,
}: Step1BudgetProps) {
  const { preferredCurrency } = useCurrency();
  const { user } = useAuth();
  const isStoreSeller = user?.role === "Store Seller";
  const isOnlineSeller = user?.role === "Online Seller";

  const canEditProducts = !pinEditMode || pinSessionActive;
  const showPinGate = pinEditMode && !pinSessionActive;

  const vendorDisplayName =
    orderForm.mockVendors.find((v) => v.id === orderForm.formData.vendor)?.name ?? "";
  const referrerDisplayName =
    orderForm.mockReferrers.find((r) => r.id === orderForm.formData.referrer)?.name ??
    user?.name ??
    "";

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-4 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">Presupuesto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-4 sm:p-6">
          {/* Vendedor / Referidor (según rol) */}
          <div className="space-y-3">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendedor</Label>
                {isStoreSeller ||
                (isOnlineSeller && orderForm.onlineSellerMode !== "referrer") ? (
                  <Input readOnly id="vendor" value={vendorDisplayName} />
                ) : isOnlineSeller && orderForm.onlineSellerMode === "referrer" ? (
                  <Input
                    readOnly
                    id="vendor"
                    value=""
                    placeholder="Asignado en tienda al aprobar"
                  />
                ) : (
                  <Select
                    value={orderForm.formData.vendor}
                    onValueChange={(value) =>
                      orderForm.setFormData((prev) => ({ ...prev, vendor: value }))
                    }
                  >
                    <SelectTrigger id="vendor">
                      <SelectValue placeholder="Seleccionar vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderForm.mockVendors
                        .filter((vendor) => vendor.id && vendor.id.trim() !== "")
                        .map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="referrer">Referidor</Label>
                {referrerLocked ? (
                  <Input readOnly id="referrer" value={referrerDisplayName || "—"} />
                ) : isOnlineSeller && orderForm.onlineSellerMode === "referrer" ? (
                  <Input readOnly id="referrer" value={referrerDisplayName} />
                ) : (
                  <Select
                    value={orderForm.formData.referrer}
                    onValueChange={(value) =>
                      orderForm.setFormData((prev) => ({ ...prev, referrer: value }))
                    }
                  >
                    <SelectTrigger id="referrer">
                      <SelectValue placeholder="Seleccionar referidor" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderForm.mockReferrers
                        .filter((referrer) => referrer.id && referrer.id.trim() !== "")
                        .map((referrer) => (
                          <SelectItem key={referrer.id} value={referrer.id}>
                            {referrer.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Cliente</Label>
            <div
              onClick={onClientLookup}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClientLookup();
                }
              }}
              className={cn(
                "flex items-center justify-between gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                orderForm.selectedClient
                  ? "bg-primary/5 border-primary/30 hover:bg-primary/10 hover:border-primary/50 shadow-xs"
                  : "bg-muted/20 border-dashed border-border hover:bg-muted/50 hover:border-border/80"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "p-2 rounded-full shrink-0 transition-colors",
                    orderForm.selectedClient
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  {orderForm.selectedClient ? (
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {orderForm.selectedClient.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {orderForm.selectedClient.rutId || orderForm.selectedClient.telefono || "Cliente registrado"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Haz clic para buscar o crear un cliente...
                    </span>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant={orderForm.selectedClient ? "secondary" : "outline"}
                size="sm"
                className="shrink-0 text-xs h-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onClientLookup();
                }}
              >
                <Search className="w-3.5 h-3.5 mr-1.5" />
                {orderForm.selectedClient ? "Cambiar" : "Buscar cliente"}
              </Button>
            </div>
          </div>

          {/* Products Table */}
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <Label>Productos</Label>
                {pinEditMode && pinSessionActive && pinRemainingFormatted && (
                  <Badge variant="secondary" className="text-xs">
                    Edición habilitada — {pinRemainingFormatted}
                  </Badge>
                )}
              </div>
              {showPinGate ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={onTogglePinPanel}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  Editar reserva
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={onProductSelection}
                  disabled={!orderForm.canAddProduct || !canEditProducts}
                  title={
                    showPinGate
                      ? "Solicita un PIN al administrador para modificar productos"
                      : !orderForm.selectedClient
                        ? "Selecciona un cliente para agregar productos"
                        : !orderForm.step1SellerReady
                          ? "Selecciona vendedor o activa modo referidor (Online) para agregar productos"
                          : ""
                  }
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Producto
                </Button>
              )}
            </div>
            {showPinGate && (
              <p className="text-xs text-muted-foreground">
                Solicita un PIN al administrador para modificar productos de esta
                reserva.
              </p>
            )}
            {showPinGate && showPinPanel && onValidatePin && (
              <PinValidationPanel
                onValidate={onValidatePin}
                isValidating={isValidatingPin}
                onCancel={onTogglePinPanel}
              />
            )}
            {!orderForm.canAddProduct && (
              <p className="text-xs text-muted-foreground">
                {!orderForm.selectedClient
                  ? "⚠️ Debes seleccionar un cliente para agregar productos"
                  : !orderForm.step1SellerReady
                  ? "⚠️ Debes indicar vendedor o modo referidor antes de agregar productos"
                  : ""}
              </p>
            )}

            {orderForm.selectedProducts.length > 0 ? (
              <>
                {/* Vista de tarjetas: móvil y tablet (< lg) */}
                <div className="space-y-4 lg:hidden">
                  {orderForm.selectedProducts.map((product) => {
                    const lineBase = orderForm.getProductLineBase(product);
                    const lineSurcharge = orderForm.getProductLineSurcharge(product);
                    const rates = commercialRatesToExchangeRatesInput(
                      orderForm.commercialExchangeRates ?? orderForm.exchangeRates,
                    );
                    const formBase = getStep1TotalsCurrency(
                      orderForm as Step1OrderForm,
                    );
                    const finalTotal = orderForm.getProductBaseTotal(product);

                    return (
                      <Card key={product.id} className="p-4 rounded-xl border border-border/70 shadow-xs bg-card">
                        <div className="space-y-3.5">
                          <div className="flex items-start justify-between gap-3 border-b pb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="font-semibold text-base text-foreground">
                                  {product.name}
                                </span>
                                <CommissionLineSourceBadge
                                  source={product.commissionLineSource}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Cantidad: <span className="font-semibold text-foreground">{product.quantity || 1}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs text-muted-foreground uppercase font-medium">Total final</div>
                              <Step1MoneyDisplay
                                orderForm={orderForm as Step1OrderForm}
                                amount={finalTotal}
                                amountCurrency={getStep1TotalsCurrency(orderForm)}
                                primaryClassName="text-base font-bold text-emerald-600 dark:text-emerald-400"
                                secondaryClassName="text-xs text-emerald-600/70 dark:text-emerald-400/70"
                                align="right"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 bg-muted/20 p-2.5 rounded-lg border border-border/40 text-xs sm:text-sm">
                            <div>
                              <span className="text-muted-foreground block text-[11px] uppercase">Precio unitario:</span>
                              <Step1MoneyDisplay
                                orderForm={orderForm as Step1OrderForm}
                                amount={product.price}
                                amountCurrency={getLinePriceCurrency(product)}
                                primaryClassName="font-medium text-foreground text-xs sm:text-sm"
                                secondaryClassName="text-[11px] text-muted-foreground"
                                align="left"
                              />
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px] uppercase">Subtotal base:</span>
                              <Step1MoneyDisplay
                                orderForm={orderForm as Step1OrderForm}
                                amount={lineBase}
                                amountCurrency={formBase}
                                primaryClassName="font-medium text-foreground text-xs sm:text-sm"
                                secondaryClassName="text-[11px] text-muted-foreground"
                                align="left"
                              />
                            </div>
                            {lineSurcharge > 0 && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground block text-[11px] uppercase">Sobreprecio:</span>
                                <Step1MoneyDisplay
                                  orderForm={orderForm as Step1OrderForm}
                                  amount={lineSurcharge}
                                  amountCurrency={formBase}
                                  primaryClassName="font-medium text-foreground text-xs sm:text-sm"
                                  secondaryClassName="text-[11px] text-muted-foreground"
                                  align="left"
                                />
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descuento</Label>
                            <ProductDiscountControl
                              product={product}
                              orderForm={orderForm}
                              rates={rates}
                              lineBase={lineBase}
                              preferredCurrency={preferredCurrency}
                              isMobile={true}
                            />
                          </div>

                          {canEditProducts && (
                            <div className="flex gap-2 pt-2 border-t">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditProduct(product);
                                }}
                                className="flex-1 h-9 font-medium"
                              >
                                <Edit className="w-3.5 h-3.5 mr-1.5" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveProduct(product);
                                }}
                                className="flex-1 h-9 font-medium text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Eliminar
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Vista de tabla: solo pantallas grandes (lg+) */}
                <div className="hidden lg:block overflow-x-auto rounded-lg border">
                  <div className="w-full min-w-0">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wider">Producto</TableHead>
                          <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-right">Precio</TableHead>
                          <TableHead className="w-[7%] text-xs font-semibold uppercase tracking-wider text-center">Cant.</TableHead>
                          <TableHead className="w-[10%] text-xs font-semibold uppercase tracking-wider text-right">Sobreprecio</TableHead>
                          <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-right">Subtotal</TableHead>
                          <TableHead className="w-[17%] text-xs font-semibold uppercase tracking-wider text-center">Descuento</TableHead>
                          <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-right text-emerald-600 dark:text-emerald-400">Total final</TableHead>
                          <TableHead className="w-[8%] text-xs font-semibold uppercase tracking-wider text-right pr-4">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderForm.selectedProducts.map((product) => {
                          const lineBase = orderForm.getProductLineBase(product);
                          const lineSurcharge = orderForm.getProductLineSurcharge(product);
                          const rates = commercialRatesToExchangeRatesInput(
                            orderForm.commercialExchangeRates ?? orderForm.exchangeRates,
                          );
                          const formBase = getStep1TotalsCurrency(
                            orderForm as Step1OrderForm,
                          );
                          const finalTotal = orderForm.getProductBaseTotal(product);

                          return (
                            <TableRow key={product.id} className="hover:bg-muted/20">
                              <TableCell className="w-[22%] py-3">
                                <div className="flex flex-col gap-1 min-w-0">
                                  <span className="truncate text-sm font-semibold text-foreground">
                                    {product.name}
                                  </span>
                                  <CommissionLineSourceBadge
                                    source={product.commissionLineSource}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="w-[12%] text-right py-3">
                                <Step1MoneyDisplay
                                  orderForm={orderForm as Step1OrderForm}
                                  amount={product.price}
                                  amountCurrency={getLinePriceCurrency(product)}
                                  primaryClassName="text-sm font-medium text-foreground"
                                  secondaryClassName="text-xs text-muted-foreground font-normal"
                                  align="right"
                                />
                              </TableCell>
                              <TableCell className="w-[7%] text-center py-3">
                                <span className="font-semibold text-sm px-2 py-0.5 rounded bg-muted/60 text-foreground">
                                  {product.quantity || 1}
                                </span>
                              </TableCell>
                              <TableCell className="w-[10%] text-right py-3">
                                {lineSurcharge > 0 ? (
                                  <Step1MoneyDisplay
                                    orderForm={orderForm as Step1OrderForm}
                                    amount={lineSurcharge}
                                    amountCurrency={formBase}
                                    primaryClassName="text-sm font-medium text-foreground"
                                    secondaryClassName="text-xs text-muted-foreground font-normal"
                                    align="right"
                                  />
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="w-[12%] text-right py-3">
                                <Step1MoneyDisplay
                                  orderForm={orderForm as Step1OrderForm}
                                  amount={lineBase}
                                  amountCurrency={formBase}
                                  primaryClassName="text-sm font-medium text-foreground"
                                  secondaryClassName="text-xs text-muted-foreground font-normal"
                                  align="right"
                                />
                              </TableCell>
                              <TableCell className="w-[17%] py-3">
                                <ProductDiscountControl
                                  product={product}
                                  orderForm={orderForm}
                                  rates={rates}
                                  lineBase={lineBase}
                                  preferredCurrency={preferredCurrency}
                                  isMobile={false}
                                />
                              </TableCell>
                              <TableCell className="w-[12%] text-right py-3">
                                <Step1MoneyDisplay
                                  orderForm={orderForm as Step1OrderForm}
                                  amount={finalTotal}
                                  amountCurrency={getStep1TotalsCurrency(orderForm)}
                                  primaryClassName="text-sm font-bold text-emerald-600 dark:text-emerald-400"
                                  secondaryClassName="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-normal"
                                  align="right"
                                />
                              </TableCell>
                              <TableCell className="w-[8%] text-right pr-3 py-3">
                                {canEditProducts && (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onEditProduct(product)}
                                      className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                      title="Editar producto"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onRemoveProduct(product)}
                                      className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      title="Eliminar producto"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-sm sm:text-base text-muted-foreground">
                No hay productos seleccionados
              </div>
            )}
          </div>

          {/* Subtotal */}
          <div className="flex justify-end pt-2">
            <div className="flex items-center gap-4 bg-muted/40 border border-border/70 rounded-xl px-4 py-3 shadow-2xs">
              <span className="text-sm sm:text-base font-medium text-muted-foreground">
                Subtotal (después de descuentos):
              </span>
              <Step1MoneyDisplay
                orderForm={orderForm as Step1OrderForm}
                amount={
                  orderForm.subtotalAfterProductDiscounts +
                  orderForm.productSurchargeTotal
                }
                amountCurrency={getStep1TotalsCurrency(orderForm)}
                primaryClassName="text-base sm:text-xl font-bold text-emerald-600 dark:text-emerald-400"
                secondaryClassName="text-xs sm:text-sm text-emerald-600/70 dark:text-emerald-400/70 font-medium"
                align="right"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
