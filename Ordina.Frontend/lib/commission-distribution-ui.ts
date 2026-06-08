import type { ProductCommission, SaleTypeCommissionRule } from "@/lib/storage";
import { FAMILY_COMMISSION_USD_TIERS } from "@/lib/storage";

const EPS = 0.0001;
export const EXPECTED_SALE_TYPE_RULE_COUNT = 21;
const MAX_USD_PER_ROLE = 20;

export function tierEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

export function isStandardFamilyTier(value: number): boolean {
  return FAMILY_COMMISSION_USD_TIERS.some((t) => tierEquals(value, t));
}

export type SaleTypeRuleGroup = {
  saleType: string;
  saleTypeLabel: string;
  rules: SaleTypeCommissionRule[];
};

export function groupRulesBySaleType(
  rules: SaleTypeCommissionRule[],
): SaleTypeRuleGroup[] {
  const map = new Map<string, SaleTypeRuleGroup>();

  for (const rule of rules) {
    if (rule.familyCommissionUsdPerUnit === 0) continue;
    const key = rule.saleType.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        saleType: rule.saleType,
        saleTypeLabel: rule.saleTypeLabel,
        rules: [],
      });
    }
    map.get(key)!.rules.push(rule);
  }

  return Array.from(map.values())
    .map((g) => ({
      ...g,
      rules: [...g.rules].sort(
        (a, b) =>
          (a.familyCommissionUsdPerUnit ?? 0) -
          (b.familyCommissionUsdPerUnit ?? 0),
      ),
    }))
    .sort((a, b) => a.saleTypeLabel.localeCompare(b.saleTypeLabel));
}

export function familiesForTier(
  productCommissions: ProductCommission[],
  tier: number,
): string[] {
  return productCommissions
    .filter(
      (pc) =>
        pc.commissionValue > 0 && tierEquals(pc.commissionValue, tier),
    )
    .map((pc) => pc.categoryName?.trim() || pc.categoryId)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
}

export function familiesWithNonStandardTier(
  productCommissions: ProductCommission[],
): string[] {
  return productCommissions
    .filter(
      (pc) => pc.commissionValue > 0 && !isStandardFamilyTier(pc.commissionValue),
    )
    .map(
      (pc) =>
        `${pc.categoryName?.trim() || pc.categoryId} (${pc.commissionValue} USD/u → usa tier 2.5)`,
    )
    .sort((a, b) => a.localeCompare(b, "es"));
}

export function validateDistributionUsd(
  vendor: number,
  referrer: number,
  postventa: number,
): string | null {
  const values = [vendor, referrer, postventa];
  if (values.some((v) => v < 0)) return "Los montos no pueden ser negativos";
  if (values.some((v) => v > MAX_USD_PER_ROLE)) {
    return `Cada rol debe ser ≤ ${MAX_USD_PER_ROLE} USD/u`;
  }
  return null;
}

export function rulesNeedAttention(rules: SaleTypeCommissionRule[]): boolean {
  if (rules.length === 0) return true;
  if (rules.some((r) => r.familyCommissionUsdPerUnit === 0)) return true;
  if (rules.length < EXPECTED_SALE_TYPE_RULE_COUNT) return true;
  return false;
}
