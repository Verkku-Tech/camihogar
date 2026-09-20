"use client";

import { Button } from "@/components/ui/button";
import {
  Menu,
  Calculator,
  ScrollText,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { CurrencyCalculatorDialog } from "@/components/currency/currency-calculator-dialog";
import { OrderAuditLogDialog } from "@/components/orders/order-audit-log-dialog";
import { OrderSearchCombobox } from "@/components/dashboard/order-search-combobox";

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export function DashboardHeader({
  onMenuClick,
}: DashboardHeaderProps) {
  const { user } = useAuth();
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  const canViewOrderAuditLogs =
    user?.role === "Super Administrator" || user?.role === "Administrator";

  const CalculatorButton = () => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsCalculatorOpen(true)}
      title="Calculadora de Divisas"
    >
      <Calculator className="w-5 h-5" />
    </Button>
  );

  const AuditLogButton = () =>
    canViewOrderAuditLogs ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsAuditLogOpen(true)}
        title="Auditoría de pedidos"
      >
        <ScrollText className="w-5 h-5" />
      </Button>
    ) : null;

  return (
    <header className="h-16 bg-background text-foreground border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8 pr-6 sm:pr-8 lg:pr-12 gap-4">
      <div className="flex items-center gap-4 min-w-[40px]">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 max-w-xl flex justify-center">
        <OrderSearchCombobox />
      </div>

      <div className="flex items-center gap-2 min-w-[40px] justify-end">
        <CalculatorButton />
        <AuditLogButton />
      </div>

      <CurrencyCalculatorDialog open={isCalculatorOpen} onOpenChange={setIsCalculatorOpen} />
      <OrderAuditLogDialog open={isAuditLogOpen} onOpenChange={setIsAuditLogOpen} />
    </header>
  );
}
