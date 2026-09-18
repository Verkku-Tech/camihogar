"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { DashboardHeader } from "./dashboard-header";
import { MetricsCards } from "./metrics-cards";
import { OrdersTable } from "./orders-table";
import { ManufacturingProductsTable } from "./manufacturing-products-table";
import { BudgetsTable } from "./budgets-table";
import { DispatchesTable } from "./dispatches-table";
import { ExpiredLayawaysTable } from "./expired-layaways-table";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import {
  DashboardMetrics,
  orderFromBackendDto,
  type Order,
  type UnifiedOrder,
} from "@/lib/storage";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { NewOrderDialog } from "@/components/orders/new-order-dialog";
import { useAuth } from "@/contexts/auth-context";

type Period = "day" | "week" | "month" | "year";
type Tab =
  | "presupuestos"
  | "pedidos"
  | "fabricacion"
  | "despachos"
  | "sa-vencidos";

export function Dashboard() {
  const { user } = useAuth();
  const isOnlineSeller = user?.role === "Online Seller";
  const canViewFinancialDashboard =
    user?.role === "Super Administrator" || user?.role === "Administrator";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("day");
  const [activeTab, setActiveTab] = useState<Tab>("pedidos");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

  /** Datos por pestaña, cargados desde la API con filtros server-side. */
  const [generatedOrders, setGeneratedOrders] = useState<Order[] | null>(null);
  const [manufacturingOrders, setManufacturingOrders] = useState<Order[] | null>(null);
  const [dispatchOrders, setDispatchOrders] = useState<UnifiedOrder[] | null>(null);
  const [saOrders, setSaOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadPerTab = async () => {
      try {
        // Orders tab: status Generado/Generada
        const ordersResp = await apiClient.getOrdersPaged(
          1, 50, undefined,
          { status: "Generado", includeBudgets: false },
          controller.signal,
        );
        if (!cancelled) {
          setGeneratedOrders(ordersResp.orders.map(orderFromBackendDto));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error loading generated orders:", error);
        if (!cancelled) setGeneratedOrders([]);
      }

      try {
        // Manufacturing tab: locationStatus FABRICACION, exclude Generado/Generada/Declinado
        const mfgResp = await apiClient.getOrdersPaged(
          1, 50, undefined,
          {
            locationStatus: "FABRICACION",
            excludeStatuses: "Generado,Generada,Declinado",
            includeBudgets: false,
          },
          controller.signal,
        );
        if (!cancelled) {
          setManufacturingOrders(mfgResp.orders.map(orderFromBackendDto));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error loading manufacturing orders:", error);
        if (!cancelled) setManufacturingOrders([]);
      }

      try {
        // Dispatches tab: por_despachar preset, no budgets
        const dispatchResp = await apiClient.getOrdersPaged(
          1, 50, undefined,
          { productFilterPreset: "por_despachar", includeBudgets: false },
          controller.signal,
        );
        if (!cancelled) {
          setDispatchOrders(dispatchResp.orders.map(orderFromBackendDto) as unknown as UnifiedOrder[]);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error loading dispatch orders:", error);
        if (!cancelled) setDispatchOrders([]);
      }

      try {
        // SA vencidos tab: solo SA con >90 días (filtrado server-side via dateTo)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const saDateTo = ninetyDaysAgo.toISOString().split('T')[0];

        const saResp = await apiClient.getOrdersPaged(
          1, 200, undefined,
          {
            saleType: "sistema_apartado",
            dateTo: saDateTo,
            includeBudgets: false,
          },
          controller.signal,
        );
        if (!cancelled) {
          setSaOrders(saResp.orders.map(orderFromBackendDto));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error loading SA orders:", error);
        if (!cancelled) setSaOrders([]);
      }
    };

    void loadPerTab();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (isOnlineSeller) {
      setActiveTab("pedidos");
    }
  }, [isOnlineSeller]);

  useEffect(() => {
    if (!canViewFinancialDashboard) {
      setMetrics(null);
      setIsLoadingMetrics(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    const loadMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        const data = await apiClient.getDashboardMetrics(period, controller.signal);
        if (!cancelled) {
          setMetrics(data);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Error loading dashboard metrics:", error);
      } finally {
        if (!cancelled) setIsLoadingMetrics(false);
      }
    };

    void loadMetrics();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [period, canViewFinancialDashboard]);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Period;
    setPeriod(value);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
            <span className="text-green-600 font-medium">Home</span>
            <span>/</span>
            <span>Dashboard</span>
          </nav>

          {/* Dashboard Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Últimos Pedidos</p>
            </div>
            {canViewFinancialDashboard && (
              <div className="flex items-center gap-4 mt-4 sm:mt-0">
                <select
                  value={period}
                  onChange={handlePeriodChange}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                >
                  <option value="day">Hoy</option>
                  <option value="week">Última Semana</option>
                  <option value="month">Último Mes</option>
                  <option value="year">Último Año</option>
                </select>
              </div>
            )}
          </div>

          {/* Metrics Cards: solo Administrador / Super Administrador */}
          {canViewFinancialDashboard && (
            <MetricsCards
              metrics={
                metrics ?? {
                  completedOrders: 0,
                  completedOrdersChange: null,
                  totalSalesCount: 0,
                  totalInvoiced: 0,
                  totalInvoicedChange: null,
                  totalCollected: 0,
                  totalCollectedChange: null,
                  averageOrderValue: 0,
                  averageOrderValueChange: null,
                  pendingPayments: 0,
                  pendingPaymentsChange: null,
                  expiredLayawaysCount: 0,
                  expiredLayawaysAmount: 0,
                  productsToManufacture: 0,
                  productsToManufactureChange: null,
                }
              }
              isLoading={isLoadingMetrics || !metrics}
            />
          )}

          {/* Orders Section */}
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="flex items-center space-x-1 mb-4 sm:mb-0">
                {isOnlineSeller ? (
                  <span className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground">
                    Pedidos
                  </span>
                ) : (
                  <>
                    {/* OCULTO TEMPORALMENTE - Presupuestos (lógica preservada)
                    <button
                      onClick={() => setActiveTab("presupuestos")}
                      className={`px-4 py-2 text-sm rounded-md transition-colors ${
                        activeTab === "presupuestos"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      Presupuestos
                    </button>
                    */}
                    <button
                      onClick={() => setActiveTab("pedidos")}
                      className={`px-4 py-2 text-sm rounded-md transition-colors ${
                        activeTab === "pedidos"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      Pedidos
                    </button>
                    <button
                      onClick={() => setActiveTab("fabricacion")}
                      className={`px-4 py-2 text-sm rounded-md transition-colors ${
                        activeTab === "fabricacion"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      Fabricación
                    </button>
                    <button
                      onClick={() => setActiveTab("despachos")}
                      className={`px-4 py-2 text-sm rounded-md transition-colors ${
                        activeTab === "despachos"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      Notas de Despacho
                    </button>
                    <button
                      onClick={() => setActiveTab("sa-vencidos")}
                      className={`px-4 py-2 text-sm rounded-md transition-colors ${
                        activeTab === "sa-vencidos"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      SA Vencidos
                    </button>
                  </>
                )}
              </div>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setIsNewOrderOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Pedido
              </Button>
            </div>

            {/* Tab Content */}
            {activeTab === "pedidos" &&
              (generatedOrders === null ? (
                <Card>
                  <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    Cargando pedidos…
                  </CardContent>
                </Card>
              ) : (
                <OrdersTable prefetchedOrders={generatedOrders} />
              ))}
            {/* OCULTO TEMPORALMENTE - Presupuestos
            {!isOnlineSeller && activeTab === "presupuestos" && (
              <BudgetsTable />
            )}
            */}
            {!isOnlineSeller && activeTab === "fabricacion" && (
              <ManufacturingProductsTable prefetchedOrders={manufacturingOrders} />
            )}
            {!isOnlineSeller && activeTab === "despachos" && (
              <DispatchesTable prefetchedOrders={dispatchOrders} />
            )}
            {!isOnlineSeller && activeTab === "sa-vencidos" && (
              <ExpiredLayawaysTable prefetchedOrders={saOrders} />
            )}
          </div>
        </main>
      </div>

      {/* New Order Dialog */}
      <NewOrderDialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen} />
    </div>
  );
}
