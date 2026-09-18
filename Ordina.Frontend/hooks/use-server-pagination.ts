"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseServerPaginationOptions<T> {
  /** Function to fetch a single page from API */
  fetchPage: (page: number, signal?: AbortSignal) => Promise<{
    items: T[];
    totalCount: number;
    totalPages: number;
  }>;
  /** Function to fetch total count (fast metadata endpoint) */
  fetchCount?: (signal?: AbortSignal) => Promise<{
    totalCount: number;
    totalPages: number;
  }>;
  /** Enabled flag (default: true) */
  enabled?: boolean;
  /** Items per page – when changed, the hook re-fetches from page 1 */
  itemsPerPage?: number;
  /** Legacy options preserved for backward compatibility */
  batchPages?: number;
  prefetchThreshold?: number;
}

interface UseServerPaginationResult<T> {
  pages: Map<number, T[]>;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  currentItems: T[];
  isLoading: boolean;
  isLoadingCount: boolean;
  isLoadingPages: boolean;
  loadingPages: Set<number>;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  cancel: () => void;
  refetch: () => void;
}

const isAbortError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  return (
    e.name === "AbortError" ||
    e.name === "CanceledError" ||
    (typeof e.message === "string" && e.message.toLowerCase().includes("abort"))
  );
};

export function useServerPagination<T>(
  options: UseServerPaginationOptions<T>,
): UseServerPaginationResult<T> {
  const {
    fetchPage,
    fetchCount,
    enabled = true,
    itemsPerPage,
  } = options;

  const [currentItems, setCurrentItems] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Track latest fetch callbacks to avoid unnecessary effect triggers
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const fetchCountRef = useRef(fetchCount);
  fetchCountRef.current = fetchCount;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Core fetch function for a specific page
  const loadData = useCallback(
    async (pageToLoad: number, isNewQuery: boolean) => {
      if (!enabled) return;

      // Abort any in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      if (isNewQuery) {
        setCurrentPage(1);
      }

      try {
        if (isNewQuery && fetchCountRef.current) {
          // Execute count and page 1 in parallel for fresh queries
          const [countRes, pageRes] = await Promise.all([
            fetchCountRef.current(controller.signal).catch((err) => {
              if (isAbortError(err)) throw err;
              console.error("useServerPagination: fetchCount error:", err);
              return { totalCount: 0, totalPages: 0 };
            }),
            fetchPageRef.current(pageToLoad, controller.signal).catch((err) => {
              if (isAbortError(err)) throw err;
              console.error("useServerPagination: fetchPage error:", err);
              return { items: [], totalCount: 0, totalPages: 0 };
            }),
          ]);

          if (mountedRef.current && !controller.signal.aborted) {
            const count =
              countRes.totalCount > 0 ? countRes.totalCount : pageRes.totalCount;
            const pages =
              countRes.totalPages > 0
                ? countRes.totalPages
                : pageRes.totalPages || (count > 0 ? 1 : 0);

            setTotalCount(count);
            setTotalPages(pages);
            setCurrentItems(pageRes.items ?? []);
            setCurrentPage(pageToLoad);
          }
        } else {
          // Single page load (page navigation)
          const pageRes = await fetchPageRef.current(
            pageToLoad,
            controller.signal,
          ).catch((err) => {
            if (isAbortError(err)) throw err;
            console.error("useServerPagination: fetchPage error:", err);
            return { items: [], totalCount: 0, totalPages: 0 };
          });

          if (mountedRef.current && !controller.signal.aborted) {
            if (pageRes.totalCount > 0) setTotalCount(pageRes.totalCount);
            if (pageRes.totalPages > 0) setTotalPages(pageRes.totalPages);
            setCurrentItems(pageRes.items ?? []);
            setCurrentPage(pageToLoad);
          }
        }
      } catch (err) {
        if (isAbortError(err)) return;
        console.error("useServerPagination: query execution failed:", err);
      } finally {
        if (mountedRef.current && abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    },
    [enabled],
  );

  // Trigger new query when fetchPage, fetchCount, or enabled changes
  useEffect(() => {
    if (enabled) {
      void loadData(1, true);
    } else {
      abortControllerRef.current?.abort();
      setIsLoading(false);
    }
  }, [loadData, enabled, fetchPage, fetchCount, itemsPerPage]);

  const goToPage = useCallback(
    (page: number) => {
      if (page < 1 || (totalPages > 0 && page > totalPages)) return;
      void loadData(page, false);
    },
    [totalPages, loadData],
  );

  const refetch = useCallback(() => {
    void loadData(1, true);
  }, [loadData]);

  // Backward compatibility: construct pages map from currentItems
  const pagesMap = new Map<number, T[]>([[currentPage, currentItems]]);
  const loadingPagesSet = isLoading ? new Set([currentPage]) : new Set<number>();

  return {
    pages: pagesMap,
    currentPage,
    totalPages,
    totalCount,
    currentItems,
    isLoading,
    isLoadingCount: isLoading,
    isLoadingPages: isLoading,
    loadingPages: loadingPagesSet,
    goToPage,
    nextPage: () => goToPage(currentPage + 1),
    previousPage: () => goToPage(currentPage - 1),
    cancel: () => abortControllerRef.current?.abort(),
    refetch,
  };
}
