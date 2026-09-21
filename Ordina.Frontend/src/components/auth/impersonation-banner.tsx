"use client";

import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonation } = useAuth();
  const queryClient = useQueryClient();

  if (!isImpersonating || !user) {
    return null;
  }

  const handleStop = async () => {
    stopImpersonation();
    await queryClient.invalidateQueries();
    toast.success("Has regresado a tu sesión de Superadministrador");
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950 px-4 py-2 shadow-md flex items-center justify-between text-sm font-medium transition-all animate-in fade-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        <ShieldAlert className="w-5 h-5 shrink-0 text-amber-950" />
        <span>
          Modo Impersonación: Estás operando como{" "}
          <strong className="underline underline-offset-2">{user.name || user.username}</strong>{" "}
          <span className="opacity-90 font-normal">({user.role})</span>
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleStop}
        className="bg-amber-950 text-amber-50 hover:bg-amber-900 border-amber-800 shrink-0 ml-4 font-semibold shadow-sm"
      >
        <LogOut className="w-4 h-4 mr-1.5" />
        Finalizar impersonación
      </Button>
    </div>
  );
}
