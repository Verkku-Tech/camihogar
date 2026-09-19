import {
  DISCOUNT_UI_CURRENCY_KEY,
  DISCOUNT_UI_PERCENT_KEY,
  DISCOUNT_UI_TYPE_KEY,
} from "@/lib/product-discount-ui";
import {
  resolveProductFromAttributeValue,
  type AttributeValue,
  type Category,
  type OrderProduct,
  type Product,
} from "@/lib/storage";

const INTERNAL_ATTR_KEYS = new Set([
  DISCOUNT_UI_TYPE_KEY,
  DISCOUNT_UI_CURRENCY_KEY,
  DISCOUNT_UI_PERCENT_KEY,
]);

export type OrderProductDescriptionContext = {
  categories: Category[];
  allProducts: Product[];
};

export type OrderProductAttributePair = {
  key: string;
  value: string;
};

type CategoryAttribute = Category["attributes"][number];

function isInternalAttributeKey(key: string): boolean {
  if (INTERNAL_ATTR_KEYS.has(key)) return true;
  if (key.toLowerCase().startsWith("discountui")) return true;
  if (key.includes("_") && key.split("_").length === 2) return true;
  return false;
}

function getValueLabel(value: string | AttributeValue): string {
  if (typeof value === "string") return value;
  return value.label || value.id || String(value);
}

function getCategoryForProduct(
  productCategory: string,
  categories: Category[],
): Category | undefined {
  return categories.find((c) => c.name === productCategory);
}

function findCategoryAttribute(
  category: Category | undefined,
  attributeKey: string,
): CategoryAttribute | undefined {
  if (!category) return undefined;
  return category.attributes.find(
    (attr) =>
      attr.id?.toString() === attributeKey || attr.title === attributeKey,
  );
}

function findProductInCatalog(
  productId: unknown,
  allProducts: Product[],
  productsMap: Map<number, Product>,
): Product | undefined {
  if (productId == null || productId === "") return undefined;

  const idStr = String(productId);
  const idNum = typeof productId === "number" ? productId : Number.parseInt(idStr, 10);

  if (!Number.isNaN(idNum)) {
    const byId = productsMap.get(idNum);
    if (byId) return byId;
  }

  const byBackend = allProducts.find(
    (p) => p.backendId === idStr || p.id.toString() === idStr,
  );
  if (byBackend) return byBackend;

  return allProducts.find(
    (p) => p.id === idNum || p.backendId === idStr,
  );
}

function resolveProductAttributeValueLabel(
  selectedValue: unknown,
  categoryAttribute: CategoryAttribute,
  allAttributes: Record<string, unknown>,
  allProducts: Product[],
  categories: Category[],
  productsMap: Map<number, Product>,
): string {
  const processProduct = (productId: unknown): string => {
    const foundProduct = findProductInCatalog(productId, allProducts, productsMap);
    if (!foundProduct) {
      const attrValue = categoryAttribute.values?.find((val) => {
        if (typeof val === "string") return val === String(productId);
        return (
          val.id === String(productId) ||
          val.productId?.toString() === String(productId) ||
          val.productBackendId === String(productId)
        );
      });
      if (attrValue && typeof attrValue !== "string") {
        return getValueLabel(attrValue);
      }
      return String(productId);
    }

    let label = foundProduct.name;
    const subAttrKey = `${categoryAttribute.title || categoryAttribute.id}_${foundProduct.id}`;
    const subAttrs = allAttributes[subAttrKey];

    if (subAttrs && typeof subAttrs === "object" && !Array.isArray(subAttrs)) {
      const subCategory = getCategoryForProduct(foundProduct.category, categories);
      if (subCategory?.attributes) {
        const subLabels = Object.entries(subAttrs as Record<string, unknown>)
          .map(([subKey, subVal]) => {
            const subAttrDef = subCategory.attributes.find(
              (a) => a.id?.toString() === subKey || a.title === subKey,
            );
            if (!subAttrDef) return "";
            return getAttributeValueLabel(
              subVal,
              subAttrDef,
              allAttributes,
              allProducts,
              categories,
              productsMap,
            );
          })
          .filter((l) => l !== "");

        if (subLabels.length > 0) {
          label += ` (${subLabels.join(", ")})`;
        }
      }
    }

    return label;
  };

  if (Array.isArray(selectedValue)) {
    return selectedValue.map(processProduct).filter(Boolean).join(", ");
  }
  if (selectedValue != null && selectedValue !== "") {
    return processProduct(selectedValue);
  }
  return "";
}

