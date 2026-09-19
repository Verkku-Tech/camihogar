"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2 } from "lucide-react";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PinGeneratorCard() {
  const [pin, setPin] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (seconds: number) => {
      clearTimer();
      setRemainingSeconds(seconds);
      if (seconds <= 0) return;
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            clearTimer();
            setPin(null);
            return 0;
          }
          return next;
        });
      }, 1000);
    },
    [clearTimer],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await apiClient.generateAccessPin();
      setPin(result.pin);
      startCountdown(result.expiresInSeconds);
      toast.success("PIN generado. Compártelo con el vendedor.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el PIN.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!pin || remainingSeconds <= 0) return;
    try {
      await navigator.clipboard.writeText(pin);
      toast.success("PIN copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el PIN");
    }
  };

  const pinActive = pin != null && remainingSeconds > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-5 w-5" />
          Generación de PIN de acceso
        </CardTitle>
        <CardDescription>
          El PIN expira en 2 minutos. El vendedor tendrá 30 minutos para editar
          productos al confirmar una reserva.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generando…
            </>
          ) : (
            "Generar PIN"
          )}
        </Button>

        {pinActive && (
          <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Comparte este código con el vendedor
            </p>
            <p className="text-4xl font-mono font-bold tracking-[0.3em] text-center">
              {pin}
            </p>
            <p className="text-sm text-center text-amber-600 dark:text-amber-400">
              Expira en {formatCountdown(remainingSeconds)}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleCopy()}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar PIN
            </Button>
          </div>
        )}

        {pin && remainingSeconds <= 0 && (
          <p className="text-sm text-muted-foreground">
            El PIN expiró. Genera uno nuevo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
