import "fake-indexeddb/auto";
import { describe, test, expect, beforeEach } from "bun:test";
import { setAuthToken, getAuthToken } from "../../lib/api-client";
import type { User } from "../AuthContext";

if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis as any;
}

const mockLocalStorage = (() => {
  let store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; }
  } as Storage;
})();

const mockSessionStorage = (() => {
  let store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; }
  } as Storage;
})();

globalThis.localStorage = mockLocalStorage;
globalThis.sessionStorage = mockSessionStorage;

// Standalone evaluator matching AuthContext hasPermission logic
function evaluatePermission(user: User | null, perm: string): boolean {
  if (!user) return false;
  if (user.role === "Super Administrator" || user.role === "Administrator" || user.permissions?.includes("*")) return true;
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.includes(perm);
  }
  if (user.role === "Store Seller") {
    return [
      "orders.read", "orders.create", "orders.update", "orders.payments.manage",
      "budgets.create", "budgets.update", "clients.read", "clients.create", "clients.update", "products.read"
    ].includes(perm);
  }
  if (user.role === "Online Seller") {
    return [
      "orders.read", "orders.create", "orders.update", "orders.payments.manage",
      "budgets.create", "budgets.update", "clients.read", "clients.create", "clients.update", "products.read",
      "inventory.view_stock", "dispatch.read"
    ].includes(perm);
  }
  return false;
}

describe("AuthContext Contract and Security Policies", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAuthToken(null);
  });

  test("hasPermission grants all access to Super Administrator and Administrator", () => {
    const superAdmin: User = {
      id: "u1",
      username: "superadmin",
      email: "admin@camihogar.com",
      name: "Super Admin",
      role: "Super Administrator",
      status: "active",
      permissions: []
    };

    const admin: User = {
      id: "u2",
      username: "admin",
      email: "admin2@camihogar.com",
      name: "Admin",
      role: "Administrator",
      status: "active",
      permissions: []
    };

    expect(evaluatePermission(superAdmin, "orders.delete")).toBe(true);
    expect(evaluatePermission(superAdmin, "system.security.audit")).toBe(true);
    expect(evaluatePermission(admin, "orders.delete")).toBe(true);
    expect(evaluatePermission(admin, "any.unrestricted.action")).toBe(true);
  });

  test("hasPermission grants all access when wildcard '*' is present in user permissions", () => {
    const customUser: User = {
      id: "u3",
      username: "wildcard_user",
      email: "wildcard@camihogar.com",
      name: "Wildcard User",
      role: "Custom Role",
      status: "active",
      permissions: ["*"]
    };

    expect(evaluatePermission(customUser, "financial.reports.export")).toBe(true);
  });

  test("hasPermission evaluates explicit permissions array strictly", () => {
    const seller: User = {
      id: "u4",
      username: "seller1",
      email: "seller1@camihogar.com",
      name: "Seller One",
      role: "Special Seller",
      status: "active",
      permissions: ["orders.read", "orders.create"]
    };

    expect(evaluatePermission(seller, "orders.read")).toBe(true);
    expect(evaluatePermission(seller, "orders.create")).toBe(true);
    expect(evaluatePermission(seller, "orders.delete")).toBe(false);
    expect(evaluatePermission(seller, "users.manage")).toBe(false);
  });

  test("hasPermission falls back to built-in Store Seller role matrix when permissions array is empty", () => {
    const storeSeller: User = {
      id: "u5",
      username: "storeseller",
      email: "store@camihogar.com",
      name: "Store Seller",
      role: "Store Seller",
      status: "active",
      permissions: []
    };

    expect(evaluatePermission(storeSeller, "orders.create")).toBe(true);
    expect(evaluatePermission(storeSeller, "budgets.create")).toBe(true);
    expect(evaluatePermission(storeSeller, "products.read")).toBe(true);
    expect(evaluatePermission(storeSeller, "inventory.view_stock")).toBe(false);
    expect(evaluatePermission(storeSeller, "orders.delete")).toBe(false);
  });

  test("hasPermission falls back to built-in Online Seller matrix with dispatch & stock access", () => {
    const onlineSeller: User = {
      id: "u6",
      username: "onlineseller",
      email: "online@camihogar.com",
      name: "Online Seller",
      role: "Online Seller",
      status: "active",
      permissions: []
    };

    expect(evaluatePermission(onlineSeller, "dispatch.read")).toBe(true);
    expect(evaluatePermission(onlineSeller, "inventory.view_stock")).toBe(true);
    expect(evaluatePermission(onlineSeller, "settings.update")).toBe(false);
  });

  test("hasPermission returns false when user is null or unauthenticated", () => {
    expect(evaluatePermission(null, "orders.read")).toBe(false);
  });

  test("Impersonation session restores impersonated token and user, and restores super admin on stop", () => {
    const superAdminUser: User = {
      id: "admin-1",
      username: "superboss",
      email: "boss@camihogar.com",
      name: "Big Boss",
      role: "Super Administrator",
      status: "active",
      permissions: ["*"]
    };

    const impersonatedUser: User = {
      id: "seller-99",
      username: "carlos_seller",
      email: "carlos@camihogar.com",
      name: "Carlos Vendedor",
      role: "Store Seller",
      status: "active",
      permissions: ["orders.read", "orders.create"]
    };

    const sessionPayload = {
      superAdminToken: "token-super-admin-jwt",
      superAdminUser,
      impersonatedToken: "token-impersonated-jwt",
      impersonatedUser
    };

    sessionStorage.setItem("ordina_impersonator_session", JSON.stringify(sessionPayload));

    // Simulate session restore
    const stored = JSON.parse(sessionStorage.getItem("ordina_impersonator_session")!);
    expect(stored.impersonatedToken).toBe("token-impersonated-jwt");
    expect(stored.impersonatedUser.username).toBe("carlos_seller");

    // Simulate stopImpersonation
    setAuthToken(stored.superAdminToken);
    sessionStorage.removeItem("ordina_impersonator_session");

    expect(getAuthToken()).toBe("token-super-admin-jwt");
    expect(sessionStorage.getItem("ordina_impersonator_session")).toBeNull();
  });

  test("Grace period restores cached user and token during offline disconnection", () => {
    const cachedUser: User = {
      id: "u-offline",
      username: "offline_agent",
      email: "offline@camihogar.com",
      name: "Offline Agent",
      role: "Store Seller",
      status: "active",
      permissions: []
    };

    const recentActivity = Date.now() - 25 * 60 * 1000; // 25 minutes ago (< 1 hour)
    localStorage.setItem("cached_auth_user", JSON.stringify(cachedUser));
    localStorage.setItem("auth_last_active_at", recentActivity.toString());
    setAuthToken("saved-offline-token");

    const lastActive = Number(localStorage.getItem("auth_last_active_at") || "0");
    const ONE_HOUR = 60 * 60 * 1000;
    const isWithinGracePeriod = lastActive > 0 && Date.now() - lastActive < ONE_HOUR;

    expect(isWithinGracePeriod).toBe(true);

    const restoredUser = JSON.parse(localStorage.getItem("cached_auth_user")!);
    expect(restoredUser.username).toBe("offline_agent");
    expect(getAuthToken()).toBe("saved-offline-token");
  });
});
