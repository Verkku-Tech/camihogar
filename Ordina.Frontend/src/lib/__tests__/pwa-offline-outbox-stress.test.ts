import "fake-indexeddb/auto";
import { describe, test, expect, beforeEach } from "bun:test";
import { syncManager } from "../sync-manager";
import { connectivityManager } from "../connectivity";
import { put, get, clearStore } from "../indexeddb";
import { getDb } from "../db";

describe("PWA Offline Resilience & Outbox Stress Testing", () => {
  beforeEach(async () => {
    connectivityManager.resetForTesting();
    await clearStore("orders");
    await clearStore("clients");
    const db = await getDb();
    await db.clear("outbox_mutations");
  });

  test("enqueues multiple offline mutations in FIFO order with unique mutationId headers", async () => {
    connectivityManager.reportFailure(new TypeError("Network down"));

    const mutationId1 = await syncManager.enqueueMutation({
      endpoint: "/api/clients",
      method: "POST",
      payload: { nombreRazonSocial: "Cliente Offline 1" },
      localEntityId: "cli_off_1",
      storeName: "clients",
    });

    const mutationId2 = await syncManager.enqueueMutation({
      endpoint: "/api/clients",
      method: "POST",
      payload: { nombreRazonSocial: "Cliente Offline 2" },
      localEntityId: "cli_off_2",
      storeName: "clients",
    });

    expect(mutationId1).not.toBe(mutationId2);

    const pendingCount = await syncManager.getPendingCount();
    expect(pendingCount).toBe(2);

    const db = await getDb();
    const queuedMutations = await db.getAll("outbox_mutations");
    expect(queuedMutations.length).toBe(2);
    expect(queuedMutations[0].mutationId).toBe(mutationId1);
    expect(queuedMutations[1].mutationId).toBe(mutationId2);
  });

  test("drainOutbox sends X-Mutation-Id and reconciles provisional entities in IndexedDB", async () => {
    await put("orders", {
      id: "ord_off_alpha",
      orderNumber: "ORD-OFF-ALPHA",
      clientName: "Alpha Client",
    });

    const capturedHeaders: Record<string, string>[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: any, init: any) => {
      const headersObj: Record<string, string> = {};
      if (init?.headers) {
        new Headers(init.headers).forEach((v, k) => {
          headersObj[k.toLowerCase()] = v;
        });
      }
      capturedHeaders.push(headersObj);

      return {
        ok: true,
        status: 201,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({
          id: "ord_srv_999",
          orderNumber: "ORD-2026-9999",
          clientName: "Alpha Client",
        }),
      } as any;
    }) as any;

    connectivityManager.reportFailure(new TypeError("Offline"));

    try {
      const mutationId = await syncManager.enqueueMutation({
        endpoint: "/api/orders",
        method: "POST",
        payload: { clientName: "Alpha Client" },
        localEntityId: "ord_off_alpha",
        storeName: "orders",
      });

      // Network recovers
      connectivityManager.reportSuccess();
      await syncManager.drainOutbox();

      // Verify headers passed
      expect(capturedHeaders.length).toBe(1);
      expect(capturedHeaders[0]["x-mutation-id"]).toBe(mutationId);

      // Verify reconciliation
      const oldOrder = await get("orders", "ord_off_alpha");
      expect(oldOrder).toBeUndefined();

      const newOrder = await get<any>("orders", "ord_srv_999");
      expect(newOrder).toBeDefined();
      expect(newOrder.orderNumber).toBe("ORD-2026-9999");

      // Verify outbox is drained
      const pendingCount = await syncManager.getPendingCount();
      expect(pendingCount).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("retains mutation in outbox on transient network error without data loss", async () => {
    await put("clients", {
      id: "cli_off_beta",
      nombreRazonSocial: "Beta Client",
    });

    const originalFetch = globalThis.fetch;
    let attempts = 0;

    globalThis.fetch = (async () => {
      attempts++;
      throw new TypeError("Failed to fetch");
    }) as any;

    connectivityManager.reportFailure(new TypeError("Offline"));

    try {
      await syncManager.enqueueMutation({
        endpoint: "/api/clients",
        method: "POST",
        payload: { nombreRazonSocial: "Beta Client" },
        localEntityId: "cli_off_beta",
        storeName: "clients",
      });

      // Attempt drain with unexpected network failure during request
      connectivityManager.reportSuccess();
      await syncManager.drainOutbox();

      // Mutation must still be in outbox with incremented retryCount
      const pendingCount = await syncManager.getPendingCount();
      expect(pendingCount).toBe(1);
      expect(attempts).toBeGreaterThanOrEqual(1);

      // Provisional client still in local store
      const localClient = await get("clients", "cli_off_beta");
      expect(localClient).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