function getAttributeValueLabel(
  selectedValue: unknown,
  categoryAttribute: CategoryAttribute | undefined,
  allAttributes: Record<string, unknown>,
  allProducts: Product[],
  categories: Category[],
  productsMap: Map<number, Product>,
): string {
  if (!categoryAttribute) {
    return selectedValue == null ? "" : String(selectedValue);
  }

  if (categoryAttribute.valueType === "Product") {
    return resolveProductAttributeValueLabel(
      selectedValue,
      categoryAttribute,
      allAttributes,
      allProducts,
      categories,
      productsMap,
    );
  }

  if (categoryAttribute.valueType === "Number") {
    const numValue =
      selectedValue !== undefined && selectedValue !== null && selectedValue !== ""
        ? String(selectedValue)
        : "";
    if (!numValue) return "";
    return categoryAttribute.title
      ? `${categoryAttribute.title} ${numValue}`
      : numValue;
  }

  if (!categoryAttribute.values || categoryAttribute.values.length === 0) {
    return selectedValue == null ? "" : String(selectedValue);
  }

  const resolveFromValues = (raw: unknown): string => {
    const rawStr = String(raw ?? "");
    if (!rawStr) return "";

    const attributeValue = categoryAttribute.values!.find(
      (val: string | AttributeValue) => {
        if (typeof val === "string") return val === rawStr;
        return (
          val.id === rawStr ||
          val.label === rawStr ||
          val.productId?.toString() === rawStr ||
          val.productBackendId === rawStr
        );
      },
    );

    if (!attributeValue) return rawStr;
    if (typeof attributeValue === "string") return attributeValue;

    const linked = resolveProductFromAttributeValue(
      attributeValue,
      productsMap,
      allProducts,
    );
    return linked?.name ?? getValueLabel(attributeValue);
  };

  if (Array.isArray(selectedValue)) {
    return selectedValue
      .map(resolveFromValues)
      .filter((label) => label.trim() !== "")
      .join(", ");
  }

  return resolveFromValues(selectedValue);
}

function buildProductsMap(allProducts: Product[]): Map<number, Product> {
  const map = new Map<number, Product>();
  for (const product of allProducts) {
    map.set(product.id, product);
  }
  return map;
}

function getAttributeValueFromProduct(
  product: OrderProduct,
  categoryAttribute: CategoryAttribute,
): unknown {
  const attrs = product.attributes ?? {};
  const idKey = categoryAttribute.id?.toString();
  if (idKey && attrs[idKey] !== undefined) return attrs[idKey];
  if (categoryAttribute.title && attrs[categoryAttribute.title] !== undefined) {
    return attrs[categoryAttribute.title];
  }
  return undefined;
}

/** Pares título/valor de atributos de una línea de pedido, ordenados por categoría. */
export function getOrderProductAttributePairs(
  product: OrderProduct,
  ctx: OrderProductDescriptionContext,
): OrderProductAttributePair[] {
  const attrs = product.attributes;
  if (!attrs || Object.keys(attrs).length === 0) return [];

  const category = getCategoryForProduct(product.category, ctx.categories);
  const productsMap = buildProductsMap(ctx.allProducts);
  const allAttributes = attrs as Record<string, unknown>;
  const pairs: OrderProductAttributePair[] = [];

  const categoryAttributes = category?.attributes ?? [];
  const seenKeys = new Set<string>();

  for (const categoryAttribute of categoryAttributes) {
    const value = getAttributeValueFromProduct(product, categoryAttribute);
    if (value === undefined || value === null || value === "") continue;

    const attrKey =
      categoryAttribute.id?.toString() ?? categoryAttribute.title ?? "";
    if (!attrKey || isInternalAttributeKey(attrKey)) continue;

    const valueLabel = getAttributeValueLabel(
      value,
      categoryAttribute,
      allAttributes,
      ctx.allProducts,
      ctx.categories,
      productsMap,
    ).trim();

    if (!valueLabel) continue;

    const pairKey = categoryAttribute.title || attrKey;
    if (seenKeys.has(pairKey)) continue;
    seenKeys.add(pairKey);

    pairs.push({ key: pairKey, value: valueLabel });
  }

  if (pairs.length > 0 || categoryAttributes.length > 0) {
    return pairs;
  }

  for (const [key, value] of Object.entries(attrs)) {
    if (isInternalAttributeKey(key)) continue;
    const categoryAttribute = findCategoryAttribute(category, key);
    const valueLabel = getAttributeValueLabel(
      value,
      categoryAttribute,
      allAttributes,
      ctx.allProducts,
      ctx.categories,
      productsMap,
    ).trim();
    if (!valueLabel) continue;
    const pairKey = categoryAttribute?.title || key;
    if (seenKeys.has(pairKey)) continue;
    seenKeys.add(pairKey);
    pairs.push({ key: pairKey, value: valueLabel });
  }

  return pairs;
}

/** Descripción detallada alineada al backend: `Nombre | Attr: val, Attr: val`. */
export function formatOrderProductDescription(
  product: OrderProduct,
  ctx: OrderProductDescriptionContext,
): string {
  const pairs = getOrderProductAttributePairs(product, ctx);
  const name = product.name?.trim() || "Producto sin nombre";
  if (pairs.length === 0) return name;
  return `${name} | ${pairs.map((p) => `${p.key}: ${p.value}`).join(", ")}`;
}
