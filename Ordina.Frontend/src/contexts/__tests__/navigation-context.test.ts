import { describe, test, expect } from "bun:test";
import {
  defaultNavigationItems,
  isItemVisibleForRole,
  normalizeNavigationItems,
  type NavigationItem,
} from "../NavigationContext";

describe("NavigationContext Hierarchy and Security Filtering", () => {
  test("all default items belong to recognized categories and have valid hrefs", () => {
    const validCategories = ["main", "inventory", "orders", "configuration"];

    for (const item of defaultNavigationItems) {
      expect(validCategories).toContain(item.category);
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  test("inactive items are hidden from all roles including Super Administrator", () => {
    const inactiveItem: NavigationItem = {
      id: "tasas",
      name: "Tasas",
      href: "/tasas",
      category: "configuration",
      active: false,
      description: "Currency rates",
      superAdminOnly: false,
      allowedRoles: ["Super Administrator", "Administrator"],
    };

    expect(isItemVisibleForRole(inactiveItem, "Super Administrator")).toBe(false);
    expect(isItemVisibleForRole(inactiveItem, "Administrator")).toBe(false);
    expect(isItemVisibleForRole(inactiveItem, undefined)).toBe(false);
  });

  test("superAdminOnly items are exclusively visible to Super Administrator", () => {
    const superAdminItem: NavigationItem = {
      id: "sistema",
      name: "Sistema",
      href: "/sistema",
      category: "configuration",
      active: true,
      description: "Cache management",
      superAdminOnly: true,
      allowedRoles: [],
    };

    expect(isItemVisibleForRole(superAdminItem, "Super Administrator")).toBe(true);
    expect(isItemVisibleForRole(superAdminItem, "Administrator")).toBe(false);
    expect(isItemVisibleForRole(superAdminItem, "Supervisor")).toBe(false);
    expect(isItemVisibleForRole(superAdminItem, "Store Seller")).toBe(false);
    expect(isItemVisibleForRole(superAdminItem, undefined)).toBe(false);
  });

  test("allowedRoles grants access to Super Administrator plus specifically listed roles", () => {
    const restrictedItem: NavigationItem = {
      id: "reportes",
      name: "Reportes",
      href: "/reportes",
      category: "main",
      active: true,
      description: "Reports",
      superAdminOnly: false,
      allowedRoles: ["Administrator", "Supervisor"],
    };

    expect(isItemVisibleForRole(restrictedItem, "Super Administrator")).toBe(true);
    expect(isItemVisibleForRole(restrictedItem, "Administrator")).toBe(true);
    expect(isItemVisibleForRole(restrictedItem, "Supervisor")).toBe(true);
    expect(isItemVisibleForRole(restrictedItem, "Store Seller")).toBe(false);
    expect(isItemVisibleForRole(restrictedItem, "Online Seller")).toBe(false);
  });

  test("items without role restrictions or superAdminOnly flag are visible to any authenticated or unauthenticated role", () => {
    const publicItem: NavigationItem = {
      id: "home",
      name: "Inicio",
      href: "/",
      category: "main",
      active: true,
      description: "Home page",
      superAdminOnly: false,
      allowedRoles: [],
    };

    expect(isItemVisibleForRole(publicItem, "Super Administrator")).toBe(true);
    expect(isItemVisibleForRole(publicItem, "Store Seller")).toBe(true);
    expect(isItemVisibleForRole(publicItem, undefined)).toBe(true);
  });

  test("normalizeNavigationItems removes legacy dashboard and preserves all standard items", () => {
    const legacyList: NavigationItem[] = [
      {
        id: "dashboard",
        name: "Dashboard",
        href: "/dashboard",
        category: "main",
        active: true,
        description: "Legacy",
      },
      {
        id: "home",
        name: "Inicio",
        href: "/",
        category: "main",
        active: true,
        description: "Home",
      },
    ];

    const normalized = normalizeNavigationItems(legacyList);
    expect(normalized.find((i) => i.id === "dashboard")).toBeUndefined();
    expect(normalized.find((i) => i.id === "home")).toBeDefined();
    expect(normalized.length).toBe(defaultNavigationItems.length);
  });
});
