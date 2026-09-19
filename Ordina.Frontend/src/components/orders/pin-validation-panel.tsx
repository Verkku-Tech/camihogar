"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PinValidationPanelProps {
  onValidate: (pin: string) => Promise<boolean>;
  isValidating: boolean;
  onCancel?: () => void;
}

export function PinValidationPanel({
  onValidate,
  isValidating,
  onCancel,
}: PinValidationPanelProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async () => {
    if (value.length !== 6) {
      toast.error("Ingresa el PIN de 6 dígitos");
      return;
    }
    const ok = await onValidate(value);
    if (ok) {
      toast.success("PIN válido. Puedes editar la reserva.");
      setValue("");
    } else {
      toast.error("PIN inválido o expirado. Solicita uno nuevo al administrador.");
    }
  };

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-4 bg-muted/20">
      <div className="space-y-1">
        <Label htmlFor="access-pin-otp">Código de acceso</Label>
        <p className="text-xs text-muted-foreground">
          Pega o escribe el PIN de 6 dígitos que te proporcionó el administrador.
        </p>
      </div>
      <div className="flex justify-center">
        <InputOTP
          id="access-pin-otp"
          maxLength={6}
          value={value}
          onChange={setValue}
          disabled={isValidating}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={isValidating || value.length !== 6}
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validando…
            </>
          ) : (
            "Validar PIN"
          )}
        </Button>
      </div>
    </div>
  );
}
