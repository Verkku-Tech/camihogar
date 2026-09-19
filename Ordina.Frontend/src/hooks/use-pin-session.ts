"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface UsePinSessionReturn {
  isActive: boolean;
  remainingSeconds: number;
  remainingFormatted: string;
  isLoading: boolean;
  isValidating: boolean;
  showPinPanel: boolean;
  setShowPinPanel: (open: boolean) => void;
  validatePin: (pin: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

export function usePinSession(
  orderId: string | null | undefined,
  enabled: boolean,
): UsePinSessionReturn {
  const [isActive, setIsActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showPinPanel, setShowPinPanel] = useState(false);
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
      setIsActive(seconds > 0);
      if (seconds <= 0) return;

      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            clearTimer();
            setIsActive(false);
            return 0;
          }
          return next;
        });
      }, 1000);
    },
    [clearTimer],
  );

  const refreshSession = useCallback(async () => {
    if (!enabled || !orderId) {
      setIsActive(false);
      setRemainingSeconds(0);
      return;
    }

    setIsLoading(true);
    try {
      const session = await apiClient.getAccessPinSession(orderId);
      if (session.active && session.remainingSeconds != null && session.remainingSeconds > 0) {
        startCountdown(session.remainingSeconds);
      } else {
        clearTimer();
        setIsActive(false);
        setRemainingSeconds(0);
      }
    } catch {
      clearTimer();
      setIsActive(false);
      setRemainingSeconds(0);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, orderId, startCountdown, clearTimer]);

  useEffect(() => {
    void refreshSession();
    return () => clearTimer();
  }, [refreshSession, clearTimer]);

  const validatePin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!orderId) return false;
      setIsValidating(true);
      try {
        const result = await apiClient.validateAccessPin(pin.trim(), orderId);
        startCountdown(result.sessionRemainingSeconds);
        setShowPinPanel(false);
        return true;
      } catch {
        return false;
      } finally {
        setIsValidating(false);
      }
    },
    [orderId, startCountdown],
  );

  return {
    isActive,
    remainingSeconds,
    remainingFormatted: formatRemaining(remainingSeconds),
    isLoading,
    isValidating,
    showPinPanel,
    setShowPinPanel,
    validatePin,
    refreshSession,
  };
}
