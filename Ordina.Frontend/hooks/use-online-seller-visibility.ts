"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  isOrderOwnedByOnlineSeller,
  isOrderVisibleToOnlineSellerTeam,
  isOnlineSellerRole,
  type OrderLikeForOnlineVisibility,
} from "@/lib/order-online-seller-visibility";
import { getOnlineSellerUserIds } from "@/lib/storage";

export function useOnlineSellerVisibility() {
  const { user } = useAuth();
  const applies = isOnlineSellerRole(user?.role);
  const [onlineSellerIds, setOnlineSellerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isLoading, setIsLoading] = useState(applies);

  useEffect(() => {
    if (!applies) {
      setOnlineSellerIds(new Set());
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void getOnlineSellerUserIds().then((ids) => {
      if (!cancelled) {
        setOnlineSellerIds(ids);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applies]);

  const isTeamOrder = useCallback(
    (order: OrderLikeForOnlineVisibility) => {
      if (!applies) return true;
      if (isLoading) return false;
      return isOrderVisibleToOnlineSellerTeam(order, onlineSellerIds);
    },
    [applies, isLoading, onlineSellerIds],
  );

  const isOwnOrder = useCallback(
    (order: OrderLikeForOnlineVisibility) => {
      if (!applies) return true;
      const uid = user?.id?.trim();
      if (!uid) return false;
      return isOrderOwnedByOnlineSeller(order, uid);
    },
    [applies, user?.id],
  );

  return {
    applies,
    isLoading,
    onlineSellerIds,
    isTeamOrder,
    isOwnOrder,
  };
}
