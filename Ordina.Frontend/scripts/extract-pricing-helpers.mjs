import { execSync } from 'node:child_process';
import fs from 'node:fs';

const COMMIT = '6d574fc';
const GIT_REPO = 'F:/Verkku/Camihogar';

const content = execSync(`git -C "${GIT_REPO}" show ${COMMIT}:Ordina.Frontend/lib/storage.ts`, {
  encoding: 'utf-8',
  maxBuffer: 20 * 1024 * 1024
});

// Extract resolveProductFromAttributeValue
const resolveFuncIdx = content.indexOf('export function resolveProductFromAttributeValue');
const resolveFuncEnd = content.indexOf('\n// Helper functions para mapear entre frontend y backend');
const resolveFunc = content.slice(resolveFuncIdx, resolveFuncEnd);

// Extract convertAdjustmentToTarget and calculateProductUnitPriceWithAttributes
const pricingStart = content.indexOf('const convertAdjustmentToTarget');
const pricingEnd = content.indexOf('export const calculateProductPriceWithAttributes');
const pricingBlock = content.slice(pricingStart, pricingEnd);

// Extract commission tiers
const tierStart = content.indexOf('export const FAMILY_COMMISSION_USD_TIERS');
const tierEnd = content.indexOf('\n// ===== USERS STORAGE (IndexedDB) =====');
const tierBlock = content.slice(tierStart, tierEnd);

const fileContent = `import type { Category, Product, AttributeValue, CalculateUnitPriceOptions, SaleTypeCommissionRule } from '@/types';
import type { Currency } from '@/lib/currency-utils';
import { backendIdToNumber } from '@/lib/storage';

${resolveFunc}

${pricingBlock}

${tierBlock}
`;

fs.writeFileSync('src/lib/order-pricing-helpers.ts', fileContent);
console.log('Written src/lib/order-pricing-helpers.ts');
