"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

interface UseServerPaginationOptions<T> {
  /** Function to fetch a single page from API */
  fetchPage: (page: number, signal?: AbortSignal) => Promise<{
    items: T[];
    totalCount: number;
    totalPages: number;
  }>;
  /** Function to fetch total count (fast metadata endpoint) */
  fetchCount: (signal?: AbortSignal) => Promise<{
    totalCount: number;
    totalPages: number;
  }>;
  /** Number of pages to load in parallel (default: 3) */
  batchPages?: number;
  /** Prefetch when this many pages from edge (default: 1) */
  prefetchThreshold?: number;
  /** Enabled flag (default: true) */
  enabled?: boolean;
}

interface UseServerPaginationResult<T> {
  pages: Map<number, T[]>;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  currentItems: T[];
  isLoadingCount: boolean;
  isLoadingPages: boolean;
  loadingPages: Set<number>;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  cancel: () => void;
  refetch: () => void;
}

export function useServerPagination<T>(
  options: UseServerPaginationOptions<T>,
): UseServerPaginationResult<T> {
  const {
    fetchPage,
    fetchCount,
    batchPages = 3,
    prefetchThreshold = 1,
    enabled = true,
  } = options;

  const [pages, setPages] = useState<Map<number, T[]>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedBatchesRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load count on mount
  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const loadCount = async () => {
      setIsLoadingCount(true);
      try {
        const count = await fetchCount(controller.signal);
        if (mountedRef.current) {
          setTotalCount(count.totalCount);
          setTotalPages(count.totalPages);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load count:", err);
      } finally {
        if (mountedRef.current) {
          setIsLoadingCount(false);
        }
      }
    };

    loadCount();
    return () => controller.abort();
  }, [fetchCount, enabled]);

  // Load batch of pages
  const loadBatch = useCallback(
    async (startPage: number) => {
      if (!enabled || totalPages === 0) return;

      const batchKey = Math.floor((startPage - 1) / batchPages);
      if (loadedBatchesRef.current.has(batchKey)) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const pagesToLoad = Array.from({ length: batchPages }, (_, i) => startPage + i).filter(
        (p) => p <= totalPages,
      );

      if (pagesToLoad.length === 0) return;

      setLoadingPages((prev) => new Set([...prev, ...pagesToLoad]));

      try {
        const results = await Promise.all(
          pagesToLoad.map((page) =>
            fetchPage(page, controller.signal).then((result) => ({
              page,
              items: result.items,
            }))
          ),
        );

        if (mountedRef.current) {
          setPages((prev) => {
            const next = new Map(prev);
            for (const result of results) {
              next.set(result.page, result.items);
            }
            return next;
          });
          loadedBatchesRef.current.add(batchKey);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load batch:", err);
      } finally {
        if (mountedRef.current) {
          setLoadingPages((prev) => {
            const next = new Set(prev);
            for (const p of pagesToLoad) next.delete(p);
            return next;
          });
        }
      }
    },
    [fetchPage, totalPages, batchPages, enabled],
  );

  // Navigate to page
  const goToPage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;
      setCurrentPage(page);

      const batchStart = Math.floor((page - 1) / batchPages) * batchPages + 1;
      loadBatch(batchStart);

      if (page >= batchStart + batchPages - prefetchThreshold) {
        const nextBatchStart = batchStart + batchPages;
        if (nextBatchStart <= totalPages) {
          loadBatch(nextBatchStart);
        }
      }
    },
    [totalPages, batchPages, prefetchThreshold, loadBatch],
  );

  // Load initial batch
  useEffect(() => {
    if (totalCount > 0 && pages.size === 0 && enabled) {
      loadBatch(1);
    }
  }, [totalCount, pages.size, loadBatch, enabled]);

  const currentItems = useMemo(() => {
    return pages.get(currentPage) || [];
  }, [pages, currentPage]);

  return {
    pages,
    currentPage,
    totalPages,
    totalCount,
    currentItems,
    isLoadingCount,
    isLoadingPages: loadingPages.size > 0,
    loadingPages,
    goToPage,
    nextPage: () => goToPage(currentPage + 1),
    previousPage: () => goToPage(currentPage - 1),
    cancel: () => abortControllerRef.current?.abort(),
    refetch: () => {
      loadedBatchesRef.current.clear();
      setPages(new Map());
      setCurrentPage(1);
      loadBatch(1);
    },
  };
}
