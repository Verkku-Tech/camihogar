import { describe, it, expect } from "bun:test";
import { defaultNavigationItems, isItemVisibleForRole, normalizeNavigationItems, type NavigationItem } from "../../contexts/NavigationContext";

describe("Navigation Settings and Role-based Visibility", () => {
  it("defaultNavigationItems includes Inicio and Métricas and does NOT include old Dashboard", () => {
    const home = defaultNavigationItems.find((i) => i.id === "home");
    const analytics = defaultNavigationItems.find((i) => i.id === "analytics");
    const oldDashboard = defaultNavigationItems.find((i) => i.id === "dashboard");

    expect(home).toBeDefined();
    expect(home?.name).toBe("Inicio");
    expect(home?.href).toBe("/");

    expect(analytics).toBeDefined();
    expect(analytics?.name).toBe("Métricas");
    expect(analytics?.href).toBe("/dashboard");

    expect(oldDashboard).toBeUndefined();
  });

  it("normalizeNavigationItems migrates old dashboard item into home and analytics", () => {
    const oldStoredItems: NavigationItem[] = [
      {
        id: "dashboard",
        name: "Dashboard",
        href: "/",
        category: "main",
        active: true,
        description: "Old dashboard",
      },
      {
        id: "proveedores",
        name: "Proveedores",
        href: "/proveedores",
        category: "main",
        active: false,
        description: "Gestión de proveedores",
      },
    ];

    const normalized = normalizeNavigationItems(oldStoredItems);

    expect(normalized.find((i) => i.id === "dashboard")).toBeUndefined();
    expect(normalized.find((i) => i.id === "home")).toBeDefined();
    expect(normalized.find((i) => i.id === "analytics")).toBeDefined();
    // Preserves existing custom states
    expect(normalized.find((i) => i.id === "proveedores")?.active).toBe(false);
  });

  it("isItemVisibleForRole returns false when active is false, regardless of role", () => {
    const item: NavigationItem = {
      id: "analytics",
      name: "Métricas",
      href: "/dashboard",
      category: "main",
      active: false,
      description: "Metrics",
      superAdminOnly: false,
      allowedRoles: ["Super Administrator"],
    };

    expect(isItemVisibleForRole(item, "Super Administrator")).toBe(false);
    expect(isItemVisibleForRole(item, "Administrator")).toBe(false);
  });

  it("isItemVisibleForRole restricts to Super Administrator when superAdminOnly is true", () => {
    const item: NavigationItem = {
      id: "analytics",
      name: "Métricas",
      href: "/dashboard",
      category: "main",
      active: true,
      description: "Metrics",
      superAdminOnly: true,
      allowedRoles: ["Administrator"], // Even if allowedRoles has Administrator, superAdminOnly takes strict priority
    };

    expect(isItemVisibleForRole(item, "Super Administrator")).toBe(true);
    expect(isItemVisibleForRole(item, "Administrator")).toBe(false);
    expect(isItemVisibleForRole(item, "Supervisor")).toBe(false);
    expect(isItemVisibleForRole(item, undefined)).toBe(false);
  });

  it("isItemVisibleForRole filters by allowedRoles when specified", () => {
    const item: NavigationItem = {
      id: "analytics",
      name: "Métricas",
      href: "/dashboard",
      category: "main",
      active: true,
      description: "Metrics",
      superAdminOnly: false,
      allowedRoles: ["Administrator", "Supervisor"],
    };

    // Super Administrator always has access
    expect(isItemVisibleForRole(item, "Super Administrator")).toBe(true);
    // Explicitly allowed roles
    expect(isItemVisibleForRole(item, "Administrator")).toBe(true);
    expect(isItemVisibleForRole(item, "Supervisor")).toBe(true);
    // Other roles blocked
    expect(isItemVisibleForRole(item, "Store Seller")).toBe(false);
    expect(isItemVisibleForRole(item, "Workshop Operator")).toBe(false);
  });

  it("isItemVisibleForRole returns true for all when allowedRoles is empty and not superAdminOnly", () => {
    const item: NavigationItem = {
      id: "home",
      name: "Inicio",
      href: "/",
      category: "main",
      active: true,
      description: "Home",
      superAdminOnly: false,
      allowedRoles: [],
    };

    expect(isItemVisibleForRole(item, "Super Administrator")).toBe(true);
    expect(isItemVisibleForRole(item, "Administrator")).toBe(true);
    expect(isItemVisibleForRole(item, "Store Seller")).toBe(true);
  });
});
