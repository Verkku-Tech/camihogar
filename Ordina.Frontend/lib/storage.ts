import * as db from "./indexeddb";
import type { Currency } from "./currency-utils";
import { normalizeExchangeRatesAtCreation } from "./currency-utils";
import { apiClient } from "./api-client";
import { generateUUID } from "./utils";

import type {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ProductResponseDto,
  ProductListItemDto,
  CreateProductDto,
  UpdateProductDto,
  UserResponseDto,
  OrderResponseDto,
  CreateOrderDto,
  UpdateOrderDto,
  OrderProductDto as OrderProductDtoBackend,
  PaymentDetailsDto,
  PartialPaymentDto as PartialPaymentDtoBackend,
  ProviderResponseDto,
  CreateProviderDto,
  UpdateProviderDto,
  ClientResponseDto,
  AccountResponseDto,
  CreateAccountDto,
  UpdateAccountDto,
  StoreResponseDto,
  CreateStoreDto,
  UpdateStoreDto,
} from "./api-client";
import { syncManager } from "./sync-manager";

export interface AttributeValue {
  id: string;
  label: string;
  isDefault?: boolean;
  priceAdjustment?: number; // positive for increase, negative for decrease
  priceAdjustmentCurrency?: Currency; // Moneda del ajuste de precio
  /** ID numérico del frontend (hash de ObjectId); puede quedar desfasado si solo existía productId corrupto en API */
  productId?: number;
  /** ObjectId del producto en el backend; fuente de verdad para atributos tipo Product */
  productBackendId?: string;
}

export interface Category {
  backendId?: string; // ObjectId original del backend (opcional)
  id: number;
  name: string;
  description: string;
  products: number;
  maxDiscount: number;
  maxDiscountCurrency?: Currency; // Moneda del descuento máximo
  attributes: {
    id: number;
    title: string;
    description: string;
    valueType: string;
    values: string[] | AttributeValue[]; // Support both old and new format
    maxSelections?: number; // For "Multiple select" type
    minValue?: number; // For "Number" type
    maxValue?: number; // For "Number" type (REQUIRED when valueType is "Number")
    required?: boolean; // Indica si el atributo es obligatorio (por defecto true)
  }[];
}

export interface Product {
  id: number;
  backendId?: string;
  name: string;
  category: string;
  price: number;
  priceCurrency?: Currency; // Moneda del precio
  stock: number;
  status: string;
  sku: string;
  attributes?: { [attributeId: string]: any };
}

// ===== CATEGORIES STORAGE (IndexedDB) =====

// Helper para convertir Category con id number a formato IndexedDB (id string)
interface CategoryDB {
  id: string;
  backendId?: string; // ObjectId original del backend (opcional)
  name: string;
  description: string;
  products: number;
  maxDiscount: number;
  maxDiscountCurrency?: Currency;
  attributes: {
    id: number;
    title: string;
    description: string;
    valueType: string;
    values: string[] | AttributeValue[];
    maxSelections?: number;
    minValue?: number; // For "Number" type
    maxValue?: number; // For "Number" type (REQUIRED when valueType is "Number")
    required?: boolean; // Indica si el atributo es obligatorio (por defecto true)
  }[];
}

const categoryToDB = (category: Category, backendId?: string): CategoryDB => ({
  ...category,
  id: category.id.toString(),
  ...(backendId || category.backendId ? { backendId: backendId ?? category.backendId } : {}),
});

const categoryFromDB = (categoryDB: CategoryDB): Category => ({
  ...categoryDB,
  id: Number.parseInt(categoryDB.id),
  backendId: categoryDB.backendId,
});

// Helper para convertir string ID del backend a number ID del frontend
// Usa un hash simple para generar un ID numérico consistente
export const backendIdToNumber = (backendId: string): number => {
  // Si el string ID puede parsearse como número COMPLETO (sin caracteres adicionales), usarlo directamente
  const parsed = Number.parseInt(backendId);
  // Verificar que el parseo fue exacto (sin caracteres sobrantes)
  // Esto evita que "693db0" se convierta en 693, causando colisiones
  if (!Number.isNaN(parsed) && parsed > 0 && parsed.toString() === backendId) {
    return parsed;
  }

  // Si no es un número exacto, generar un hash numérico del string completo
  // Esto asegura que IDs como "693db0" y "693" generen números diferentes
  let hash = 0;
  for (let i = 0; i < backendId.length; i++) {
    const char = backendId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32 bits
  }

  // Retornar un número positivo, asegurando que sea mayor que cualquier ID numérico común
  // Multiplicamos por un factor para evitar colisiones con IDs numéricos simples
  const hashValue = Math.abs(hash) || Date.now();
  // Asegurar que el hash sea suficientemente grande para evitar colisiones con IDs numéricos simples
  return hashValue > 1000000 ? hashValue : hashValue + 1000000;
};

function attributeValueProductIdForBackend(val: AttributeValue): string | undefined {
  const b = val.productBackendId?.trim();
  if (b) return b;
  if (val.productId != null) return String(val.productId);
  return undefined;
}

function mapAttributeValueFromBackendDto(val: {
  id: string;
  label: string;
  isDefault?: boolean;
  priceAdjustment?: number;
  priceAdjustmentCurrency?: string;
  productId?: string | null;
}): AttributeValue {
  const rawStr =
    val.productId != null && String(val.productId).trim() !== ""
      ? String(val.productId).trim()
      : "";
  const isMongo24 = /^[a-f0-9]{24}$/i.test(rawStr);
  return {
    id: val.id,
    label: val.label,
    isDefault: val.isDefault,
    priceAdjustment: val.priceAdjustment,
    priceAdjustmentCurrency: val.priceAdjustmentCurrency as Currency | undefined,
    productBackendId: rawStr || undefined,
    productId: rawStr
      ? isMongo24
        ? backendIdToNumber(rawStr)
        : /^\d+$/.test(rawStr)
          ? Number.parseInt(rawStr, 10)
          : undefined
      : undefined,
  };
}

/** Resuelve el producto de catálogo vinculado a un valor de atributo tipo Product. */
export function resolveProductFromAttributeValue(
  val: AttributeValue,
  productsMap: Map<number, Product>,
  allProducts: Product[]
): Product | undefined {
  const rawBackend = val.productBackendId?.trim();
  if (rawBackend) {
    if (/^[a-f0-9]{24}$/i.test(rawBackend)) {
      const numeric = backendIdToNumber(rawBackend);
      const byNum = productsMap.get(numeric);
      if (byNum) return byNum;
    }
    const byBackend = allProducts.find((p) => p.backendId === rawBackend);
    if (byBackend) return byBackend;
  }
  if (val.productId != null) {
    const byId = productsMap.get(val.productId);
    if (byId) return byId;
  }
  const label = val.label?.trim().toLowerCase();
  if (label) {
    const matches = allProducts.filter(
      (p) => p.name.trim().toLowerCase() === label
    );
    if (matches.length === 1) return matches[0];
  }
  return undefined;
}

// Helper functions para mapear entre frontend y backend
const categoryToBackendDto = (
  category: Omit<Category, "id">
): CreateCategoryDto => ({
  name: category.name,
  description: category.description,
  maxDiscount: category.maxDiscount,
  maxDiscountCurrency: category.maxDiscountCurrency,
  attributes: category.attributes.map((attr) => {
    const attrDto: any = {
      title: attr.title,
      description: attr.description,
      valueType: attr.valueType,
      values: Array.isArray(attr.values)
        ? attr.values.map((val) =>
          typeof val === "string"
            ? { label: val }
            : {
              label: val.label,
              isDefault: val.isDefault,
              priceAdjustment: val.priceAdjustment,
              priceAdjustmentCurrency: val.priceAdjustmentCurrency,
              ...(attributeValueProductIdForBackend(val)
                ? { productId: attributeValueProductIdForBackend(val)! }
                : {}),
            }
        )
        : [],
    };

    // Incluir maxSelections si existe
    if (attr.maxSelections !== undefined) {
      attrDto.maxSelections = attr.maxSelections;
    }

    // Incluir required si existe (por defecto true)
    if (attr.required !== undefined) {
      attrDto.required = attr.required;
    } else {
      attrDto.required = true; // Por defecto obligatorio
    }

    // Para atributos de tipo "Number", siempre incluir minValue y maxValue
    // El backend los requiere cuando valueType es "Number"
    if (attr.valueType === "Number") {
      // Si están definidos, usarlos; si no, enviar null explícitamente
      // El backend acepta decimal? (nullable), así que null debería ser válido
      attrDto.minValue = attr.minValue !== undefined ? attr.minValue : null;
      attrDto.maxValue = attr.maxValue !== undefined ? attr.maxValue : null;

      // Log para debugging
      if (attr.maxValue === undefined || attr.maxValue === null) {
        console.warn("⚠️ Atributo numérico sin maxValue:", attr.title, "valueType:", attr.valueType);
      }
    } else {
      // Para otros tipos, incluir solo si existen
      if (attr.minValue !== undefined) {
        attrDto.minValue = attr.minValue;
      }
      if (attr.maxValue !== undefined) {
        attrDto.maxValue = attr.maxValue;
      }
    }

    return attrDto;
  }),
});

const categoryFromBackendDto = (dto: CategoryResponseDto): Category => ({
  id: backendIdToNumber(dto.id),
  backendId: dto.id, // Guardar el ObjectId original
  name: dto.name,
  description: dto.description,
  products: dto.products,
  maxDiscount: dto.maxDiscount,
  maxDiscountCurrency: dto.maxDiscountCurrency as Currency | undefined,
  attributes: dto.attributes.map((attr) => ({
    id: backendIdToNumber(attr.id || "0"),
    title: attr.title,
    description: attr.description,
    valueType: attr.valueType,
    maxSelections: attr.maxSelections,
    minValue: attr.minValue,
    maxValue: attr.maxValue,
    required: attr.required !== undefined ? attr.required : true, // Por defecto true si no existe
    values: attr.values.map((val) => mapAttributeValueFromBackendDto(val)),
  })),
});

// Helper para verificar si estamos online
const isOnline = (): boolean => {
  if (typeof window === "undefined") return false;
  return navigator.onLine;
};

/** Stores cleared on boot sync and emergency reset (preserves sync_queue + app_settings). */
export const INDEXEDDB_DATA_STORES = [
  "categories",
  "products",
  "orders",
  "clients",
  "providers",
  "stores",
  "accounts",
  "users",
  "vendors",
  "budgets",
  "commissions",
  "api_cache",
  "exchange_rates",
] as const;

/**
 * Limpia todas las tablas de datos en IndexedDB (no sync_queue ni app_settings).
 * Usado por bootSync y por la pantalla de emergencia en configuración.
 */
export const clearAllIndexedDBDataStores = async (): Promise<void> => {
  for (const name of INDEXEDDB_DATA_STORES) {
    try {
      await db.clearStore(name);
    } catch (e) {
      console.warn(`clearStore ${name}:`, e);
    }
  }
};

/** Conteos por tabla (incluye sync_queue y app_settings para diagnóstico). */
export const getIndexedDBStoreStats = async (): Promise<
  { name: string; count: number }[]
> => {
  const stats: { name: string; count: number }[] = [];
  for (const name of INDEXEDDB_DATA_STORES) {
    try {
      stats.push({ name, count: await db.count(name) });
    } catch {
      stats.push({ name, count: -1 });
    }
  }
  for (const name of ["sync_queue", "app_settings"] as const) {
    try {
      stats.push({ name, count: await db.count(name) });
    } catch {
      stats.push({ name, count: -1 });
    }
  }
  return stats;
};

/**
 * Al iniciar con conexión: sincroniza la cola offline y vacía el cache local
 * para que las lecturas posteriores usen el servidor como fuente de verdad.
 */
export const bootSync = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  if (!isOnline()) {
    console.log("bootSync: sin conexión, se omite limpieza de IndexedDB");
    return;
  }
  try {
    await syncManager.syncPendingOperations();
  } catch (e) {
    console.warn("bootSync: error en cola de sincronización", e);
  }
  try {
    await clearAllIndexedDBDataStores();
    console.log("bootSync: IndexedDB (datos) limpiado");
  } catch (e) {
    console.warn("bootSync: error al limpiar IndexedDB", e);
  }
};

const repopulateCategoriesCache = async (categories: Category[]): Promise<void> => {
  try {
    await db.clearStore("categories");
    for (const c of categories) {
      await db.put("categories", categoryToDB(c, c.backendId));
    }
  } catch (e) {
    console.warn("Error actualizando cache de categorías:", e);
  }
};

export const getCategories = async (): Promise<Category[]> => {
  try {
    if (isOnline()) {
      try {
        const backendCategories = await apiClient.getCategories();
        const list = backendCategories.map(categoryFromBackendDto);
        void repopulateCategoriesCache(list);
        return list;
      } catch (error) {
        console.warn(
          "⚠️ Error cargando categorías del backend, usando IndexedDB:",
          error
        );
        const localCategoriesDB = await db.getAll<CategoryDB>("categories");
        return localCategoriesDB.map(categoryFromDB);
      }
    }

    const localCategoriesDB = await db.getAll<CategoryDB>("categories");
    return localCategoriesDB.map(categoryFromDB);
  } catch (error) {
    console.error("Error loading categories:", error);
    return [];
  }
};

export const getCategory = async (
  id: number
): Promise<Category | undefined> => {
  try {
    if (isOnline()) {
      try {
        const list = await getCategories();
        const found = list.find((c) => c.id === id);
        if (found) return found;
      } catch (error) {
        console.warn("getCategory: error desde API, usando IndexedDB", error);
      }
    }
    const categoryDB = await db.get<CategoryDB>("categories", id.toString());
    return categoryDB ? categoryFromDB(categoryDB) : undefined;
  } catch (error) {
    console.error("Error loading category:", error);
    return undefined;
  }
};

// Helper para resolver el ObjectId del backend de una categoría por nombre
// Esta función se usa durante la sincronización para resolver categoryId correctamente
export const resolveCategoryBackendId = async (
  categoryName: string
): Promise<string | null> => {
  if (!isOnline()) {
    return null;
  }

  try {
    // Buscar directamente en el backend
    const backendCategories = await apiClient.getCategories();
    const backendCategory = backendCategories.find(
      (c) => c.name === categoryName
    );

    if (backendCategory) {
      return backendCategory.id;
    }

    // Si no existe en el backend, buscar localmente y sincronizarla
    const categoriesDB = await db.getAll<CategoryDB>("categories");
    const localCategories = categoriesDB.map(categoryFromDB);
    const localCategory = localCategories.find((c) => c.name === categoryName);

    if (localCategory) {
      // Sincronizar la categoría primero
      const createCategoryDto = categoryToBackendDto(localCategory);
      const syncedCategory = await apiClient.createCategory(createCategoryDto);

      // Actualizar la categoría local con el ID del backend
      const updatedLocalCategory = categoryFromBackendDto(syncedCategory);
      await db.update("categories", categoryToDB(updatedLocalCategory, updatedLocalCategory.backendId));

      return syncedCategory.id;
    }

    return null;
  } catch (error) {
    console.warn("⚠️ Error resolviendo categoryId del backend:", error);
    return null;
  }
};

export const addCategory = async (
  category: Omit<Category, "id">
): Promise<Category> => {
  // Validación del nombre
  const trimmedName = category.name.trim();
  if (trimmedName.length < 2) {
    throw new Error("El nombre de la categoría debe tener al menos 2 caracteres");
  }
  if (trimmedName.length > 200) {
    throw new Error("El nombre de la categoría no puede exceder 200 caracteres");
  }

  // Validación de atributos
  for (const attr of category.attributes) {
    const trimmedTitle = attr.title.trim();
    if (trimmedTitle.length < 2) {
      throw new Error(`El título del atributo "${attr.title || '(sin título)'}" debe tener al menos 2 caracteres`);
    }
    if (trimmedTitle.length > 200) {
      throw new Error(`El título del atributo "${attr.title}" no puede exceder 200 caracteres`);
    }
  }

  let newCategory: Category;
  let syncedToBackend = false;

  // Intentar guardar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      const createDto = categoryToBackendDto(category);
      console.log("📤 Enviando categoría al backend:", JSON.stringify(createDto, null, 2));
      const backendCategory = await apiClient.createCategory(createDto);
      newCategory = categoryFromBackendDto(backendCategory);

      console.log(
        "✅ Categoría guardada en backend:",
        newCategory.name
      );
      syncedToBackend = true;
      return newCategory;
    } catch (error: any) {
      // Si la creación falla por conflicto, obtener la categoría existente y actualizar localmente
      if (error?.message?.includes("Ya existe una categoría con el nombre")) {
        try {
          const existingCategory = await apiClient.getCategoryByName(category.name);
          if (existingCategory) {
            newCategory = categoryFromBackendDto(existingCategory);
            newCategory = { ...newCategory, ...category };
            syncedToBackend = true;
            return newCategory;
          }
        } catch (getError) {
          // Si falla obtenerla, continuar con creación local
          console.warn("⚠️ Error obteniendo categoría existente del backend:", getError);
        }
      }

      console.warn(
        "⚠️ Error guardando categoría en backend, guardando localmente:",
        error
      );
      // Continuar para guardar localmente y encolar para sincronización
    }
  }

  // Guardar en IndexedDB
  try {
    // Cargar categorías directamente desde IndexedDB para evitar llamadas recursivas a getCategories()
    const categoriesDB = await db.getAll<CategoryDB>("categories");
    const localCategories = categoriesDB.map(categoryFromDB);
    const newId = Math.max(...localCategories.map((c) => c.id), 0) + 1;
    newCategory = { ...category, id: newId };

    await db.add("categories", categoryToDB(newCategory, newCategory.backendId));
    console.log("✅ Categoría guardada en IndexedDB:", newCategory.name);

    // Encolar para sincronización si NO se sincronizó con el backend
    // (puede ser porque está offline O porque falló el backend aunque esté online)
    if (!syncedToBackend) {
      try {
        const createDto = categoryToBackendDto(newCategory);
        console.log("📤 Encolando categoría para sincronización:", JSON.stringify(createDto, null, 2));
        await syncManager.addToQueue({
          type: "create",
          entity: "category",
          entityId: newCategory.id.toString(),
          data: createDto,
        });
        console.log(
          "✅ Categoría encolada para sincronización:",
          newCategory.name
        );
      } catch (error) {
        console.warn(
          "⚠️ Error encolando categoría para sincronización:",
          error
        );
        // No lanzar error, la categoría ya está guardada localmente
      }
    }

    return newCategory;
  } catch (error) {
    console.error("Error adding category to IndexedDB:", error);
    throw error;
  }
};

export const updateCategory = async (
  id: number,
  updates: Partial<Category>
): Promise<Category> => {
  const existingCategory = await getCategory(id);
  if (!existingCategory) {
    throw new Error(`Category with id ${id} not found`);
  }

  // Validación del nombre si se está actualizando
  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    if (trimmedName.length < 2) {
      throw new Error("El nombre de la categoría debe tener al menos 2 caracteres");
    }
    if (trimmedName.length > 200) {
      throw new Error("El nombre de la categoría no puede exceder 200 caracteres");
    }
  }

  // Validación de atributos si se están actualizando
  if (updates.attributes !== undefined) {
    for (const attr of updates.attributes) {
      const trimmedTitle = attr.title.trim();
      if (trimmedTitle.length < 2) {
        throw new Error(`El título del atributo "${attr.title || '(sin título)'}" debe tener al menos 2 caracteres`);
      }
      if (trimmedTitle.length > 200) {
        throw new Error(`El título del atributo "${attr.title}" no puede exceder 200 caracteres`);
      }
    }
  }

  const updatedCategory: Category = {
    ...existingCategory,
    ...updates,
    backendId: existingCategory.backendId, // Preservar backendId
  };

  // Variable para rastrear si la categoría existe en el backend
  let backendCategoryId: string | null = existingCategory.backendId || null;

  // Intentar actualizar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      // Si no tenemos backendId, intentar buscarlo por nombre (fallback)
      if (!backendCategoryId) {
        try {
          const backendCategory = await apiClient.getCategoryByName(
            existingCategory.name
          );
          if (backendCategory) {
            backendCategoryId = backendCategory.id;
            // Actualizar la categoría con el backendId encontrado
            updatedCategory.backendId = backendCategoryId;
          }
        } catch (error) {
          console.warn(
            "⚠️ Categoría no encontrada en backend por nombre, actualizando solo localmente"
          );
        }
      }

      // Si encontramos la categoría en el backend, actualizarla
      if (backendCategoryId) {
        const updateDto: UpdateCategoryDto = {
          name:
            updatedCategory.name !== existingCategory.name
              ? updatedCategory.name
              : undefined,
          description:
            updatedCategory.description !== existingCategory.description
              ? updatedCategory.description
              : undefined,
          maxDiscount:
            updatedCategory.maxDiscount !== existingCategory.maxDiscount
              ? updatedCategory.maxDiscount
              : undefined,
          maxDiscountCurrency:
            updatedCategory.maxDiscountCurrency !==
              existingCategory.maxDiscountCurrency
              ? updatedCategory.maxDiscountCurrency
              : undefined,
          attributes:
            updatedCategory.attributes !== existingCategory.attributes
              ? updatedCategory.attributes.map((attr) => {
                const attrDto: any = {
                  id: attr.id.toString(),
                  title: attr.title,
                  description: attr.description,
                  valueType: attr.valueType,
                  maxSelections: attr.maxSelections,
                  required: attr.required,
                  values: Array.isArray(attr.values)
                    ? attr.values.map((val) =>
                      typeof val === "string"
                        ? { label: val }
                        : {
                          id: val.id,
                          label: val.label,
                          isDefault: val.isDefault,
                          priceAdjustment: val.priceAdjustment,
                          priceAdjustmentCurrency:
                            val.priceAdjustmentCurrency,
                          ...(attributeValueProductIdForBackend(val)
                            ? {
                                productId: attributeValueProductIdForBackend(val)!,
                              }
                            : {}),
                        }
                    )
                    : [],
                };

                // Para atributos de tipo "Number", siempre incluir minValue y maxValue
                if (attr.valueType === "Number") {
                  attrDto.minValue = attr.minValue !== undefined ? attr.minValue : null;
                  attrDto.maxValue = attr.maxValue !== undefined ? attr.maxValue : null;
                } else {
                  // Para otros tipos, incluir solo si existen
                  if (attr.minValue !== undefined) {
                    attrDto.minValue = attr.minValue;
                  }
                  if (attr.maxValue !== undefined) {
                    attrDto.maxValue = attr.maxValue;
                  }
                }

                return attrDto;
              })
              : undefined,
        };

        console.log("📤 Sending update to backend:", JSON.stringify(updateDto, null, 2)); // Debug info
        const backendCategory = await apiClient.updateCategory(
          backendCategoryId,
          updateDto
        );
        const syncedCategory = categoryFromBackendDto(backendCategory);

        console.log(
          "✅ Categoría actualizada en backend:",
          syncedCategory.name
        );
        return syncedCategory;
      } else {
        // La categoría no existe en el backend, actualizar localmente y encolar para sincronización
        console.log(
          "⚠️ Categoría no existe en backend, actualizando localmente y encolando para sincronización"
        );
        // Continuar para guardar localmente y encolar
      }
    } catch (error: any) {
      // Manejar error 409 específicamente
      if (error?.message?.includes("Ya existe una categoría con el nombre")) {
        try {
          const backendCategory = await apiClient.getCategoryByName(updatedCategory.name);
          if (backendCategory) {
            // Actualizar con el ID correcto y reintentar
            updatedCategory.backendId = backendCategory.id;
            backendCategoryId = backendCategory.id;

            const retryUpdateDto: UpdateCategoryDto = {
              name:
                updatedCategory.name !== existingCategory.name
                  ? updatedCategory.name
                  : undefined,
              description:
                updatedCategory.description !== existingCategory.description
                  ? updatedCategory.description
                  : undefined,
              maxDiscount:
                updatedCategory.maxDiscount !== existingCategory.maxDiscount
                  ? updatedCategory.maxDiscount
                  : undefined,
              maxDiscountCurrency:
                updatedCategory.maxDiscountCurrency !==
                  existingCategory.maxDiscountCurrency
                  ? updatedCategory.maxDiscountCurrency
                  : undefined,
              attributes:
                updatedCategory.attributes !== existingCategory.attributes
                  ? updatedCategory.attributes.map((attr) => {
                    const attrDto: any = {
                      id: attr.id.toString(),
                      title: attr.title,
                      description: attr.description,
                      valueType: attr.valueType,
                      maxSelections: attr.maxSelections,
                      values: Array.isArray(attr.values)
                        ? attr.values.map((val) =>
                          typeof val === "string"
                            ? { label: val }
                            : {
                              id: val.id,
                              label: val.label,
                              isDefault: val.isDefault,
                              priceAdjustment: val.priceAdjustment,
                              priceAdjustmentCurrency:
                                val.priceAdjustmentCurrency,
                              ...(attributeValueProductIdForBackend(val)
                                ? {
                                    productId: attributeValueProductIdForBackend(val)!,
                                  }
                                : {}),
                            }
                        )
                        : [],
                    };
                    // Siempre incluir required (por defecto true si no existe)
                    attrDto.required = attr.required !== undefined ? attr.required : true;
                    if (attr.valueType === "Number") {
                      attrDto.minValue = attr.minValue !== undefined ? attr.minValue : null;
                      attrDto.maxValue = attr.maxValue !== undefined ? attr.maxValue : null;
                    } else {
                      if (attr.minValue !== undefined) {
                        attrDto.minValue = attr.minValue;
                      }
                      if (attr.maxValue !== undefined) {
                        attrDto.maxValue = attr.maxValue;
                      }
                    }
                    return attrDto;
                  })
                  : undefined,
            };

            const backendCategoryUpdated = await apiClient.updateCategory(
              backendCategoryId,
              retryUpdateDto
            );
            const syncedCategory = categoryFromBackendDto(backendCategoryUpdated);
            return syncedCategory;
          }
        } catch (retryError) {
          console.warn("⚠️ Error en reintento:", retryError);
        }
      }

      console.warn(
        "⚠️ Error actualizando categoría en backend, guardando localmente:",
        error
      );
      // Continuar para guardar localmente
    }
  }

  // Guardar en IndexedDB
  try {
    await db.update("categories", categoryToDB(updatedCategory, updatedCategory.backendId));

    // Encolar para sincronización si la categoría no está en el backend o estamos offline
    const shouldEnqueue = !isOnline() || !backendCategoryId;
    if (shouldEnqueue) {
      try {
        const updateDto: UpdateCategoryDto = {
          name: updatedCategory.name,
          description: updatedCategory.description,
          maxDiscount: updatedCategory.maxDiscount,
          maxDiscountCurrency: updatedCategory.maxDiscountCurrency,
          attributes: updatedCategory.attributes.map((attr) => {
            const attrDto: any = {
              id: attr.id.toString(),
              title: attr.title,
              description: attr.description,
              valueType: attr.valueType,
              maxSelections: attr.maxSelections,
              values: Array.isArray(attr.values)
                ? attr.values.map((val) =>
                  typeof val === "string"
                    ? { label: val }
                    : {
                      id: val.id,
                      label: val.label,
                      isDefault: val.isDefault,
                      priceAdjustment: val.priceAdjustment,
                      priceAdjustmentCurrency: val.priceAdjustmentCurrency,
                      ...(attributeValueProductIdForBackend(val)
                        ? {
                            productId: attributeValueProductIdForBackend(val)!,
                          }
                        : {}),
                    }
                )
                : [],
            };

            // Siempre incluir required (por defecto true si no existe)
            attrDto.required = attr.required !== undefined ? attr.required : true;

            // Para atributos de tipo "Number", siempre incluir minValue y maxValue
            if (attr.valueType === "Number") {
              attrDto.minValue = attr.minValue !== undefined ? attr.minValue : null;
              attrDto.maxValue = attr.maxValue !== undefined ? attr.maxValue : null;
            } else {
              // Para otros tipos, incluir solo si existen
              if (attr.minValue !== undefined) {
                attrDto.minValue = attr.minValue;
              }
              if (attr.maxValue !== undefined) {
                attrDto.maxValue = attr.maxValue;
              }
            }

            return attrDto;
          }),
        };
        await syncManager.addToQueue({
          type: "update",
          entity: "category",
          entityId: id.toString(),
          data: updateDto,
        });
        console.log("✅ Categoría encolada para sincronización");
      } catch (error) {
        console.warn("⚠️ Error encolando categoría para sincronización:", error);
      }
    }

    return updatedCategory;
  } catch (error) {
    console.error("Error updating category in IndexedDB:", error);
    throw error;
  }
};

export const deleteCategory = async (id: number): Promise<void> => {
  // Obtener la categoría local para tener el nombre
  const localCategory = await getCategory(id);
  if (!localCategory) {
    throw new Error(`Category with id ${id} not found`);
  }

  // Intentar eliminar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      // Buscar la categoría en el backend por nombre para obtener su ObjectId
      let backendCategoryId: string | null = null;
      try {
        const backendCategory = await apiClient.getCategoryByName(
          localCategory.name
        );
        if (backendCategory) {
          backendCategoryId = backendCategory.id;
        }
      } catch (error) {
        // La categoría no existe en el backend, solo eliminar localmente
        console.warn(
          "⚠️ Categoría no encontrada en backend por nombre, eliminando solo localmente"
        );
      }

      // Si encontramos la categoría en el backend, eliminarla
      if (backendCategoryId) {
        await apiClient.deleteCategory(backendCategoryId);
        console.log("✅ Categoría eliminada del backend:", backendCategoryId);
      }

      // Eliminar siempre de IndexedDB
      await db.remove("categories", id.toString());
      console.log("✅ Categoría eliminada de IndexedDB:", id);
      return;
    } catch (error) {
      console.warn(
        "⚠️ Error eliminando categoría del backend, eliminando localmente:",
        error
      );
      // Continuar para eliminar localmente
    }
  }

  // Eliminar de IndexedDB
  try {
    await db.remove("categories", id.toString());

    // Encolar para sincronización si estamos offline
    if (!isOnline()) {
      await syncManager.addToQueue({
        type: "delete",
        entity: "category",
        entityId: id.toString(),
        data: {},
      });
    }

    console.log("✅ Categoría eliminada de IndexedDB:", id);
  } catch (error) {
    console.error("Error deleting category from IndexedDB:", error);
    throw error;
  }
};

// ===== PRODUCTS STORAGE (IndexedDB) =====

// Helper para convertir Product con id number a formato IndexedDB (id string)
interface ProductDB {
  id: string;
  backendId?: string;
  name: string;
  category: string;
  price: number;
  priceCurrency?: Currency;
  stock: number;
  status: string;
  sku: string;
  attributes?: { [attributeId: string]: any };
}

const productToDB = (product: Product): ProductDB => ({
  ...product,
  id: product.id.toString(),
});

const productFromDB = (productDB: ProductDB): Product => ({
  ...productDB,
  id: Number.parseInt(productDB.id),
  backendId: productDB.backendId,
});

// Helper functions para mapear productos entre frontend y backend
const productToBackendDto = async (
  product: Product | Omit<Product, "id">
): Promise<CreateProductDto> => {
  // El backend ahora resuelve automáticamente la categoría por nombre si CategoryId no es válido
  // Solo intentamos obtener el ID si estamos online, pero no es crítico
  let categoryId: string = "";
  const categoryName: string = product.category;

  if (isOnline()) {
    try {
      const backendCategories = await apiClient.getCategories();
      const backendCategory = backendCategories.find(
        (c) => c.name === categoryName
      );
      if (backendCategory) {
        categoryId = backendCategory.id;
      }
    } catch (error) {
      // No crítico, el backend lo resolverá por nombre
    }
  }

  return {
    name: product.name,
    sku: product.sku,
    description: undefined,
    categoryId: categoryId || undefined, // Opcional - el backend lo resolverá por nombre si no está presente
    category: categoryName,
    price: product.price,
    priceCurrency: product.priceCurrency,
    stock: product.stock,
    status: product.status,
    attributes: product.attributes,
    providerId: undefined,
  };
};

const productFromBackendDto = (dto: ProductResponseDto): Product => ({
  id: backendIdToNumber(dto.id),
  backendId: dto.id,
  name: dto.name,
  category: dto.category || "", // El backend devuelve el nombre de la categoría en 'category'
  price: dto.price,
  priceCurrency: dto.priceCurrency as Currency | undefined,
  stock: dto.stock,
  status: dto.status,
  sku: dto.sku || "", // El DTO tiene 'sku' en minúsculas
  attributes: dto.attributes,
});

/** Misma regla que productFromBackendDto: nunca parseInt(ObjectId). */
export const productListItemDtoToProduct = (dto: ProductListItemDto): Product => ({
  id: backendIdToNumber(dto.id),
  backendId: dto.id,
  name: dto.name,
  category: dto.category,
  price: dto.price,
  priceCurrency: dto.priceCurrency as Currency | undefined,
  stock: dto.stock,
  status: dto.status,
  sku: dto.sku || "",
});

const repopulateProductsCache = async (products: Product[]): Promise<void> => {
  try {
    await db.clearStore("products");
    for (const p of products) {
      await db.put("products", productToDB(p));
    }
  } catch (e) {
    console.warn("Error actualizando cache de productos:", e);
  }
};

export const getProducts = async (_forceSync = false): Promise<Product[]> => {
  try {
    if (isOnline()) {
      try {
        const backendProducts = await apiClient.getProducts();
        const list = backendProducts.map(productFromBackendDto);
        void repopulateProductsCache(list);
        return list;
      } catch (error) {
        console.warn(
          "⚠️ Error cargando productos del backend, usando IndexedDB:",
          error
        );
        const localProductsDB = await db.getAll<ProductDB>("products");
        return localProductsDB.map(productFromDB);
      }
    }

    const localProductsDB = await db.getAll<ProductDB>("products");
    return localProductsDB.map(productFromDB);
  } catch (error) {
    console.error("Error loading products:", error);
    return [];
  }
};

export const getProduct = async (id: number): Promise<Product | undefined> => {
  try {
    if (isOnline()) {
      try {
        const local = await db.get<ProductDB>("products", id.toString());
        if (local?.backendId) {
          const dto = await apiClient.getProductById(local.backendId);
          const p = productFromBackendDto(dto);
          await db.put("products", productToDB(p));
          return p;
        }
        const all = await getProducts();
        return all.find((x) => x.id === id);
      } catch (error) {
        console.warn("getProduct: error desde API, usando IndexedDB", error);
      }
    }
    const productDB = await db.get<ProductDB>("products", id.toString());
    return productDB ? productFromDB(productDB) : undefined;
  } catch (error) {
    console.error("Error loading product:", error);
    return undefined;
  }
};

export const getProductByBackendId = async (
  backendId: string
): Promise<Product | undefined> => {
  const trimmed = backendId?.trim();
  if (!trimmed) return undefined;
  try {
    if (isOnline()) {
      try {
        const dto = await apiClient.getProductById(trimmed);
        const p = productFromBackendDto(dto);
        await db.put("products", productToDB(p));
        return p;
      } catch (error) {
        console.warn("getProductByBackendId: API falló, usando IndexedDB", error);
      }
    }
    const productsDB = await db.getAll<ProductDB>("products");
    const byField = productsDB.find((p) => p.backendId === trimmed);
    if (byField) return productFromDB(byField);
    return await getProduct(backendIdToNumber(trimmed));
  } catch (error) {
    console.error("Error loading product by backendId:", error);
    return undefined;
  }
};

/** orderProduct.id suele ser ObjectId string; evitar Number.parseInt sobre hex. */
export function resolveCatalogProductFromOrderProductId(
  orderProductId: string,
  allProducts: Product[]
): Product | undefined {
  const trimmed = orderProductId?.trim() ?? "";
  if (!trimmed) return undefined;
  if (/^[a-f0-9]{24}$/i.test(trimmed)) {
    const byBackend = allProducts.find((p) => p.backendId === trimmed);
    if (byBackend) return byBackend;
    const numId = backendIdToNumber(trimmed);
    return allProducts.find((p) => p.id === numId);
  }
  if (/^\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    return allProducts.find((p) => p.id === n);
  }
  return undefined;
}

export const getProductsByCategory = async (
  category: string
): Promise<Product[]> => {
  try {
    const all = await getProducts();
    return all.filter((p) => p.category === category);
  } catch (error) {
    console.error("Error loading products by category:", error);
    return [];
  }
};

export const getProductsByStatus = async (
  status: string
): Promise<Product[]> => {
  try {
    const all = await getProducts();
    return all.filter((p) => p.status === status);
  } catch (error) {
    console.error("Error loading products by status:", error);
    return [];
  }
};

export const addProduct = async (
  product: Omit<Product, "id">
): Promise<Product> => {
  let newProduct: Product;
  let syncedToBackend = false;

  // Intentar guardar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      const createDto = await productToBackendDto(product);
      const backendProduct = await apiClient.createProduct(createDto);
      newProduct = productFromBackendDto(backendProduct);

      console.log(
        "✅ Producto guardado en backend:",
        newProduct.name
      );
      syncedToBackend = true;
      return newProduct;
    } catch (error) {
      console.warn(
        "⚠️ Error guardando producto en backend, guardando localmente:",
        error
      );
      // Continuar para guardar localmente y encolar para sincronización
    }
  }

  // Guardar en IndexedDB
  try {
    // Cargar productos directamente desde IndexedDB para evitar llamadas recursivas a getProducts()
    const productsDB = await db.getAll<ProductDB>("products");
    const localProducts = productsDB.map(productFromDB);
    const newId = Math.max(...localProducts.map((p) => p.id), 0) + 1;
    newProduct = { ...product, id: newId };

    await db.add("products", productToDB(newProduct));
    console.log("✅ Producto guardado en IndexedDB:", newProduct.name);

    // Encolar para sincronización si NO se sincronizó con el backend
    // (puede ser porque está offline O porque falló el backend aunque esté online)
    if (!syncedToBackend) {
      try {
        const createDto = await productToBackendDto(newProduct);
        await syncManager.addToQueue({
          type: "create",
          entity: "product",
          entityId: newProduct.id.toString(),
          data: createDto,
        });
        console.log(
          "✅ Producto encolado para sincronización:",
          newProduct.name
        );
      } catch (error) {
        console.warn("⚠️ Error encolando producto para sincronización:", error);
        // No lanzar error, el producto ya está guardado localmente
      }
    }

    return newProduct;
  } catch (error) {
    console.error("Error adding product to IndexedDB:", error);
    throw error;
  }
};

export const updateProduct = async (
  id: number,
  updates: Partial<Product>
): Promise<Product> => {
  let existingProduct = await getProduct(id);
  if (!existingProduct && updates.backendId) {
    existingProduct = await getProductByBackendId(updates.backendId);
  }
  if (!existingProduct) {
    throw new Error(`Product with id ${id} not found`);
  }

  const updatedProduct: Product = {
    ...existingProduct,
    ...updates,
  };

  // Variable para rastrear si el producto existe en el backend
  let backendProductId: string | null = null;

  // Intentar actualizar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      // Construir el DTO solo con los campos que realmente cambiaron
      const updateDto: UpdateProductDto = {};

      if (updatedProduct.name !== existingProduct.name) {
        updateDto.name = updatedProduct.name;
      }

      // Siempre incluir la categoría para mantener consistencia
      if (updatedProduct.category) {
        updateDto.category = updatedProduct.category;
      }

      if (updatedProduct.price !== existingProduct.price) {
        updateDto.price = updatedProduct.price;
      }

      if (updatedProduct.priceCurrency !== existingProduct.priceCurrency) {
        updateDto.priceCurrency = updatedProduct.priceCurrency;
      }

      if (updatedProduct.stock !== existingProduct.stock) {
        updateDto.stock = updatedProduct.stock;
      }

      if (updatedProduct.status !== existingProduct.status) {
        updateDto.status = updatedProduct.status;
      }

      if (updatedProduct.sku !== existingProduct.sku) {
        updateDto.sku = updatedProduct.sku;
      }

      // Solo incluir attributes si realmente cambiaron
      const attributesChanged = JSON.stringify(updatedProduct.attributes || {}) !== JSON.stringify(existingProduct.attributes || {});
      if (attributesChanged) {
        updateDto.attributes = updatedProduct.attributes;
      }

      // Si no hay cambios, al menos enviar la categoría para mantener consistencia
      const hasChanges = Object.keys(updateDto).length > 0;
      if (!hasChanges && updatedProduct.category) {
        updateDto.category = updatedProduct.category;
      }

      // Buscar el producto en el backend por SKU para obtener su ObjectId
      try {
        const backendProduct = await apiClient.getProductBySku(
          existingProduct.sku
        );
        if (backendProduct) {
          backendProductId = backendProduct.id;
        }
      } catch (error) {
        // El producto no existe en el backend todavía
        console.warn(
          "⚠️ Producto no encontrado en backend por SKU, actualizando solo localmente"
        );
      }

      // Si encontramos el producto en el backend, actualizarlo
      if (backendProductId) {
        // Siempre incluir la categoría y resolver el categoryId del backend
        const categoryName = updateDto.category || updatedProduct.category;
        if (categoryName) {
          const backendCategoryId = await resolveCategoryBackendId(categoryName);
          if (backendCategoryId) {
            updateDto.categoryId = backendCategoryId;
          }
          // Asegurar que siempre tenemos el nombre de la categoría
          if (!updateDto.category) {
            updateDto.category = categoryName;
          }
        }

        // Log para debugging
        console.log("📤 Enviando actualización al backend:", {
          productId: backendProductId,
          updateDto: JSON.stringify(updateDto, null, 2),
        });

        const backendProduct = await apiClient.updateProduct(
          backendProductId,
          updateDto
        );
        const syncedProduct = productFromBackendDto(backendProduct);

        console.log(
          "✅ Producto actualizado en backend:",
          syncedProduct.name
        );
        return syncedProduct;
      } else {
        // El producto no existe en el backend, actualizar localmente y encolar para sincronización
        console.log(
          "⚠️ Producto no existe en backend, actualizando localmente y encolando para sincronización"
        );
        // Continuar para guardar localmente y encolar
      }
    } catch (error) {
      console.warn(
        "⚠️ Error actualizando producto en backend, guardando localmente:",
        error
      );
      // Continuar para guardar localmente
    }
  }

  // Guardar en IndexedDB
  try {
    await db.update("products", productToDB(updatedProduct));

    // Encolar para sincronización si el producto no está en el backend o estamos offline
    const shouldEnqueue = !isOnline() || !backendProductId;
    if (shouldEnqueue) {
      try {
        const updateDto: UpdateProductDto = {
          name: updatedProduct.name,
          category: updatedProduct.category,
          price: updatedProduct.price,
          priceCurrency: updatedProduct.priceCurrency,
          stock: updatedProduct.stock,
          status: updatedProduct.status,
          sku: updatedProduct.sku,
          attributes: updatedProduct.attributes,
        };
        await syncManager.addToQueue({
          type: "update",
          entity: "product",
          entityId: existingProduct.id.toString(),
          data: updateDto,
        });
        console.log("✅ Producto encolado para sincronización");
      } catch (error) {
        console.warn("⚠️ Error encolando producto para sincronización:", error);
      }
    }

    return updatedProduct;
  } catch (error) {
    console.error("Error updating product in IndexedDB:", error);
    throw error;
  }
};

export const deleteProduct = async (id: number): Promise<void> => {
  // Obtener el producto local para tener el SKU
  const localProduct = await getProduct(id);
  if (!localProduct) {
    throw new Error(`Product with id ${id} not found`);
  }

  // Intentar eliminar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      // Buscar el producto en el backend por SKU para obtener su ObjectId
      let backendProductId: string | null = null;
      try {
        const backendProduct = await apiClient.getProductBySku(localProduct.sku);
        if (backendProduct) {
          backendProductId = backendProduct.id;
        }
      } catch (error) {
        // El producto no existe en el backend, solo eliminar localmente
        console.warn(
          "⚠️ Producto no encontrado en backend por SKU, eliminando solo localmente"
        );
      }

      // Si encontramos el producto en el backend, eliminarlo
      if (backendProductId) {
        await apiClient.deleteProduct(backendProductId);
        console.log("✅ Producto eliminado del backend:", backendProductId);
      }

      // Eliminar siempre de IndexedDB
      await db.remove("products", id.toString());
      console.log("✅ Producto eliminado de IndexedDB:", id);
      return;
    } catch (error) {
      console.warn(
        "⚠️ Error eliminando producto del backend, eliminando localmente:",
        error
      );
      // Continuar para eliminar localmente
    }
  }

  // Eliminar de IndexedDB
  try {
    await db.remove("products", id.toString());

    // Encolar para sincronización si estamos offline
    if (!isOnline()) {
      await syncManager.addToQueue({
        type: "delete",
        entity: "product",
        entityId: id.toString(),
        data: {},
      });
    }

    console.log("✅ Producto eliminado de IndexedDB:", id);
  } catch (error) {
    console.error("Error deleting product from IndexedDB:", error);
    throw error;
  }
};

// ===== INTERFACES =====

// Agregar estas interfaces ANTES de Order
// Interfaz para imágenes de productos
export interface ProductImage {
  id: string; // ID único para la imagen
  base64: string; // Imagen o PDF en base64 (data:image/jpeg;base64,... o data:application/pdf;base64,...)
  filename: string; // Nombre original del archivo
  type: "model" | "reference" | "other"; // Tipo de imagen
  uploadedAt: string; // Fecha de carga (ISO string)
  size?: number; // Tamaño del archivo en bytes (opcional)
  mimeType?: string; // Tipo MIME: "image/jpeg", "image/png", "application/pdf", etc.
}

// Registro de refabricación (historial)
export interface RefabricationRecord {
  reason: string; // Razón de la refabricación
  date: string; // Fecha de la refabricación (ISO string)
  previousProviderId?: string; // ID del proveedor anterior
  previousProviderName?: string; // Nombre del proveedor anterior
  newProviderId?: string; // ID del nuevo proveedor
  newProviderName?: string; // Nombre del nuevo proveedor
}

export interface OrderProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  category: string;
  stock: number; // Stock disponible
  attributes?: Record<string, string | number | string[]>; // Permite arrays para selección múltiple
  discount?: number; // Descuento aplicado al producto (monto)
  observations?: string; // Observaciones específicas del producto
  images?: ProductImage[]; // Imágenes de referencia del producto
  // Campos de fabricación
  availabilityStatus?: "disponible" | "no_disponible"; // Estado de disponibilidad
  manufacturingStatus?: "debe_fabricar" | "fabricando" | "almacen_no_fabricado"; // Estado de fabricación (solo si no_disponible): 3 estados, último = En almacén
  manufacturingProviderId?: string; // ID del proveedor asignado
  manufacturingProviderName?: string; // Nombre del proveedor (para display)
  manufacturingStartedAt?: string; // Fecha de inicio de fabricación
  manufacturingCompletedAt?: string; // Fecha de finalización de fabricación
  manufacturingNotes?: string; // Notas de fabricación
  // Campos de refabricación (cuando un producto en almacén se devuelve a fabricación)
  refabricationReason?: string; // Razón de la última refabricación
  refabricatedAt?: string; // Fecha de última refabricación (ISO string)
  refabricationHistory?: RefabricationRecord[]; // Historial de refabricaciones
  // Estado de ubicación del producto
  locationStatus?: "DISPONIBILIDAD INMEDIATA" | "EN TIENDA" | "FABRICACION" | "EN DESPACHO" | "DESPACHADO"; // Estado de ubicación
  logisticStatus?: string; // "Generado", "Fabricándose", "En Almacén", "En Ruta", "Completado"
  // Campos de sobreprecio
  surchargeEnabled?: boolean; // Checkbox "Sobre precio" activo
  surchargeAmount?: number; // Monto del sobreprecio (en USD)
  surchargeReason?: string; // Razón del sobreprecio
}

export interface PartialPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
  currency?: Currency; // Moneda del pago
  images?: ProductImage[]; // Imágenes del comprobante de pago
  paymentDetails?: {
    // Pago Móvil
    pagomovilReference?: string;
    pagomovilBank?: string;
    pagomovilPhone?: string;
    pagomovilDate?: string;
    // Transferencia
    transferenciaBank?: string;
    transferenciaReference?: string;
    transferenciaDate?: string;
    // Efectivo
    cashAmount?: string;
    cashCurrency?: "Bs" | "USD" | "EUR"; // Moneda del pago en efectivo
    cashReceived?: number; // Monto recibido del cliente
    exchangeRate?: number; // Tasa de cambio usada al momento del pago
    useCustomRate?: boolean; // Indica si se usó una tasa personalizada/manual
    // Para Pago Móvil y Transferencia
    originalAmount?: number; // Monto original en la moneda del pago
    originalCurrency?: "Bs" | "USD" | "EUR"; // Moneda original del pago
    // Información de cuenta relacionada
    accountId?: string; // ID de la cuenta (opcional)
    accountNumber?: string; // Para cuentas bancarias: número de cuenta completo
    bank?: string; // Para cuentas bancarias: nombre del banco
    email?: string; // Para cuentas digitales: correo
    wallet?: string; // Para cuentas digitales: wallet
    // Zelle
    envia?: string; // Nombre del titular de la cuenta que paga (solo para Zelle)
    // TDD (Tarjeta de Débito)
    cardReference?: string; // Número de referencia del pago con tarjeta
    /** Conciliación contable (reporte / offline) */
    isConciliated?: boolean;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  products: OrderProduct[]; // Ahora usa la interfaz exportada
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  paymentType: "directo" | "apartado" | "mixto"; // Mantener para compatibilidad
  paymentMode?: "simple" | "mixto"; // Nuevo campo
  paymentMethod: string;
  // Nuevos campos opcionales para compatibilidad hacia atrás
  paymentCondition?: "cashea" | "pagara_en_tienda" | "pago_a_entrega" | "pago_parcial" | "todo_pago";
  saleType?: "delivery_express" | "encargo" | "encargo_entrega" | "entrega" | "retiro_almacen" | "retiro_tienda" | "sistema_apartado";
  deliveryType?: "entrega_programada" | "delivery_express" | "retiro_tienda" | "retiro_almacen";
  deliveryZone?: "caracas" | "g_g" | "san_antonio_los_teques" | "caucagua_higuerote" | "la_guaira" | "charallave_cua" | "interior_pais";
  paymentDetails?: {
    // Pago Móvil
    pagomovilReference?: string;
    pagomovilBank?: string;
    pagomovilPhone?: string;
    pagomovilDate?: string;
    // Transferencia
    transferenciaBank?: string;
    transferenciaReference?: string;
    transferenciaDate?: string;
    // Efectivo
    cashAmount?: string;
    cashCurrency?: "Bs" | "USD" | "EUR"; // Moneda del pago en efectivo
    cashReceived?: number; // Monto recibido del cliente
    exchangeRate?: number; // Tasa de cambio usada al momento del pago
    useCustomRate?: boolean; // Indica si se usó una tasa personalizada/manual
    // Para Pago Móvil y Transferencia
    originalAmount?: number; // Monto original en la moneda del pago
    originalCurrency?: "Bs" | "USD" | "EUR"; // Moneda original del pago
    // Información de cuenta relacionada
    accountId?: string; // ID de la cuenta (opcional)
    accountNumber?: string; // Para cuentas bancarias: número de cuenta completo
    bank?: string; // Para cuentas bancarias: nombre del banco
    email?: string; // Para cuentas digitales: correo
    wallet?: string; // Para cuentas digitales: wallet
    // Zelle
    envia?: string; // Nombre del titular de la cuenta que paga (solo para Zelle)
    isConciliated?: boolean;
  };
  partialPayments?: PartialPayment[]; // Ahora usa la interfaz exportada
  mixedPayments?: PartialPayment[]; // Para pagos mixtos
  deliveryAddress?: string;
  hasDelivery: boolean;
  // Nueva estructura de servicios de delivery
  deliveryServices?: {
    deliveryExpress?: {
      enabled: boolean;
      cost: number;
      currency: "Bs" | "USD" | "EUR";
    };
    servicioAcarreo?: {
      enabled: boolean;
      cost?: number; // Opcional
      currency: "Bs" | "USD" | "EUR";
    };
    servicioArmado?: {
      enabled: boolean;
      cost: number; // Obligatorio si enabled
      currency: "Bs" | "USD" | "EUR";
    };
  };
  status: "Presupuesto" | "Generado" | "Validado" | "Fabricándose" | "En Almacén" | "En Ruta" | "Completado" | "Cancelado" | "Generada" | "Fabricación" | "Por despachar" | "Completada";
  createdAt: string;
  updatedAt: string;
  productMarkups?: Record<string, number>;
  createSupplierOrder?: boolean;
  observations?: string; // Observaciones generales del pedido
  type?: string;
  baseCurrency?: "Bs" | "USD" | "EUR"; // Moneda base para visualización del pedido
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string };
    EUR?: { rate: number; effectiveDate: string };
  }; // Tasas de cambio del día en que se creó el pedido
  dispatchDate?: string; // Fecha de despacho
  completedAt?: string; // Fecha de completado
}

export interface Client {
  id: string;
  nombreRazonSocial: string;
  apodo?: string;
  rutId: string;
  direccion: string;
  telefono: string;
  telefono2?: string;
  email?: string;
  tipoCliente: "empresa" | "particular";
  estado: "activo" | "inactivo";
  fechaCreacion: string;
  tieneNotasDespacho: boolean;
}

export interface Provider {
  id: string;
  razonSocial: string;
  rif: string;
  direccion: string;
  telefono: string;
  email: string;
  contacto: string;
  tipo: "materia-prima" | "servicios" | "productos-terminados";
  estado: "activo" | "inactivo";
  fechaCreacion: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  rif: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  code: string; // Código de la cuenta (ej: Banesco_POS)
  label: string; // Etiqueta o Nombre (ej: Punto de Venta Banesco)
  storeId: string | "all"; // ID de la tienda asociada o "all" para todas las tiendas
  isForeign: boolean; // true = Extranjera, false = Nacional
  accountType: string; // "Cuentas Digitales", "Ahorro", "Corriente", etc.
  email?: string; // Correo (solo para cuentas digitales)
  wallet?: string; // Wallet (solo para cuentas digitales)
  isActive: boolean; // true = Activa, false = Inactiva
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role:
  | "Super Administrator"
  | "Administrator"
  | "Supervisor"
  | "Store Seller"
  | "Online Seller";
  name: string;
  status: "active" | "inactive";
  createdAt?: string;
  // Campos para comisiones
  exclusiveCommission?: boolean; // Vendedores que NO comparten comisión con referidos
  baseSalary?: number; // Sueldo fijo del vendedor
  baseSalaryCurrency?: string; // Moneda del sueldo
}

export interface Vendor {
  id: string;
  name: string;
  role: string;
  type: "vendor" | "referrer";
}

// ===== ORDERS STORAGE (IndexedDB) =====

/** Presupuestos del API (Type=Budget / PRE-*) no deben mezclarse en el store `orders` ni duplicarse en listados unificados. */
function isBackendBudgetOrder(order: Pick<Order, "type" | "status" | "orderNumber">): boolean {
  const t = (order.type || "").trim().toLowerCase();
  if (t === "budget") return true;
  const num = (order.orderNumber || "").toUpperCase();
  if (num.startsWith("PRE-") && order.status === "Presupuesto") return true;
  return false;
}

// Helper functions para mapear orders entre frontend y backend
/** Si el API no envía paymentCondition pero el método es Cashea (pedidos legacy), se trata como cashea. */
function paymentConditionFromOrderDto(
  dto: OrderResponseDto
): Order["paymentCondition"] | undefined {
  const raw = dto.paymentCondition?.trim();
  if (raw) return raw as Order["paymentCondition"];
  if (dto.paymentMethod?.trim().toLowerCase() === "cashea") return "cashea";
  return undefined;
}

const orderFromBackendDto = (dto: OrderResponseDto): Order => ({
  id: dto.id,
  orderNumber:
    dto.orderNumber ??
    (dto as unknown as { OrderNumber?: string }).OrderNumber ??
    "",
  clientId: dto.clientId,
  clientName: dto.clientName,
  vendorId: dto.vendorId,
  vendorName: dto.vendorName,
  referrerId: dto.referrerId,
  referrerName: dto.referrerName,
  products: dto.products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    quantity: p.quantity,
    total: p.total,
    category: p.category,
    stock: p.stock,
    attributes: p.attributes,
    discount: p.discount,
    observations: p.observations,
    images: p.images?.map((img) => ({
      id: img.id,
      base64: img.base64,
      filename: img.filename,
      type: img.type,
      uploadedAt: img.uploadedAt,
      size: img.size,
    })),
    availabilityStatus: p.availabilityStatus as "disponible" | "no_disponible" | undefined,
    manufacturingStatus: (() => {
      const s = p.manufacturingStatus?.trim().toLowerCase();
      if (!s) return undefined;
      if (s === "fabricado") return "almacen_no_fabricado" as const; // legacy
      if (s === "almacen_no_fabricado" || s === "debe_fabricar" || s === "fabricando") return s as "debe_fabricar" | "fabricando" | "almacen_no_fabricado";
      return undefined;
    })(),
    manufacturingProviderId: p.manufacturingProviderId,
    manufacturingProviderName: p.manufacturingProviderName,
    manufacturingStartedAt: p.manufacturingStartedAt,
    manufacturingCompletedAt: p.manufacturingCompletedAt,
    manufacturingNotes: p.manufacturingNotes,
    locationStatus: (() => {
      // Normalizar valores antiguos a nuevos
      if (p.locationStatus === "en_tienda") return "EN TIENDA" as const
      if (p.locationStatus === "mandar_a_fabricar") return "FABRICACION" as const
      if (p.locationStatus === "SIN DEFINIR") return "DISPONIBILIDAD INMEDIATA" as const
      if (!p.locationStatus || p.locationStatus === "") return "DISPONIBILIDAD INMEDIATA" as const
      return (p.locationStatus as "DISPONIBILIDAD INMEDIATA" | "EN TIENDA" | "FABRICACION" | undefined) ?? "DISPONIBILIDAD INMEDIATA"
    })(),
    logisticStatus: p.logisticStatus,
    surchargeEnabled: p.surchargeEnabled,
    surchargeAmount: p.surchargeAmount,
    surchargeReason: p.surchargeReason,
    refabricationReason: p.refabricationReason,
    refabricatedAt: p.refabricatedAt,
    refabricationHistory: p.refabricationHistory?.map((r) => ({
      reason: r.reason ?? (r as { Reason?: string }).Reason ?? "",
      date:
        typeof r.date === "string"
          ? r.date
          : r.date != null
            ? new Date(r.date as string | number | Date).toISOString()
            : (r as { Date?: string }).Date ?? "",
      previousProviderId: r.previousProviderId ?? (r as { PreviousProviderId?: string }).PreviousProviderId,
      previousProviderName: r.previousProviderName ?? (r as { PreviousProviderName?: string }).PreviousProviderName,
      newProviderId: r.newProviderId ?? (r as { NewProviderId?: string }).NewProviderId,
      newProviderName: r.newProviderName ?? (r as { NewProviderName?: string }).NewProviderName,
    })),
  })),
  subtotal: dto.subtotal,
  taxAmount: dto.taxAmount,
  deliveryCost: dto.deliveryCost,
  total: dto.total,
  subtotalBeforeDiscounts: dto.subtotalBeforeDiscounts,
  productDiscountTotal: dto.productDiscountTotal,
  generalDiscountAmount: dto.generalDiscountAmount,
  paymentType: dto.paymentType as "directo" | "apartado" | "mixto",
  paymentMethod: dto.paymentMethod,
  paymentCondition: paymentConditionFromOrderDto(dto),
  paymentDetails: dto.paymentDetails ? {
    pagomovilReference: dto.paymentDetails.pagomovilReference,
    pagomovilBank: dto.paymentDetails.pagomovilBank,
    pagomovilPhone: dto.paymentDetails.pagomovilPhone,
    pagomovilDate: dto.paymentDetails.pagomovilDate,
    transferenciaBank: dto.paymentDetails.transferenciaBank,
    transferenciaReference: dto.paymentDetails.transferenciaReference,
    transferenciaDate: dto.paymentDetails.transferenciaDate,
    cashAmount: dto.paymentDetails.cashAmount,
    cashCurrency: dto.paymentDetails.cashCurrency,
    cashReceived: dto.paymentDetails.cashReceived,
    exchangeRate: dto.paymentDetails.exchangeRate,
    originalAmount: dto.paymentDetails.originalAmount,
    originalCurrency: dto.paymentDetails.originalCurrency,
    accountId: dto.paymentDetails.accountId,
    accountNumber: dto.paymentDetails.accountNumber,
    bank: dto.paymentDetails.bank,
    email: dto.paymentDetails.email,
    wallet: dto.paymentDetails.wallet,
    envia: dto.paymentDetails.envia,
    isConciliated: dto.paymentDetails.isConciliated,
  } : undefined,
  partialPayments: dto.partialPayments?.map((p) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    date: p.date,
    currency: undefined, // Se puede ajustar según necesidades
    images: p.images?.map((img) => ({
      id: img.id,
      base64: img.base64,
      filename: img.filename,
      type: img.type,
      uploadedAt: img.uploadedAt,
      size: img.size,
    })),
    paymentDetails: p.paymentDetails ? {
      pagomovilReference: p.paymentDetails.pagomovilReference,
      pagomovilBank: p.paymentDetails.pagomovilBank,
      pagomovilPhone: p.paymentDetails.pagomovilPhone,
      pagomovilDate: p.paymentDetails.pagomovilDate,
      transferenciaBank: p.paymentDetails.transferenciaBank,
      transferenciaReference: p.paymentDetails.transferenciaReference,
      transferenciaDate: p.paymentDetails.transferenciaDate,
      cashAmount: p.paymentDetails.cashAmount,
      cashCurrency: p.paymentDetails.cashCurrency,
      cashReceived: p.paymentDetails.cashReceived,
      exchangeRate: p.paymentDetails.exchangeRate,
      originalAmount: p.paymentDetails.originalAmount,
      originalCurrency: p.paymentDetails.originalCurrency,
      accountId: p.paymentDetails.accountId,
      accountNumber: p.paymentDetails.accountNumber,
      bank: p.paymentDetails.bank,
      email: p.paymentDetails.email,
      wallet: p.paymentDetails.wallet,
      envia: p.paymentDetails.envia,
      isConciliated: p.paymentDetails.isConciliated,
    } : undefined,
  })),
  mixedPayments: dto.mixedPayments?.map((p) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    date: p.date,
    currency: undefined,
    images: p.images?.map((img) => ({
      id: img.id,
      base64: img.base64,
      filename: img.filename,
      type: img.type,
      uploadedAt: img.uploadedAt,
      size: img.size,
    })),
    paymentDetails: p.paymentDetails ? {
      pagomovilReference: p.paymentDetails.pagomovilReference,
      pagomovilBank: p.paymentDetails.pagomovilBank,
      pagomovilPhone: p.paymentDetails.pagomovilPhone,
      pagomovilDate: p.paymentDetails.pagomovilDate,
      transferenciaBank: p.paymentDetails.transferenciaBank,
      transferenciaReference: p.paymentDetails.transferenciaReference,
      transferenciaDate: p.paymentDetails.transferenciaDate,
      cashAmount: p.paymentDetails.cashAmount,
      cashCurrency: p.paymentDetails.cashCurrency,
      cashReceived: p.paymentDetails.cashReceived,
      exchangeRate: p.paymentDetails.exchangeRate,
      originalAmount: p.paymentDetails.originalAmount,
      originalCurrency: p.paymentDetails.originalCurrency,
      accountId: p.paymentDetails.accountId,
      accountNumber: p.paymentDetails.accountNumber,
      bank: p.paymentDetails.bank,
      email: p.paymentDetails.email,
      wallet: p.paymentDetails.wallet,
      envia: p.paymentDetails.envia,
      isConciliated: p.paymentDetails.isConciliated,
    } : undefined,
  })),
  deliveryAddress: dto.deliveryAddress,
  hasDelivery: dto.hasDelivery,
  status: dto.status as Order["status"],
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  productMarkups: dto.productMarkups,
  createSupplierOrder: dto.createSupplierOrder,
  observations: dto.observations,
  saleType: dto.saleType as Order["saleType"],
  deliveryType: dto.deliveryType as Order["deliveryType"],
  deliveryZone: dto.deliveryZone as Order["deliveryZone"],
  deliveryServices: dto.deliveryServices,
  exchangeRatesAtCreation: normalizeExchangeRatesAtCreation(
    dto.exchangeRatesAtCreation
  ),
  baseCurrency: dto.baseCurrency,
  dispatchDate: dto.dispatchDate,
  completedAt: dto.completedAt,
  type: dto.type ?? (dto as unknown as { Type?: string }).Type ?? "Order",
});

export const orderToBackendDto = (order: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">): CreateOrderDto => ({
  clientId: order.clientId,
  clientName: order.clientName,
  vendorId: order.vendorId,
  vendorName: order.vendorName,
  referrerId: order.referrerId,
  referrerName: order.referrerName,
  products: order.products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    quantity: p.quantity,
    total: p.total,
    category: p.category,
    stock: p.stock,
    attributes: p.attributes,
    discount: p.discount,
    observations: p.observations,
    images: p.images?.map((img) => ({
      id: img.id,
      base64: img.base64,
      filename: img.filename,
      type: img.type,
      uploadedAt: img.uploadedAt,
      size: img.size,
    })),
    availabilityStatus: p.availabilityStatus,
    manufacturingStatus: p.manufacturingStatus,
    manufacturingProviderId: p.manufacturingProviderId,
    manufacturingProviderName: p.manufacturingProviderName,
    manufacturingStartedAt: p.manufacturingStartedAt,
    manufacturingCompletedAt: p.manufacturingCompletedAt,
    manufacturingNotes: p.manufacturingNotes,
    locationStatus: p.locationStatus,
    logisticStatus: p.logisticStatus,
    surchargeEnabled: p.surchargeEnabled,
    surchargeAmount: p.surchargeAmount,
    surchargeReason: p.surchargeReason,
    refabricationReason: p.refabricationReason,
    refabricatedAt: p.refabricatedAt,
    refabricationHistory: p.refabricationHistory?.map((r) => ({
      reason: r.reason,
      date: r.date,
      previousProviderId: r.previousProviderId,
      previousProviderName: r.previousProviderName,
      newProviderId: r.newProviderId,
      newProviderName: r.newProviderName,
    })),
  })),
  subtotal: order.subtotal,
  taxAmount: order.taxAmount,
  deliveryCost: order.deliveryCost,
  total: order.total,
  subtotalBeforeDiscounts: order.subtotalBeforeDiscounts,
  productDiscountTotal: order.productDiscountTotal,
  generalDiscountAmount: order.generalDiscountAmount,
  paymentType: order.paymentType,
  paymentMethod: order.paymentMethod,
  paymentCondition: order.paymentCondition,
  paymentDetails: order.paymentDetails ? {
    pagomovilReference: order.paymentDetails.pagomovilReference,
    pagomovilBank: order.paymentDetails.pagomovilBank,
    pagomovilPhone: order.paymentDetails.pagomovilPhone,
    pagomovilDate: order.paymentDetails.pagomovilDate,
    transferenciaBank: order.paymentDetails.transferenciaBank,
    transferenciaReference: order.paymentDetails.transferenciaReference,
    transferenciaDate: order.paymentDetails.transferenciaDate,
    cashAmount: order.paymentDetails.cashAmount,
    cashCurrency: order.paymentDetails.cashCurrency,
    cashReceived: order.paymentDetails.cashReceived,
    exchangeRate: order.paymentDetails.exchangeRate,
    originalAmount: order.paymentDetails.originalAmount,
    originalCurrency: order.paymentDetails.originalCurrency,
    accountId: order.paymentDetails.accountId,
    accountNumber: order.paymentDetails.accountNumber,
    bank: order.paymentDetails.bank,
    email: order.paymentDetails.email,
    wallet: order.paymentDetails.wallet,
    envia: order.paymentDetails.envia,
    isConciliated: order.paymentDetails.isConciliated,
  } : undefined,
  partialPayments: order.partialPayments?.map((p) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    date: p.date,
    images: p.images?.map((img) => ({
      id: img.id,
      base64: img.base64,
      filename: img.filename,
      type: img.type,
      uploadedAt: img.uploadedAt,
      size: img.size,
    })),
    paymentDetails: p.paymentDetails ? {
      pagomovilReference: p.paymentDetails.pagomovilReference,
      pagomovilBank: p.paymentDetails.pagomovilBank,
      pagomovilPhone: p.paymentDetails.pagomovilPhone,
      pagomovilDate: p.paymentDetails.pagomovilDate,
      transferenciaBank: p.paymentDetails.transferenciaBank,
      transferenciaReference: p.paymentDetails.transferenciaReference,
      transferenciaDate: p.paymentDetails.transferenciaDate,
      cashAmount: p.paymentDetails.cashAmount,
      cashCurrency: p.paymentDetails.cashCurrency,
      cashReceived: p.paymentDetails.cashReceived,
      exchangeRate: p.paymentDetails.exchangeRate,
      originalAmount: p.paymentDetails.originalAmount,
      originalCurrency: p.paymentDetails.originalCurrency,
      accountId: p.paymentDetails.accountId,
      accountNumber: p.paymentDetails.accountNumber,
      bank: p.paymentDetails.bank,
      email: p.paymentDetails.email,
      wallet: p.paymentDetails.wallet,
      envia: p.paymentDetails.envia,
      isConciliated: p.paymentDetails.isConciliated,
    } : undefined,
  })),
  mixedPayments: order.mixedPayments?.map((p) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    date: p.date,
    images: p.images?.map((img) => ({
      id: img.id,
      base64: img.base64,
      filename: img.filename,
      type: img.type,
      uploadedAt: img.uploadedAt,
      size: img.size,
    })),
    paymentDetails: p.paymentDetails ? {
      pagomovilReference: p.paymentDetails.pagomovilReference,
      pagomovilBank: p.paymentDetails.pagomovilBank,
      pagomovilPhone: p.paymentDetails.pagomovilPhone,
      pagomovilDate: p.paymentDetails.pagomovilDate,
      transferenciaBank: p.paymentDetails.transferenciaBank,
      transferenciaReference: p.paymentDetails.transferenciaReference,
      transferenciaDate: p.paymentDetails.transferenciaDate,
      cashAmount: p.paymentDetails.cashAmount,
      cashCurrency: p.paymentDetails.cashCurrency,
      cashReceived: p.paymentDetails.cashReceived,
      exchangeRate: p.paymentDetails.exchangeRate,
      originalAmount: p.paymentDetails.originalAmount,
      originalCurrency: p.paymentDetails.originalCurrency,
      accountId: p.paymentDetails.accountId,
      accountNumber: p.paymentDetails.accountNumber,
      bank: p.paymentDetails.bank,
      email: p.paymentDetails.email,
      wallet: p.paymentDetails.wallet,
      envia: p.paymentDetails.envia,
      isConciliated: p.paymentDetails.isConciliated,
    } : undefined,
  })),
  deliveryAddress: order.deliveryAddress,
  hasDelivery: order.hasDelivery,
  status: order.status,
  productMarkups: order.productMarkups,
  createSupplierOrder: order.createSupplierOrder,
  observations: order.observations,
  saleType: order.saleType,
  deliveryType: order.deliveryType,
  deliveryZone: order.deliveryZone,
  exchangeRatesAtCreation: order.exchangeRatesAtCreation,
});

/**
 * Opciones de compatibilidad (server-first ignora throttles; refresh fuerza fetch desde API).
 */
export type GetOrdersOptions = {
  forceFullSync?: boolean;
  refreshFromBackend?: boolean;
};

export const getOrders = async (
  optionsOrForceFull?: boolean | GetOrdersOptions
): Promise<Order[]> => {
  try {
    const localOrders = await db.getAll<Order>("orders");

    if (!isOnline()) {
      console.log(`Órdenes desde IndexedDB (offline): ${localOrders.length}`);
      return localOrders;
    }

    try {
      const allOrders: Order[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await apiClient.getOrdersPaged(page, 50);
        const mappedOrders = response.orders.map(orderFromBackendDto);
        allOrders.push(...mappedOrders);
        hasMore = response.hasNextPage;
        page++;
        console.log(
          `Pedidos página ${page - 1}: ${mappedOrders.length} (acumulado: ${allOrders.length}/${response.totalCount})`
        );
      }

      // Presupuestos: misma sincronización paginada que los pedidos → cache en `budgets` (lista estable al refrescar).
      for (const order of allOrders) {
        if (!isBackendBudgetOrder(order)) continue;
        try {
          await db.remove("orders", order.id);
        } catch {
          /* no estaba en orders */
        }
        try {
          await db.put("budgets", orderMappedToBudget(order));
        } catch (err) {
          console.warn(`Error guardando presupuesto ${order.orderNumber} en IndexedDB:`, err);
        }
      }

      const ordersOnly = allOrders.filter((o) => !isBackendBudgetOrder(o));
      const backendNumbers = new Set(ordersOnly.map((o) => o.orderNumber));
      const localOnly = localOrders.filter(
        (o) => !backendNumbers.has(o.orderNumber) && !isBackendBudgetOrder(o),
      );

      for (const order of ordersOnly) {
        try {
          await db.put("orders", order);
        } catch (err) {
          console.warn(`Error guardando orden ${order.orderNumber} en IndexedDB:`, err);
        }
      }

      const merged = [...ordersOnly, ...localOnly];
      console.log(
        `Órdenes (sin presupuestos en store orders): ${ordersOnly.length} del servidor + ${localOnly.length} solo locales = ${merged.length}`
      );
      return merged;
    } catch (error) {
      console.warn("Error obteniendo órdenes del servidor, usando IndexedDB:", error);
      return localOrders;
    }
  } catch (error) {
    console.error("Error loading orders:", error);
    return [];
  }
};

/**
 * Con conexión: GET al backend por número, persiste en IndexedDB y devuelve el pedido (fuente de verdad).
 * Sin conexión o si falla el API: último dato local por orderNumber.
 */
export const getOrderByOrderNumberPreferBackend = async (
  orderNumber: string
): Promise<Order | undefined> => {
  const localFallback = async (): Promise<Order | undefined> => {
    const orders = await db.getAll<Order>("orders");
    return orders.find((o) => o.orderNumber === orderNumber);
  };

  if (!isOnline()) {
    return localFallback();
  }

  try {
    const dto = await apiClient.getOrderByOrderNumber(orderNumber);
    const order = orderFromBackendDto(dto);
    await db.put("orders", order);
    return order;
  } catch (error) {
    console.warn(
      `⚠️ No se pudo obtener el pedido ${orderNumber} desde el backend, usando IndexedDB:`,
      error
    );
    return localFallback();
  }
};

export const getOrder = async (id: string): Promise<Order | undefined> => {
  try {
    if (isOnline()) {
      try {
        const dto = await apiClient.getOrderById(id);
        const order = orderFromBackendDto(dto);
        await db.put("orders", order);
        return order;
      } catch (error) {
        console.warn("getOrder: API falló, usando IndexedDB", error);
      }
    }
    return await db.get<Order>("orders", id);
  } catch (error) {
    console.error("Error loading order:", error);
    return undefined;
  }
};

export const getOrdersByClient = async (clientId: string): Promise<Order[]> => {
  try {
    const all = await getOrders();
    return all.filter((o) => o.clientId === clientId);
  } catch (error) {
    console.error("Error loading orders by client:", error);
    return [];
  }
};

export const getOrdersByStatus = async (status: string): Promise<Order[]> => {
  try {
    const all = await getOrders();
    return all.filter((o) => o.status === status);
  } catch (error) {
    console.error("Error loading orders by status:", error);
    return [];
  }
};

export const addOrder = async (
  order: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt">
): Promise<Order> => {
  let newOrder: Order;
  let syncedToBackend = false;

  // Intentar guardar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      const createDto = orderToBackendDto(order);
      const backendOrder = await apiClient.createOrder(createDto);
      newOrder = orderFromBackendDto(backendOrder);

      console.log("✅ Pedido guardado en backend:", newOrder.orderNumber);
      syncedToBackend = true;
      return newOrder;
    } catch (error) {
      console.warn(
        "⚠️ Error guardando pedido en backend, guardando localmente:",
        error
      );
      // Continuar para guardar localmente y encolar para sincronización
    }
  }

  // Guardar en IndexedDB (offline o falló el backend)
  try {
    const orders = await db.getAll<Order>("orders");
    const orderNumber = `ORD-${String(orders.length + 1).padStart(3, "0")}`;

    newOrder = {
      ...order,
      id: Date.now().toString(),
      orderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: order.status || "Generado", // Estado inicial para pedidos normales
    };

    // DEBUG: Verificar imágenes antes de guardar
    newOrder.products.forEach((p, idx) => {
      if (p.images && p.images.length > 0) {
        console.log(`💾 Guardando pedido: Producto ${idx} (${p.name}) tiene ${p.images.length} imágenes`);
      } else {
        console.log(`⚠️ Guardando pedido: Producto ${idx} (${p.name}) NO tiene imágenes`);
      }
    });

    await db.add("orders", newOrder);
    console.log("✅ Pedido guardado en IndexedDB:", newOrder.orderNumber);

    // Encolar para sincronización si NO se sincronizó con el backend
    if (!syncedToBackend) {
      try {
        const createDto = orderToBackendDto(newOrder);
        await syncManager.addToQueue({
          type: "create",
          entity: "order",
          entityId: newOrder.id,
          data: createDto,
        });
        console.log("✅ Pedido encolado para sincronización:", newOrder.orderNumber);
      } catch (error) {
        console.warn("⚠️ Error encolando pedido para sincronización:", error);
        // No lanzar error, el pedido ya está guardado localmente
      }
    }

    return newOrder;
  } catch (error) {
    console.error("Error adding order to IndexedDB:", error);
    throw error;
  }
};

export const updateOrder = async (
  id: string,
  updates: Partial<Order>
): Promise<Order> => {
  try {
    const existingOrder = await getOrder(id);
    if (!existingOrder) {
      throw new Error(`Order with id ${id} not found`);
    }

    const updatedOrder: Order = {
      ...existingOrder,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Intentar actualizar en el backend si hay conexión
    if (isOnline()) {
      try {
        // Buscar el pedido en el backend por orderNumber para obtener su ObjectId
        let backendOrderId: string | null = null;
        try {
          const backendOrder = await apiClient.getOrderByOrderNumber(existingOrder.orderNumber);
          if (backendOrder) {
            backendOrderId = backendOrder.id;
          }
        } catch (error) {
          // El pedido no existe en el backend todavía
          console.warn(
            "⚠️ Pedido no encontrado en backend por orderNumber, actualizando solo localmente"
          );
        }

        // Si encontramos el pedido en el backend, actualizarlo
        if (backendOrderId) {
          const updateDto: UpdateOrderDto = {
            clientId: updatedOrder.clientId !== existingOrder.clientId ? updatedOrder.clientId : undefined,
            clientName: updatedOrder.clientName !== existingOrder.clientName ? updatedOrder.clientName : undefined,
            vendorId: updatedOrder.vendorId !== existingOrder.vendorId ? updatedOrder.vendorId : undefined,
            vendorName: updatedOrder.vendorName !== existingOrder.vendorName ? updatedOrder.vendorName : undefined,
            referrerId: updatedOrder.referrerId !== existingOrder.referrerId ? updatedOrder.referrerId : undefined,
            referrerName: updatedOrder.referrerName !== existingOrder.referrerName ? updatedOrder.referrerName : undefined,
            products: updatedOrder.products !== existingOrder.products ? updatedOrder.products.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              quantity: p.quantity,
              total: p.total,
              category: p.category,
              stock: p.stock,
              attributes: p.attributes,
              discount: p.discount,
              observations: p.observations,
              images: p.images?.map((img) => ({
                id: img.id,
                base64: img.base64,
                filename: img.filename,
                type: img.type,
                uploadedAt: img.uploadedAt,
                size: img.size,
              })),
              availabilityStatus: p.availabilityStatus,
              manufacturingStatus: p.manufacturingStatus,
              manufacturingProviderId: p.manufacturingProviderId,
              manufacturingProviderName: p.manufacturingProviderName,
              manufacturingStartedAt: p.manufacturingStartedAt,
              manufacturingCompletedAt: p.manufacturingCompletedAt,
              manufacturingNotes: p.manufacturingNotes,
              locationStatus: p.locationStatus,
              logisticStatus: p.logisticStatus,
              surchargeEnabled: p.surchargeEnabled,
              surchargeAmount: p.surchargeAmount,
              surchargeReason: p.surchargeReason,
              refabricationReason: p.refabricationReason,
              refabricatedAt: p.refabricatedAt,
              refabricationHistory: p.refabricationHistory?.map((r) => ({
                reason: r.reason,
                date: r.date,
                previousProviderId: r.previousProviderId,
                previousProviderName: r.previousProviderName,
                newProviderId: r.newProviderId,
                newProviderName: r.newProviderName,
              })),
            })) : undefined,
            subtotal: updatedOrder.subtotal !== existingOrder.subtotal ? updatedOrder.subtotal : undefined,
            taxAmount: updatedOrder.taxAmount !== existingOrder.taxAmount ? updatedOrder.taxAmount : undefined,
            deliveryCost: updatedOrder.deliveryCost !== existingOrder.deliveryCost ? updatedOrder.deliveryCost : undefined,
            total: updatedOrder.total !== existingOrder.total ? updatedOrder.total : undefined,
            subtotalBeforeDiscounts: updatedOrder.subtotalBeforeDiscounts !== existingOrder.subtotalBeforeDiscounts ? updatedOrder.subtotalBeforeDiscounts : undefined,
            productDiscountTotal: updatedOrder.productDiscountTotal !== existingOrder.productDiscountTotal ? updatedOrder.productDiscountTotal : undefined,
            generalDiscountAmount: updatedOrder.generalDiscountAmount !== existingOrder.generalDiscountAmount ? updatedOrder.generalDiscountAmount : undefined,
            paymentType: updatedOrder.paymentType !== existingOrder.paymentType ? updatedOrder.paymentType : undefined,
            paymentMethod: updatedOrder.paymentMethod !== existingOrder.paymentMethod ? updatedOrder.paymentMethod : undefined,
            paymentCondition: updatedOrder.paymentCondition !== existingOrder.paymentCondition ? updatedOrder.paymentCondition : undefined,
            partialPayments: updatedOrder.partialPayments !== existingOrder.partialPayments ? updatedOrder.partialPayments?.map((p) => ({
              id: p.id,
              amount: p.amount,
              method: p.method,
              date: p.date,
              images: p.images?.map((img) => ({
                id: img.id,
                base64: img.base64,
                filename: img.filename,
                type: img.type,
                uploadedAt: img.uploadedAt,
                size: img.size,
              })),
              paymentDetails: p.paymentDetails ? {
                pagomovilReference: p.paymentDetails.pagomovilReference,
                pagomovilBank: p.paymentDetails.pagomovilBank,
                pagomovilPhone: p.paymentDetails.pagomovilPhone,
                pagomovilDate: p.paymentDetails.pagomovilDate,
                transferenciaBank: p.paymentDetails.transferenciaBank,
                transferenciaReference: p.paymentDetails.transferenciaReference,
                transferenciaDate: p.paymentDetails.transferenciaDate,
                cashAmount: p.paymentDetails.cashAmount,
                cashCurrency: p.paymentDetails.cashCurrency,
                cashReceived: p.paymentDetails.cashReceived,
                exchangeRate: p.paymentDetails.exchangeRate,
                originalAmount: p.paymentDetails.originalAmount,
                originalCurrency: p.paymentDetails.originalCurrency,
                accountId: p.paymentDetails.accountId,
                accountNumber: p.paymentDetails.accountNumber,
                bank: p.paymentDetails.bank,
                email: p.paymentDetails.email,
                wallet: p.paymentDetails.wallet,
                envia: p.paymentDetails.envia,
                isConciliated: p.paymentDetails.isConciliated,
              } : undefined,
            })) : undefined,
            mixedPayments: updatedOrder.mixedPayments !== existingOrder.mixedPayments ? updatedOrder.mixedPayments?.map((p) => ({
              id: p.id,
              amount: p.amount,
              method: p.method,
              date: p.date,
              images: p.images?.map((img) => ({
                id: img.id,
                base64: img.base64,
                filename: img.filename,
                type: img.type,
                uploadedAt: img.uploadedAt,
                size: img.size,
              })),
              paymentDetails: p.paymentDetails ? {
                pagomovilReference: p.paymentDetails.pagomovilReference,
                pagomovilBank: p.paymentDetails.pagomovilBank,
                pagomovilPhone: p.paymentDetails.pagomovilPhone,
                pagomovilDate: p.paymentDetails.pagomovilDate,
                transferenciaBank: p.paymentDetails.transferenciaBank,
                transferenciaReference: p.paymentDetails.transferenciaReference,
                transferenciaDate: p.paymentDetails.transferenciaDate,
                cashAmount: p.paymentDetails.cashAmount,
                cashCurrency: p.paymentDetails.cashCurrency,
                cashReceived: p.paymentDetails.cashReceived,
                exchangeRate: p.paymentDetails.exchangeRate,
                originalAmount: p.paymentDetails.originalAmount,
                originalCurrency: p.paymentDetails.originalCurrency,
                accountId: p.paymentDetails.accountId,
                accountNumber: p.paymentDetails.accountNumber,
                bank: p.paymentDetails.bank,
                email: p.paymentDetails.email,
                wallet: p.paymentDetails.wallet,
                envia: p.paymentDetails.envia,
                isConciliated: p.paymentDetails.isConciliated,
              } : undefined,
            })) : undefined,
            deliveryAddress: updatedOrder.deliveryAddress !== existingOrder.deliveryAddress ? updatedOrder.deliveryAddress : undefined,
            hasDelivery: updatedOrder.hasDelivery !== existingOrder.hasDelivery ? updatedOrder.hasDelivery : undefined,
            deliveryServices:
              JSON.stringify(updatedOrder.deliveryServices) !== JSON.stringify(existingOrder.deliveryServices)
                ? updatedOrder.deliveryServices
                : undefined,
            status: updatedOrder.status !== existingOrder.status ? updatedOrder.status : undefined,
            observations: updatedOrder.observations !== existingOrder.observations ? updatedOrder.observations : undefined,
          };

          // Remover campos undefined
          Object.keys(updateDto).forEach(key => {
            if (updateDto[key as keyof UpdateOrderDto] === undefined) {
              delete updateDto[key as keyof UpdateOrderDto];
            }
          });

          const backendOrder = await apiClient.updateOrder(backendOrderId, updateDto);
          const syncedOrder = orderFromBackendDto(backendOrder);

          console.log("✅ Pedido actualizado en backend:", syncedOrder.orderNumber);
          return syncedOrder;
        } else {
          // El pedido no existe en el backend, actualizar localmente y encolar para sincronización
          console.log(
            "⚠️ Pedido no existe en backend, actualizando localmente y encolando para sincronización"
          );
          // Continuar para guardar localmente y encolar
        }
      } catch (error) {
        console.warn(
          "⚠️ Error actualizando pedido en backend, guardando localmente:",
          error
        );
        // Continuar para guardar localmente
      }
    }

    // Guardar en IndexedDB
    await db.update("orders", updatedOrder);

    // Encolar para sincronización si el pedido no está en el backend o estamos offline
    if (!isOnline() || !(await apiClient.getOrderByOrderNumber(existingOrder.orderNumber).then(() => true).catch(() => false))) {
      try {
        const updateDto: UpdateOrderDto = {
          products: updatedOrder.products.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            quantity: p.quantity,
            total: p.total,
            category: p.category,
            stock: p.stock,
            attributes: p.attributes,
            discount: p.discount,
            observations: p.observations,
            images: p.images?.map((img) => ({
              id: img.id,
              base64: img.base64,
              filename: img.filename,
              type: img.type,
              uploadedAt: img.uploadedAt,
              size: img.size,
            })),
            availabilityStatus: p.availabilityStatus,
            manufacturingStatus: p.manufacturingStatus,
            manufacturingProviderId: p.manufacturingProviderId,
            manufacturingProviderName: p.manufacturingProviderName,
            manufacturingStartedAt: p.manufacturingStartedAt,
            manufacturingCompletedAt: p.manufacturingCompletedAt,
            manufacturingNotes: p.manufacturingNotes,
            locationStatus: p.locationStatus,
            logisticStatus: p.logisticStatus,
            surchargeEnabled: p.surchargeEnabled,
            surchargeAmount: p.surchargeAmount,
            surchargeReason: p.surchargeReason,
            refabricationReason: p.refabricationReason,
            refabricatedAt: p.refabricatedAt,
            refabricationHistory: p.refabricationHistory?.map((r) => ({
              reason: r.reason,
              date: r.date,
              previousProviderId: r.previousProviderId,
              previousProviderName: r.previousProviderName,
              newProviderId: r.newProviderId,
              newProviderName: r.newProviderName,
            })),
          })),
          partialPayments: updatedOrder.partialPayments?.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            date: p.date,
            images: p.images?.map((img) => ({
              id: img.id,
              base64: img.base64,
              filename: img.filename,
              type: img.type,
              uploadedAt: img.uploadedAt,
              size: img.size,
            })),
            paymentDetails: p.paymentDetails ? {
              pagomovilReference: p.paymentDetails.pagomovilReference,
              pagomovilBank: p.paymentDetails.pagomovilBank,
              pagomovilPhone: p.paymentDetails.pagomovilPhone,
              pagomovilDate: p.paymentDetails.pagomovilDate,
              transferenciaBank: p.paymentDetails.transferenciaBank,
              transferenciaReference: p.paymentDetails.transferenciaReference,
              transferenciaDate: p.paymentDetails.transferenciaDate,
              cashAmount: p.paymentDetails.cashAmount,
              cashCurrency: p.paymentDetails.cashCurrency,
              cashReceived: p.paymentDetails.cashReceived,
              exchangeRate: p.paymentDetails.exchangeRate,
              originalAmount: p.paymentDetails.originalAmount,
              originalCurrency: p.paymentDetails.originalCurrency,
              accountId: p.paymentDetails.accountId,
              accountNumber: p.paymentDetails.accountNumber,
              bank: p.paymentDetails.bank,
              email: p.paymentDetails.email,
              wallet: p.paymentDetails.wallet,
              envia: p.paymentDetails.envia,
              isConciliated: p.paymentDetails.isConciliated,
            } : undefined,
          })),
          mixedPayments: updatedOrder.mixedPayments?.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            date: p.date,
            images: p.images?.map((img) => ({
              id: img.id,
              base64: img.base64,
              filename: img.filename,
              type: img.type,
              uploadedAt: img.uploadedAt,
              size: img.size,
            })),
            paymentDetails: p.paymentDetails ? {
              pagomovilReference: p.paymentDetails.pagomovilReference,
              pagomovilBank: p.paymentDetails.pagomovilBank,
              pagomovilPhone: p.paymentDetails.pagomovilPhone,
              pagomovilDate: p.paymentDetails.pagomovilDate,
              transferenciaBank: p.paymentDetails.transferenciaBank,
              transferenciaReference: p.paymentDetails.transferenciaReference,
              transferenciaDate: p.paymentDetails.transferenciaDate,
              cashAmount: p.paymentDetails.cashAmount,
              cashCurrency: p.paymentDetails.cashCurrency,
              cashReceived: p.paymentDetails.cashReceived,
              exchangeRate: p.paymentDetails.exchangeRate,
              originalAmount: p.paymentDetails.originalAmount,
              originalCurrency: p.paymentDetails.originalCurrency,
              accountId: p.paymentDetails.accountId,
              accountNumber: p.paymentDetails.accountNumber,
              bank: p.paymentDetails.bank,
              email: p.paymentDetails.email,
              wallet: p.paymentDetails.wallet,
              envia: p.paymentDetails.envia,
              isConciliated: p.paymentDetails.isConciliated,
            } : undefined,
          })),
          status: updatedOrder.status,
          deliveryServices: updatedOrder.deliveryServices,
        };
        await syncManager.addToQueue({
          type: "update",
          entity: "order",
          entityId: id,
          data: updateDto,
        });
        console.log("✅ Pedido encolado para sincronización");
      } catch (error) {
        console.warn("⚠️ Error encolando pedido para sincronización:", error);
      }
    }

    return updatedOrder;
  } catch (error) {
    console.error("Error updating order in IndexedDB:", error);
    throw error;
  }
};

export const deleteOrder = async (id: string): Promise<void> => {
  try {
    const existingOrder = await getOrder(id);
    if (!existingOrder) {
      throw new Error(`Order with id ${id} not found`);
    }

    let deletedFromBackend = false;
    let shouldEnqueue = false;

    // Intentar eliminar en el backend primero si hay conexión
    if (isOnline()) {
      try {
        // Buscar el pedido en el backend por orderNumber para obtener su ObjectId
        let backendOrderId: string | null = null;
        try {
          const backendOrder = await apiClient.getOrderByOrderNumber(existingOrder.orderNumber);
          if (backendOrder) {
            backendOrderId = backendOrder.id;
          }
        } catch (error) {
          // El pedido no existe en el backend
          console.warn(
            "⚠️ Pedido no encontrado en backend por orderNumber, eliminando solo localmente"
          );
        }

        // Si encontramos el pedido en el backend, eliminarlo
        if (backendOrderId) {
          await apiClient.deleteOrder(backendOrderId);
          console.log("✅ Pedido eliminado del backend:", existingOrder.orderNumber);
          deletedFromBackend = true;
        }
      } catch (error) {
        console.warn(
          "⚠️ Error eliminando pedido en backend, eliminando localmente y encolando:",
          error
        );
        // Si hay un error, necesitamos encolar para sincronización
        shouldEnqueue = true;
      }
    } else {
      // Si estamos offline, encolar para sincronización
      shouldEnqueue = true;
    }

    // Eliminar de IndexedDB
    await db.remove("orders", id);
    console.log("✅ Pedido eliminado de IndexedDB:", existingOrder.orderNumber);

    // Encolar para sincronización si NO se eliminó del backend
    if (shouldEnqueue) {
      try {
        await syncManager.addToQueue({
          type: "delete",
          entity: "order",
          entityId: id,
          data: null, // Para delete no necesitamos datos
        });
        console.log("✅ Eliminación de pedido encolada para sincronización:", existingOrder.orderNumber);
      } catch (error) {
        console.warn("⚠️ Error encolando eliminación de pedido para sincronización:", error);
        // No lanzar error, el pedido ya fue eliminado localmente
      }
    }
  } catch (error) {
    console.error("Error deleting order from IndexedDB:", error);
    throw error;
  }
};

// ===== UNIFIED ORDERS (Pedidos + Presupuestos) =====

// Interfaz unificada para mostrar pedidos y presupuestos juntos
export interface UnifiedOrder {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  products: OrderProduct[];
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  deliveryAddress?: string;
  hasDelivery: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  observations?: string;
  baseCurrency?: "Bs" | "USD" | "EUR";
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string };
    EUR?: { rate: number; effectiveDate: string };
  };
  type: "order" | "budget"; // Para distinguir entre pedido y presupuesto
  expiresAt?: string; // Solo para presupuestos
  validForDays?: number; // Solo para presupuestos
  paymentMethod?: string; // Solo para pedidos
  saleType?: "delivery_express" | "encargo" | "encargo_entrega" | "entrega" | "retiro_almacen" | "retiro_tienda" | "sistema_apartado";
  deliveryType?: "entrega_programada" | "delivery_express" | "retiro_tienda" | "retiro_almacen";
  deliveryZone?: "caracas" | "g_g" | "san_antonio_los_teques" | "caucagua_higuerote" | "la_guaira" | "charallave_cua" | "interior_pais";
  deliveryServices?: Order["deliveryServices"];
  dispatchDate?: string; // Fecha de despacho
  completedAt?: string; // Fecha de completado
  partialPayments?: PartialPayment[]; // Para mostrar saldo pendiente / debe en USD en listados
}

// Función para obtener pedidos y presupuestos unificados
export const getUnifiedOrders = async (): Promise<UnifiedOrder[]> => {
  try {
    // Secuencial: getOrders sincroniza primero y escribe presupuestos en `budgets`; luego getBudgets refina con el API por estado.
    const orders = await getOrders();
    const budgets = await getBudgets();

    const budgetIds = new Set(budgets.map((b) => b.id));
    const budgetNumbers = new Set(
      budgets.map((b) => b.budgetNumber).filter(Boolean),
    );

    // Pedidos reales: excluir presupuestos (evita duplicar con la lista de getBudgets)
    const ordersForUnified = orders.filter(
      (o) =>
        !isBackendBudgetOrder(o) &&
        !budgetIds.has(o.id) &&
        !budgetNumbers.has(o.orderNumber),
    );

    // Convertir pedidos a formato unificado
    const unifiedOrders: UnifiedOrder[] = ordersForUnified.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      clientId: order.clientId,
      clientName: order.clientName,
      vendorId: order.vendorId,
      vendorName: order.vendorName,
      referrerId: order.referrerId,
      referrerName: order.referrerName,
      products: order.products,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      deliveryCost: order.deliveryCost,
      total: order.total,
      subtotalBeforeDiscounts: order.subtotalBeforeDiscounts,
      productDiscountTotal: order.productDiscountTotal,
      generalDiscountAmount: order.generalDiscountAmount,
      deliveryAddress: order.deliveryAddress,
      hasDelivery: order.hasDelivery,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      observations: order.observations,
      baseCurrency: order.baseCurrency,
      exchangeRatesAtCreation: order.exchangeRatesAtCreation,
      type: "order",
      paymentMethod: order.paymentMethod,
      saleType: order.saleType,
      deliveryType: order.deliveryType,
      deliveryZone: order.deliveryZone,
      deliveryServices: order.deliveryServices,
      dispatchDate: order.dispatchDate,
      completedAt: order.completedAt,
      partialPayments: order.partialPayments,
    }));

    // Convertir presupuestos a formato unificado
    const unifiedBudgets: UnifiedOrder[] = budgets.map((budget) => ({
      id: budget.id,
      orderNumber:
        budget.budgetNumber ||
        (budget as unknown as { orderNumber?: string }).orderNumber ||
        "",
      clientId: budget.clientId,
      clientName: budget.clientName,
      vendorId: budget.vendorId,
      vendorName: budget.vendorName,
      referrerId: budget.referrerId,
      referrerName: budget.referrerName,
      products: budget.products,
      subtotal: budget.subtotal,
      taxAmount: budget.taxAmount,
      deliveryCost: budget.deliveryCost,
      total: budget.total,
      subtotalBeforeDiscounts: budget.subtotalBeforeDiscounts,
      productDiscountTotal: budget.productDiscountTotal,
      generalDiscountAmount: budget.generalDiscountAmount,
      deliveryAddress: budget.deliveryAddress,
      hasDelivery: budget.hasDelivery,
      status: budget.status,
      createdAt: budget.createdAt,
      updatedAt: budget.createdAt, // Los presupuestos no tienen updatedAt
      observations: budget.observations,
      baseCurrency: budget.baseCurrency,
      exchangeRatesAtCreation: budget.exchangeRatesAtCreation,
      type: "budget",
      expiresAt: budget.expiresAt,
      validForDays: budget.validForDays,
    }));

    // Combinar y ordenar por fecha de creación (más recientes primero)
    const allUnified = [...unifiedOrders, ...unifiedBudgets].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return allUnified;
  } catch (error) {
    console.error("Error loading unified orders:", error);
    return [];
  }
};

// ===== DASHBOARD METRICS =====

export interface DashboardMetrics {
  completedOrders: number;
  completedOrdersChange: number;
  pendingPayments: number;
  pendingPaymentsChange: number;
  productsToManufacture: number;
  productsToManufactureChange: number;
  averageOrderValue: number;
}

export interface DashboardMetrics {
  completedOrders: number;
  completedOrdersChange: number;
  pendingPayments: number;
  pendingPaymentsChange: number;
  productsToManufacture: number;
  productsToManufactureChange: number;
  averageOrderValue: number;
  // Nuevas métricas
  totalSalesCount: number; // Total de ventas (cantidad de facturas/notas de despachos)
  totalInvoiced: number;   // Total facturado (base imponible)
  totalCollected: number;  // Total cobrado (ingresos reales en el periodo)
  expiredLayawaysCount: number; // Cantidad de apartados vencidos
  expiredLayawaysAmount: number; // Monto deuda de apartados vencidos
}

export const calculateDashboardMetrics = async (
  period: "day" | "week" | "month" | "year" = "week"
): Promise<DashboardMetrics> => {
  const orders = await getOrders();

  // Filtrar por período
  const now = new Date();
  const periodStart = new Date();

  // Resetear horas para comparación de días completa
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  switch (period) {
    case "day":
      periodStart.setTime(todayStart.getTime());
      break;
    case "week":
      periodStart.setDate(now.getDate() - 7);
      break;
    case "month":
      periodStart.setMonth(now.getMonth() - 1);
      break;
    case "year":
      periodStart.setFullYear(now.getFullYear() - 1);
      break;
  }

  // Filtrar órdenes creadas en el periodo (para ventas y facturación)
  const periodOrders = orders.filter(
    (order) => new Date(order.createdAt) >= periodStart
  );

  // Calcular período anterior para comparar cambios
  const previousPeriodStart = new Date(periodStart);
  const previousPeriodEnd = new Date(periodStart);
  let periodDuration = now.getTime() - periodStart.getTime();

  // Ajuste para "day" para que compare con el día anterior (ayer)
  if (period === "day") {
    periodDuration = 24 * 60 * 60 * 1000;
  }

  previousPeriodStart.setTime(periodStart.getTime() - periodDuration);

  const previousPeriodOrders = orders.filter((order) => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= previousPeriodStart && orderDate < previousPeriodEnd;
  });

  // 1. Pedidos completados / Total de Ventas (Cantidad)
  // Tomar cantidad de clientes facturados (Notas de despacho)
  // Asumimos que "Por despachar" y "Completada" son las que tienen nota de despacho
  const completedOrders = periodOrders.filter(
    (order) => order.status === "Por despachar" || order.status === "Completada"
  ).length;

  const previousCompletedOrders = previousPeriodOrders.filter(
    (order) => order.status === "Por despachar" || order.status === "Completada"
  ).length;

  const completedOrdersChange =
    previousCompletedOrders > 0
      ? Math.round(
        ((completedOrders - previousCompletedOrders) /
          previousCompletedOrders) *
        100
      )
      : 0;

  // 2. Total Facturado (Base Imponible)
  // Suma del Subtotal de las ventas del periodo
  const totalInvoiced = periodOrders
    .filter((order) => order.status === "Por despachar" || order.status === "Completada" || order.status === "Generado" || order.status === "Generada" || order.status === "Fabricación")
    // Nota: Incluimos estados activos para facturación, ajustar según requerimiento exacto de "Facturado"
    // Si "Facturado" es estrictamente nota de despacho, solo usar "Por despachar" y "Completada"
    // El requerimiento dice "Total de ventas... Notas de despacho", asumiremos consistencia.
    // Sin embargo, para "Facturado" a veces se considera todo lo vendido.
    // Vamos a alinear con "Total de ventas" (Notas de despacho) para consistencia
    .filter((order) => order.status === "Por despachar" || order.status === "Completada")
    .reduce((sum, order) => sum + (order.subtotal || 0), 0);

  // 3. Total Cobrado (Ingresos reales en el periodo)
  // Debe incluir todo lo ingresado por nuevas ventas y abonos, independientemente de la fecha de la orden
  const totalCollected = orders.reduce((total, order) => {
    const paymentsInPeriod = order.partialPayments?.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= periodStart && paymentDate <= now;
    }) || [];

    const sumPayments = paymentsInPeriod.reduce((sum, p) => sum + (p.amount || 0), 0);
    return total + sumPayments;
  }, 0);

  // 4. Abonos por recaudar (Deuda actual general de órdenes activas)
  const pendingPayments = orders.reduce((total, order) => {
    if (order.status === "Generado" || order.status === "Generada" || order.status === "Fabricación" || order.status === "Por despachar") {
      const paidAmount =
        order.partialPayments?.reduce(
          (sum, payment) => sum + (payment.amount || 0),
          0
        ) || 0;
      return total + Math.max(0, order.total - paidAmount);
    }
    return total;
  }, 0);

  const previousPendingPayments = previousPeriodOrders.reduce(
    (total, order) => {
      if (order.status === "Generado" || order.status === "Generada" || order.status === "Fabricación" || order.status === "Por despachar") {
        const paidAmount =
          order.partialPayments?.reduce(
            (sum, payment) => sum + (payment.amount || 0),
            0
          ) || 0;
        return total + Math.max(0, order.total - paidAmount);
      }
      return total;
    },
    0
  );

  const pendingPaymentsChange =
    previousPendingPayments > 0
      ? Math.round(
        ((pendingPayments - previousPendingPayments) /
          previousPendingPayments) *
        100
      )
      : 0;

  // 5. Sistemas de Apartado (SA) Vencidos
  // "lo que tenga deuda ya es un SA vencido" -> saldo > 0
  // "debe reflejar lo vencido, sin cancelación" -> status no cancelado
  // Solo considerar pedidos con saleType === "sistema_apartado"

  const expiredLayawaysOrders = orders.filter(order => {
    // SOLO considerar Sistemas de Apartado
    if (order.saleType !== "sistema_apartado") {
      return false;
    }

    // No considerar cancelados
    if (order.status === "Cancelado") {
      return false;
    }

    // "lo que tenga deuda ya es un SA vencido" - verificar deuda pendiente
    const paidAmount = order.partialPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const pendingAmount = Math.max(0, order.total - paidAmount);

    // Si tiene deuda, está vencido
    return pendingAmount > 0;
  });

  const expiredLayawaysCount = expiredLayawaysOrders.length;
  const expiredLayawaysAmount = expiredLayawaysOrders.reduce((total, order) => {
    const paidAmount = order.partialPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    return total + Math.max(0, order.total - paidAmount);
  }, 0);

  // Productos por fabricar (Métrica existente)
  const productsToManufacture = orders.reduce((count, order) => {
    return (
      count +
      order.products.filter((product) => {
        if (product.locationStatus !== "FABRICACION") {
          return false;
        }
        const manufacturingStatus = product.manufacturingStatus || "debe_fabricar";
        return manufacturingStatus !== "almacen_no_fabricado";
      }).length
    );
  }, 0);

  // Promedio de pedidos completados (Por despachar o Completada) - Métrica existente
  const completedOrdersTotal = periodOrders
    .filter((order) => order.status === "Por despachar" || order.status === "Completada")
    .reduce((sum, order) => sum + order.total, 0);
  const averageOrderValue =
    completedOrders > 0 ? completedOrdersTotal / completedOrders : 0;

  return {
    completedOrders,
    completedOrdersChange,
    pendingPayments,
    pendingPaymentsChange,
    productsToManufacture,
    productsToManufactureChange: 0,
    averageOrderValue,
    // Nuevas métricas
    totalSalesCount: completedOrders, // Es lo mismo que completedOrders (Ventas = Notas de despacho)
    totalInvoiced,
    totalCollected,
    expiredLayawaysCount,
    expiredLayawaysAmount
  };
};

/**
 * Obtiene todos los Sistemas de Apartado (SA) vencidos
 * Un SA está vencido si tiene saleType === "sistema_apartado" y tiene deuda pendiente
 * @returns Array de órdenes con SA vencidos, incluyendo información de días vencidos y deuda
 */
export const getExpiredLayaways = async (): Promise<Array<Order & { daysExpired: number; pendingAmount: number }>> => {
  const orders = await getOrders();
  const now = new Date();

  const expiredLayaways = orders
    .filter(order => {
      // SOLO considerar Sistemas de Apartado
      if (order.saleType !== "sistema_apartado") {
        return false;
      }

      // No considerar cancelados
      if (order.status === "Cancelado") {
        return false;
      }

      // "lo que tenga deuda ya es un SA vencido" - verificar deuda pendiente
      const paidAmount = order.partialPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const pendingAmount = Math.max(0, order.total - paidAmount);

      return pendingAmount > 0;
    })
    .map(order => {
      const paidAmount = order.partialPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const pendingAmount = Math.max(0, order.total - paidAmount);
      const orderDate = new Date(order.createdAt);
      const daysExpired = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...order,
        daysExpired,
        pendingAmount
      };
    })
    .sort((a, b) => b.daysExpired - a.daysExpired); // Ordenar por días vencidos (más antiguos primero)

  return expiredLayaways;
};

// ===== BUDGETS STORAGE (IndexedDB) =====

export interface Budget {
  id: string;
  budgetNumber: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  referrerId?: string;
  referrerName?: string;
  products: OrderProduct[];
  subtotal: number;
  taxAmount: number;
  deliveryCost: number;
  total: number;
  subtotalBeforeDiscounts?: number;
  productDiscountTotal?: number;
  generalDiscountAmount?: number;
  deliveryAddress?: string;
  hasDelivery: boolean;
  status: "Presupuesto" | "Aprobado" | "Rechazado" | "Vencido" | "Convertido";
  createdAt: string;
  updatedAt?: string;
  expiresAt: string;
  validForDays: number;
  observations?: string;
  baseCurrency?: "Bs" | "USD" | "EUR";
  exchangeRatesAtCreation?: {
    USD?: { rate: number; effectiveDate: string };
    EUR?: { rate: number; effectiveDate: string };
  };
  convertedToOrderId?: string;
}

/** Presupuesto en API = Order con type Budget; en cliente necesitamos `budgetNumber` (= orderNumber del API). */
function orderMappedToBudget(
  order: Order,
  opts?: { expiresAt?: string; validForDays?: number },
): Budget {
  const validForDays = opts?.validForDays ?? 30;
  const num = order.orderNumber || "";
  let expiresAt = opts?.expiresAt;
  if (!expiresAt) {
    const d = new Date(order.createdAt);
    d.setDate(d.getDate() + validForDays);
    expiresAt = d.toISOString();
  }
  return {
    id: order.id,
    budgetNumber: num,
    clientId: order.clientId,
    clientName: order.clientName,
    vendorId: order.vendorId,
    vendorName: order.vendorName,
    referrerId: order.referrerId,
    referrerName: order.referrerName,
    products: order.products,
    subtotal: order.subtotal,
    taxAmount: order.taxAmount,
    deliveryCost: order.deliveryCost,
    total: order.total,
    subtotalBeforeDiscounts: order.subtotalBeforeDiscounts,
    productDiscountTotal: order.productDiscountTotal,
    generalDiscountAmount: order.generalDiscountAmount,
    deliveryAddress: order.deliveryAddress,
    hasDelivery: order.hasDelivery,
    status: order.status as Budget["status"],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    expiresAt,
    validForDays,
    observations: order.observations,
    baseCurrency: order.baseCurrency,
    exchangeRatesAtCreation: order.exchangeRatesAtCreation,
  };
}

export const getBudgets = async (): Promise<Budget[]> => {
  try {
    // Cargar siempre presupuestos locales desde IndexedDB primero (offline-first)
    const localBudgets = await db.getAll<Budget>("budgets");

    // Si hay conexión, intentar sincronizar con backend
    if (isOnline()) {
      try {
        const backendBudgets = (await apiClient.getOrdersByStatus("Presupuesto")).map((dto) =>
          orderMappedToBudget(orderFromBackendDto(dto)),
        );
        // Server-first: el API por estado es la fuente de verdad cuando responde
        for (const budget of backendBudgets) {
          await db.put("budgets", budget as Budget);
        }
        const merged = await db.getAll<Budget>("budgets");
        console.log(`✅ Presupuestos sincronizados (API): ${backendBudgets.length} del servidor, ${merged.length} en IndexedDB`);
        return merged;
      } catch (error) {
        console.warn("Error cargando presupuestos del backend:", error);
        // Tras getOrders, IndexedDB ya puede tener PRE del listado paginado; no devolver snapshot viejo.
        return await db.getAll<Budget>("budgets");
      }
    }

    console.log(`✅ Presupuestos cargados desde IndexedDB: ${localBudgets.length}`);
    return localBudgets;
  } catch (error) {
    console.error("Error loading budgets from IndexedDB:", error);
    return [];
  }
};

export const getBudget = async (id: string): Promise<Budget | undefined> => {
  try {
    return await db.get<Budget>("budgets", id);
  } catch (error) {
    console.error("Error loading budget from IndexedDB:", error);
    return undefined;
  }
};

export const getBudgetByNumber = async (budgetNumber: string): Promise<Budget | undefined> => {
  try {
    const budgets = await getBudgets();
    return budgets.find((b) => b.budgetNumber === budgetNumber);
  } catch (error) {
    console.error("Error loading budget by number from IndexedDB:", error);
    return undefined;
  }
};

export const getBudgetsByClient = async (clientId: string): Promise<Budget[]> => {
  try {
    return await db.getByIndex<Budget>("budgets", "clientId", clientId);
  } catch (error) {
    console.error("Error loading budgets by client from IndexedDB:", error);
    return [];
  }
};

export const getBudgetsByStatus = async (status: string): Promise<Budget[]> => {
  try {
    return await db.getByIndex<Budget>("budgets", "status", status);
  } catch (error) {
    console.error("Error loading budgets by status from IndexedDB:", error);
    return [];
  }
};

export const addBudget = async (
  budget: Omit<Budget, "id" | "budgetNumber" | "createdAt" | "expiresAt" | "status"> & {
    validForDays?: number;
  }
): Promise<Budget> => {
  let newBudget: Budget;
  let syncedToBackend = false;

  const validForDays = budget.validForDays || 30;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(now.getDate() + validForDays);

  if (isOnline()) {
    try {
      const createDto = orderToBackendDto(budget as any);
      createDto.type = "Budget";
      createDto.status = "Presupuesto";
      createDto.paymentType = createDto.paymentType || "N/A";
      createDto.paymentMethod = createDto.paymentMethod || "N/A";

      const backendOrder = await apiClient.createOrder(createDto);
      newBudget = orderMappedToBudget(orderFromBackendDto(backendOrder), {
        expiresAt: expiresAt.toISOString(),
        validForDays,
      });

      try {
        await db.put("budgets", newBudget);
      } catch (e) {
        console.warn("No se pudo cachear presupuesto en IndexedDB:", e);
      }

      console.log("✅ Presupuesto guardado en backend:", newBudget.budgetNumber);
      syncedToBackend = true;
      return newBudget;
    } catch (error) {
      console.warn("⚠️ Error guardando presupuesto en backend, guardando localmente:", error);
    }
  }

  try {
    const budgets = await getBudgets();
    const budgetNumber = `PRE-${String(budgets.length + 1).padStart(3, "0")}`;

    newBudget = {
      ...budget,
      id: Date.now().toString(),
      budgetNumber,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "Presupuesto",
      validForDays,
    };

    await db.add("budgets", newBudget);
    console.log("✅ Presupuesto guardado en IndexedDB:", newBudget.budgetNumber);

    if (!syncedToBackend) {
      try {
        const createDto = orderToBackendDto(newBudget as any);
        createDto.type = "Budget";
        createDto.status = "Presupuesto";
        createDto.paymentType = createDto.paymentType || "N/A";
        createDto.paymentMethod = createDto.paymentMethod || "N/A";
        const { syncManager } = await import("./sync-manager");
        await syncManager.addToQueue({
          type: "create",
          entity: "order", // we sync it as an order
          entityId: newBudget.id,
          data: createDto,
        });
      } catch (e) {
        console.warn("Error encolando presupuesto", e);
      }
    }

    return newBudget;
  } catch (error) {
    console.error("Error adding budget to IndexedDB:", error);
    throw error;
  }
};

export const updateBudget = async (id: string, updates: Partial<Budget>): Promise<Budget> => {
  try {
    const existingBudget = await getBudget(id);
    if (!existingBudget) {
      throw new Error(`Budget with id ${id} not found`);
    }

    const updatedBudget: Budget = {
      ...existingBudget,
      ...updates,
    };

    await db.update("budgets", updatedBudget);
    return updatedBudget;
  } catch (error) {
    console.error("Error updating budget in IndexedDB:", error);
    throw error;
  }
};

export const deleteBudget = async (id: string): Promise<void> => {
  try {
    const existing = await getBudget(id);
    const budgetNumber = existing?.budgetNumber;

    if (isOnline()) {
      try {
        let backendId = id;
        if (budgetNumber) {
          const dto = await apiClient
            .getOrderByOrderNumber(budgetNumber)
            .catch(() => null);
          if (dto?.id) backendId = dto.id;
        }
        await apiClient.deleteOrder(backendId);
        console.log("✅ Presupuesto eliminado del backend:", budgetNumber ?? id);
      } catch (error) {
        console.warn(
          "⚠️ Error eliminando presupuesto en backend (se limpia IndexedDB):",
          error,
        );
      }
    }

    try {
      await db.remove("budgets", id);
    } catch (error) {
      console.warn("⚠️ No estaba en store budgets:", error);
    }
    try {
      await db.remove("orders", id);
    } catch {
      /* no duplicado en orders */
    }
  } catch (error) {
    console.error("Error deleting budget:", error);
    throw error;
  }
};

// Helper for Client mapping
export const clientFromBackendDto = (dto: ClientResponseDto): Client => ({
  id: dto.id,
  nombreRazonSocial: dto.nombreRazonSocial,
  apodo: dto.apodo,
  rutId: dto.rutId,
  direccion: dto.direccion,
  telefono: dto.telefono,
  telefono2: dto.telefono2,
  email: dto.email,
  tipoCliente: (dto.tipoCliente?.toLowerCase() as Client["tipoCliente"]) || "particular",
  estado: (dto.estado?.toLowerCase() as Client["estado"]) || "activo",
  fechaCreacion: dto.fechaCreacion,
  tieneNotasDespacho: dto.tieneNotasDespacho,
});

// ===== CLIENTS STORAGE (IndexedDB) =====

const repopulateClientsCache = async (clients: Client[]): Promise<void> => {
  try {
    await db.clearStore("clients");
    for (const c of clients) {
      await db.put("clients", c);
    }
  } catch (e) {
    console.warn("Error actualizando cache de clientes:", e);
  }
};

export const getClients = async (): Promise<Client[]> => {
  try {
    if (isOnline()) {
      try {
        const result = await apiClient.getClientsPaged(1, 1000);
        const list = (result.items || []).map(clientFromBackendDto);
        void repopulateClientsCache(list);
        return list;
      } catch (error) {
        console.warn("Error obteniendo clientes del backend, usando IndexedDB:", error);
        return await db.getAll<Client>("clients");
      }
    }
    return await db.getAll<Client>("clients");
  } catch (error) {
    console.error("Error loading clients:", error);
    return [];
  }
};

export const getClient = async (id: string): Promise<Client | undefined> => {
  try {
    if (isOnline()) {
      try {
        const dto = await apiClient.getClientById(id);
        const c = clientFromBackendDto(dto);
        await db.put("clients", c);
        return c;
      } catch (error) {
        console.warn("getClient: API falló, usando IndexedDB", error);
      }
    }
    return await db.get<Client>("clients", id);
  } catch (error) {
    console.error("Error loading client:", error);
    return undefined;
  }
};

export const addClient = async (
  client: Omit<Client, "id" | "fechaCreacion" | "tieneNotasDespacho">
): Promise<Client> => {
  try {
    const newClient: Client = {
      ...client,
      estado: "activo", // Siempre activo al crear un cliente
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString().split("T")[0],
      tieneNotasDespacho: false,
    };

    await db.add("clients", newClient);
    console.log(
      "✅ Cliente guardado en IndexedDB:",
      newClient.nombreRazonSocial
    );
    return newClient;
  } catch (error) {
    console.error("Error adding client to IndexedDB:", error);
    throw error;
  }
};

export const updateClient = async (
  id: string,
  updates: Partial<Client>
): Promise<Client> => {
  try {
    const existingClient = await getClient(id);
    if (!existingClient) {
      throw new Error(`Client with id ${id} not found`);
    }

    const updatedClient: Client = {
      ...existingClient,
      ...updates,
    };

    await db.update("clients", updatedClient);
    return updatedClient;
  } catch (error) {
    console.error("Error updating client in IndexedDB:", error);
    throw error;
  }
};

export const deleteClient = async (id: string): Promise<void> => {
  try {
    await db.remove("clients", id);
  } catch (error) {
    console.error("Error deleting client from IndexedDB:", error);
    throw error;
  }
};

// ===== PROVIDERS STORAGE (IndexedDB) =====

// Helper functions para mapear providers entre frontend y backend
export const providerFromBackendDto = (dto: ProviderResponseDto): Provider => {
  // Manejar tanto camelCase como PascalCase (por si el backend serializa diferente)
  const razonSocial = (dto as any).razonSocial || (dto as any).RazonSocial || "";
  const rif = (dto as any).rif || (dto as any).Rif || "";
  const nombre = (dto as any).nombre || (dto as any).Nombre || "";
  const email = (dto as any).email || (dto as any).Email || "";
  const telefono = (dto as any).telefono || (dto as any).Telefono || "";
  const direccion = (dto as any).direccion || (dto as any).Direccion || "";
  const contacto = (dto as any).contacto || (dto as any).Contacto || "";
  const tipo = (dto as any).tipo || (dto as any).Tipo || "";
  const estado = (dto as any).estado || (dto as any).Estado || "activo";
  const createdAt = (dto as any).createdAt || (dto as any).CreatedAt || new Date().toISOString();

  return {
    id: dto.id,
    razonSocial: razonSocial || nombre, // Usar nombre si razonSocial está vacío
    rif: rif,
    direccion: direccion || "",
    telefono: telefono || "",
    email: email,
    contacto: contacto,
    tipo: tipo as Provider["tipo"],
    estado: (estado.toLowerCase() || "activo") as Provider["estado"],
    fechaCreacion: createdAt.split("T")[0], // Convertir ISO a fecha YYYY-MM-DD
  };
};

export const providerToCreateDto = (provider: Omit<Provider, "id" | "fechaCreacion">): CreateProviderDto => ({
  rif: provider.rif,
  nombre: provider.razonSocial, // El backend espera "nombre" y "razonSocial", usamos razonSocial para ambos
  razonSocial: provider.razonSocial,
  email: provider.email,
  telefono: provider.telefono,
  direccion: provider.direccion,
  contacto: provider.contacto,
  tipo: provider.tipo,
  estado: provider.estado === "activo" ? "Activo" : "Inactivo", // Backend usa PascalCase
});

export const providerToUpdateDto = (updates: Partial<Provider>): UpdateProviderDto => {
  const dto: UpdateProviderDto = {};
  if (updates.rif !== undefined) dto.rif = updates.rif;
  if (updates.razonSocial !== undefined) {
    dto.razonSocial = updates.razonSocial;
    dto.nombre = updates.razonSocial; // Mantener ambos campos sincronizados
  }
  if (updates.email !== undefined) dto.email = updates.email;
  if (updates.telefono !== undefined) dto.telefono = updates.telefono;
  if (updates.direccion !== undefined) dto.direccion = updates.direccion;
  if (updates.contacto !== undefined) dto.contacto = updates.contacto;
  if (updates.tipo !== undefined) dto.tipo = updates.tipo;
  if (updates.estado !== undefined) {
    dto.estado = updates.estado === "activo" ? "Activo" : "Inactivo";
  }
  return dto;
};

const repopulateProvidersCache = async (providers: Provider[]): Promise<void> => {
  try {
    await db.clearStore("providers");
    for (const p of providers) {
      await db.put("providers", p);
    }
  } catch (e) {
    console.warn("Error actualizando cache de proveedores:", e);
  }
};

export const getProviders = async (): Promise<Provider[]> => {
  try {
    if (isOnline()) {
      try {
        const providersDto = await apiClient.getProviders();
        const list = providersDto.map(providerFromBackendDto);
        void repopulateProvidersCache(list);
        return list;
      } catch (error) {
        console.warn("Error obteniendo proveedores del backend, usando IndexedDB:", error);
        return await db.getAll<Provider>("providers");
      }
    }
    return await db.getAll<Provider>("providers");
  } catch (error) {
    console.error("Error loading providers:", error);
    return [];
  }
};

export const getProvider = async (
  id: string
): Promise<Provider | undefined> => {
  try {
    if (isOnline()) {
      try {
        const dto = await apiClient.getProviderById(id);
        const p = providerFromBackendDto(dto);
        await db.put("providers", p);
        return p;
      } catch (error) {
        console.warn("getProvider: API falló, usando IndexedDB", error);
      }
    }
    return await db.get<Provider>("providers", id);
  } catch (error) {
    console.error("Error loading provider:", error);
    return undefined;
  }
};

export const addProvider = async (
  provider: Omit<Provider, "id" | "fechaCreacion">
): Promise<Provider> => {
  try {
    const newProvider: Provider = {
      ...provider,
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString().split("T")[0],
    };

    await db.add("providers", newProvider);
    console.log("✅ Proveedor guardado en IndexedDB:", newProvider.razonSocial);
    return newProvider;
  } catch (error) {
    console.error("Error adding provider to IndexedDB:", error);
    throw error;
  }
};

export const updateProvider = async (
  id: string,
  updates: Partial<Provider>
): Promise<Provider> => {
  try {
    const existingProvider = await getProvider(id);
    if (!existingProvider) {
      throw new Error(`Provider with id ${id} not found`);
    }

    const updatedProvider: Provider = {
      ...existingProvider,
      ...updates,
    };

    await db.update("providers", updatedProvider);
    return updatedProvider;
  } catch (error) {
    console.error("Error updating provider in IndexedDB:", error);
    throw error;
  }
};

export const deleteProvider = async (id: string): Promise<void> => {
  try {
    await db.remove("providers", id);
  } catch (error) {
    console.error("Error deleting provider from IndexedDB:", error);
    throw error;
  }
};

// Sincronizar proveedores desde el backend
export const syncProvidersFromBackend = async (): Promise<Provider[]> => {
  try {
    const providersDto = await apiClient.getProviders();
    const providers: Provider[] = providersDto.map(providerFromBackendDto);

    // Guardar todos los proveedores en IndexedDB
    for (const provider of providers) {
      try {
        const existing = await getProvider(provider.id);
        if (existing) {
          await updateProvider(provider.id, provider);
        } else {
          await db.add("providers", provider);
        }
      } catch (error) {
        console.error(`Error syncing provider ${provider.id}:`, error);
      }
    }

    console.log(`✅ ${providers.length} proveedores sincronizados desde el backend`);
    return providers;
  } catch (error) {
    console.error("Error syncing providers from backend:", error);
    // Si falla, retornar los proveedores locales
    return getProviders();
  }
};

// ===== STORES STORAGE (IndexedDB) =====

export const getStore = async (id: string): Promise<Store | undefined> => {
  try {
    if (isOnline()) {
      try {
        const dto = await apiClient.getStore(id);
        const s = storeFromBackendDto(dto);
        await db.put("stores", s);
        return s;
      } catch (error) {
        console.warn("getStore: API falló, usando IndexedDB", error);
      }
    }
    return await db.get<Store>("stores", id);
  } catch (error) {
    console.error("Error loading store:", error);
    return undefined;
  }
};

// Helper para convertir Account a formato backend DTO
const accountToBackendDto = (account: Account): CreateAccountDto => ({
  code: account.code,
  label: account.label,
  storeId: account.storeId,
  isForeign: account.isForeign,
  accountType: account.accountType,
  email: account.email,
  wallet: account.wallet,
  isActive: account.isActive,
});

// Helper para convertir backend DTO a formato frontend
const accountFromBackendDto = (dto: AccountResponseDto): Account => ({
  id: dto.id,
  code: dto.code,
  label: dto.label,
  storeId: dto.storeId,
  isForeign: dto.isForeign,
  accountType: dto.accountType,
  email: dto.email,
  wallet: dto.wallet,
  isActive: dto.isActive,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});

const repopulateAccountsCache = async (accounts: Account[]): Promise<void> => {
  try {
    await db.clearStore("accounts");
    for (const a of accounts) {
      await db.put("accounts", a);
    }
  } catch (e) {
    console.warn("Error actualizando cache de cuentas:", e);
  }
};

export const getAccounts = async (): Promise<Account[]> => {
  try {
    if (isOnline()) {
      try {
        const backendAccounts = await apiClient.getAccounts();
        const list = backendAccounts.map(accountFromBackendDto);
        void repopulateAccountsCache(list);
        return list;
      } catch (error) {
        console.warn("Error cargando cuentas del backend, usando IndexedDB:", error);
        return await db.getAll<Account>("accounts");
      }
    }
    return await db.getAll<Account>("accounts");
  } catch (error) {
    console.error("Error loading accounts:", error);
    return [];
  }
};

export const getAccount = async (id: string): Promise<Account | undefined> => {
  try {
    if (isOnline()) {
      try {
        const dto = await apiClient.getAccountById(id);
        const a = accountFromBackendDto(dto);
        await db.put("accounts", a);
        return a;
      } catch (error) {
        console.warn("getAccount: API falló, usando IndexedDB", error);
      }
    }
    return await db.get<Account>("accounts", id);
  } catch (error) {
    console.error("Error loading account:", error);
    return undefined;
  }
};

export const addAccount = async (
  account: Omit<Account, "id" | "createdAt" | "updatedAt">
): Promise<Account> => {
  try {
    // Primero intentar crear en backend si hay conexión
    if (isOnline()) {
      try {
        const createDto: CreateAccountDto = accountToBackendDto({
          ...account,
          id: "", // No necesitamos ID para crear
          createdAt: "",
          updatedAt: "",
        } as Account);

        const backendAccount = await apiClient.createAccount(createDto);

        // Usar la cuenta del backend
        const newAccount: Account = accountFromBackendDto(backendAccount);

        console.log("✅ Cuenta creada en backend:", newAccount.label);
        return newAccount;
      } catch (error) {
        console.warn("⚠️ Error creando cuenta en backend, guardando solo localmente:", error);
        // Continuar guardando localmente
      }
    }

    // Guardar localmente
    const now = new Date().toISOString();
    const newAccount: Account = {
      ...account,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };

    await db.add("accounts", newAccount);
    const displayInfo = newAccount.label || newAccount.code || "Cuenta";
    console.log("✅ Cuenta guardada en IndexedDB:", displayInfo);
    return newAccount;
  } catch (error) {
    console.error("Error adding account to IndexedDB:", error);
    throw error;
  }
};

export const updateAccount = async (
  id: string,
  updates: Partial<Account>
): Promise<Account> => {
  try {
    const existingAccount = await getAccount(id);
    if (!existingAccount) {
      throw new Error(`Account with id ${id} not found`);
    }

    // Intentar actualizar en backend si hay conexión
    if (isOnline()) {
      try {
        const updateDto: UpdateAccountDto = {
          code: updates.code,
          label: updates.label,
          storeId: updates.storeId,
          isForeign: updates.isForeign,
          accountType: updates.accountType,
          email: updates.email,
          wallet: updates.wallet,
          isActive: updates.isActive,
        };

        const backendAccount = await apiClient.updateAccount(id, updateDto);
        const updatedAccount = accountFromBackendDto(backendAccount);

        console.log("✅ Cuenta actualizada en backend:", updatedAccount.label);
        return updatedAccount;
      } catch (error) {
        console.warn("⚠️ Error actualizando cuenta en backend, actualizando solo localmente:", error);
        // Continuar actualizando localmente
      }
    }

    const updatedAccount: Account = {
      ...existingAccount,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await db.update("accounts", updatedAccount);
    return updatedAccount;
  } catch (error) {
    console.error("Error updating account in IndexedDB:", error);
    throw error;
  }
};

export const deleteAccount = async (id: string): Promise<void> => {
  try {
    // Intentar eliminar en backend si hay conexión
    if (isOnline()) {
      try {
        await apiClient.deleteAccount(id);
        console.log("✅ Cuenta eliminada del backend");
      } catch (error) {
        console.warn("⚠️ Error eliminando cuenta del backend:", error);
        // No fallar si no se puede eliminar del backend
      }
    }

    await db.remove("accounts", id);
    console.log("✅ Cuenta eliminada de IndexedDB");
  } catch (error) {
    console.error("Error deleting account from IndexedDB:", error);
    throw error;
  }
};

// Funciones de conversión para Stores
export const storeToBackendDto = (store: Omit<Store, "id" | "createdAt" | "updatedAt">): CreateStoreDto => ({
  name: store.name,
  code: store.code,
  address: store.address,
  phone: store.phone,
  email: store.email,
  rif: store.rif,
  status: store.status,
});

export const storeFromBackendDto = (dto: StoreResponseDto): Store => ({
  id: dto.id,
  name: dto.name,
  code: dto.code,
  address: dto.address,
  phone: dto.phone,
  email: dto.email,
  rif: dto.rif,
  status: dto.status as "active" | "inactive",
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});

const repopulateStoresCache = async (stores: Store[]): Promise<void> => {
  try {
    await db.clearStore("stores");
    for (const s of stores) {
      await db.put("stores", s);
    }
  } catch (e) {
    console.warn("Error actualizando cache de tiendas:", e);
  }
};

export const getStores = async (): Promise<Store[]> => {
  try {
    if (!isOnline()) {
      return await db.getAll<Store>("stores");
    }
    try {
      const backendStores = await apiClient.getStores();
      const list = backendStores.map(storeFromBackendDto);
      void repopulateStoresCache(list);
      return list;
    } catch (error) {
      console.warn("Error al obtener tiendas del backend, usando IndexedDB:", error);
      return await db.getAll<Store>("stores");
    }
  } catch (error) {
    console.error("Error loading stores:", error);
    return [];
  }
};

export const addStore = async (
  store: Omit<Store, "id" | "createdAt" | "updatedAt">
): Promise<Store> => {
  try {
    // Crear en backend primero
    const backendDto = storeToBackendDto(store);
    const createdStoreDto = await apiClient.createStore(backendDto);
    const createdStore = storeFromBackendDto(createdStoreDto);

    console.log("✅ Tienda creada en backend:", createdStore.name);
    return createdStore;
  } catch (error) {
    console.error("Error creando tienda en backend, guardando solo en IndexedDB:", error);
    // Fallback a IndexedDB
    const now = new Date().toISOString();
    const newStore: Store = {
      ...store,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };

    await db.add("stores", newStore);
    console.log("✅ Tienda guardada en IndexedDB:", newStore.name);
    return newStore;
  }
};

export const updateStore = async (
  id: string,
  updates: Partial<Store>
): Promise<Store> => {
  try {
    // Actualizar en backend primero
    const backendDto: UpdateStoreDto = {};
    if (updates.name !== undefined) backendDto.name = updates.name;
    if (updates.code !== undefined) backendDto.code = updates.code;
    if (updates.address !== undefined) backendDto.address = updates.address;
    if (updates.phone !== undefined) backendDto.phone = updates.phone;
    if (updates.email !== undefined) backendDto.email = updates.email;
    if (updates.rif !== undefined) backendDto.rif = updates.rif;
    if (updates.status !== undefined) backendDto.status = updates.status;

    const updatedStoreDto = await apiClient.updateStore(id, backendDto);
    const updatedStore = storeFromBackendDto(updatedStoreDto);

    console.log("✅ Tienda actualizada en backend:", updatedStore.name);
    return updatedStore;
  } catch (error) {
    console.error("Error actualizando tienda en backend, actualizando solo en IndexedDB:", error);
    // Fallback a IndexedDB
    const existingStore = await db.get<Store>("stores", id);
    if (!existingStore) {
      throw new Error(`Tienda con ID ${id} no encontrada`);
    }

    const updatedStore = {
      ...existingStore,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await db.put("stores", updatedStore);
    console.log("✅ Tienda actualizada en IndexedDB:", updatedStore.name);
    return updatedStore;
  }
};

export const deleteStore = async (id: string): Promise<void> => {
  try {
    // Eliminar del backend primero
    await apiClient.deleteStore(id);

    // Eliminar de IndexedDB
    await db.remove("stores", id);
    console.log("✅ Tienda eliminada de backend e IndexedDB");
  } catch (error) {
    console.error("Error eliminando tienda del backend, eliminando solo de IndexedDB:", error);
    // Fallback a IndexedDB
    await db.remove("stores", id);
    console.log("✅ Tienda eliminada de IndexedDB");
  }
};

// Helper para enmascarar número de cuenta
export const maskAccountNumber = (accountNumber: string): string => {
  if (!accountNumber || accountNumber.length < 8) {
    return accountNumber; // Si es muy corto, retornar tal cual
  }
  const first4 = accountNumber.substring(0, 4);
  const last4 = accountNumber.substring(accountNumber.length - 4);
  const middle = "*".repeat(Math.max(4, accountNumber.length - 8));
  return `${first4}${middle}${last4}`;
};

// ===== HELPER FUNCTIONS =====

/**
 * Calcula el precio total de un producto considerando los ajustes de precio de los atributos seleccionados
 * @param basePrice - Precio base del producto (ya convertido a Bs)
 * @param quantity - Cantidad del producto
 * @param productAttributes - Atributos seleccionados del producto (ej: { "attrId": "valueId" })
 * @param category - Categoría del producto que contiene la definición de atributos
 * @param exchangeRates - Tasas de cambio para convertir ajustes de atributos (opcional)
 * @returns Precio total calculado (precio base + ajustes de atributos convertidos) * cantidad
 */
export const calculateProductTotalWithAttributes = (
  basePrice: number,
  quantity: number,
  productAttributes: Record<string, string | number | string[]> | undefined,
  category: Category | undefined,
  exchangeRates?: { USD?: any; EUR?: any },
  allProducts: Product[] = [],
  categories: Category[] = []
): number => {
  if (!productAttributes || !category || !category.attributes) {
    return basePrice * quantity;
  }

  let totalAdjustment = 0;

  // Iterar sobre los atributos del producto
  Object.entries(productAttributes).forEach(([attrKey, selectedValue]) => {
    // Buscar el atributo en la categoría
    const categoryAttribute = category.attributes.find(
      (attr) => attr.id.toString() === attrKey || attr.title === attrKey
    );

    if (!categoryAttribute || !categoryAttribute.values) {
      return;
    }

    // Función helper para convertir ajuste a Bs
    const convertAdjustment = (
      adjustment: number,
      currency?: string
    ): number => {
      if (!currency || currency === "Bs") return adjustment;
      if (currency === "USD" && exchangeRates?.USD?.rate) {
        return adjustment * exchangeRates.USD.rate;
      }
      if (currency === "EUR" && exchangeRates?.EUR?.rate) {
        return adjustment * exchangeRates.EUR.rate;
      }
      return adjustment; // Si no hay tasa, usar valor original
    };

    // Manejar atributos de tipo "Product"
    if (categoryAttribute.valueType === "Product") {
      const processProductPrice = (productId: any) => {
        const productIdNum = typeof productId === "number" ? productId : parseInt(productId);
        
        // Intentar buscar el producto real para sumar su precio base y sus propios atributos
        const foundProduct = allProducts.find(p => p.id === productIdNum || p.backendId === productId.toString());
        if (foundProduct) {
          // Convertir precio del producto a Bs
          let pPrice = foundProduct.price;
          if (foundProduct.priceCurrency && foundProduct.priceCurrency !== "Bs" && exchangeRates) {
            if (foundProduct.priceCurrency === "USD" && exchangeRates.USD?.rate) pPrice *= exchangeRates.USD.rate;
            else if (foundProduct.priceCurrency === "EUR" && exchangeRates.EUR?.rate) pPrice *= exchangeRates.EUR.rate;
          }
          totalAdjustment += pPrice;

          // Sumar ajustes de los atributos del sub-producto si están presentes en productAttributes
          const subAttrKey = `${attrKey}_${foundProduct.id}`;
          const subAttrs = (productAttributes as any)[subAttrKey];
          if (subAttrs) {
            const subCategory = categories.find(c => c.name === foundProduct.category);
            if (subCategory) {
              totalAdjustment += calculateProductUnitPriceWithAttributes(0, subAttrs, subCategory, exchangeRates, allProducts, categories);
            }
          }
        }
      };

      if (Array.isArray(selectedValue)) {
        selectedValue.forEach(processProductPrice);
      } else if (selectedValue) {
        processProductPrice(selectedValue);
      }
      return;
    }

    // Manejar arrays para selección múltiple
    if (Array.isArray(selectedValue)) {
      selectedValue.forEach((valStr) => {
        const attributeValue = categoryAttribute.values.find((val) => {
          if (typeof val === "string") {
            return val === valStr;
          }
          return val.id === valStr || val.label === valStr;
        });

        if (
          attributeValue &&
          typeof attributeValue === "object" &&
          "priceAdjustment" in attributeValue
        ) {
          const adjustment = attributeValue.priceAdjustment || 0;
          const currency = attributeValue.priceAdjustmentCurrency || "Bs";
          totalAdjustment += convertAdjustment(adjustment, currency);
        }
      });
    } else {
      // Manejar valores simples (selección única)
      const selectedValueStr = selectedValue.toString();
      const attributeValue = categoryAttribute.values.find((val) => {
        if (typeof val === "string") {
          return val === selectedValueStr;
        }
        return val.id === selectedValueStr || val.label === selectedValueStr;
      });

      if (
        attributeValue &&
        typeof attributeValue === "object" &&
        "priceAdjustment" in attributeValue
      ) {
        const adjustment = attributeValue.priceAdjustment || 0;
        const currency = attributeValue.priceAdjustmentCurrency || "Bs";
        totalAdjustment += convertAdjustment(adjustment, currency);
      }
    }
  });

  // Calcular: (precio base + ajustes totales) * cantidad
  const pricePerUnit = basePrice + totalAdjustment;
  return pricePerUnit * quantity;
};

/**
 * Calcula el precio unitario de un producto considerando los ajustes de precio de los atributos
 * @param basePrice - Precio base del producto (ya convertido a Bs)
 * @param productAttributes - Atributos seleccionados del producto
 * @param category - Categoría del producto que contiene la definición de atributos
 * @param exchangeRates - Tasas de cambio para convertir ajustes de atributos (opcional)
 * @returns Precio unitario calculado (precio base + ajustes de atributos convertidos)
 */
export const calculateProductUnitPriceWithAttributes = (
  basePrice: number,
  productAttributes: Record<string, string | number | string[]> | undefined,
  category: Category | undefined,
  exchangeRates?: { USD?: any; EUR?: any },
  allProducts: Product[] = [],
  categories: Category[] = []
): number => {
  if (!productAttributes || !category || !category.attributes) {
    return basePrice;
  }

  let totalAdjustment = 0;

  // Función helper para convertir ajuste a Bs
  const convertAdjustment = (adjustment: number, currency?: string): number => {
    if (!currency || currency === "Bs") return adjustment;
    if (currency === "USD" && exchangeRates?.USD?.rate) {
      return adjustment * exchangeRates.USD.rate;
    }
    if (currency === "EUR" && exchangeRates?.EUR?.rate) {
      return adjustment * exchangeRates.EUR.rate;
    }
    return adjustment; // Si no hay tasa, usar valor original
  };

  Object.entries(productAttributes).forEach(([attrKey, selectedValue]) => {
    const categoryAttribute = category.attributes.find(
      (attr) => attr.id.toString() === attrKey || attr.title === attrKey
    );

    if (!categoryAttribute || !categoryAttribute.values) {
      return;
    }

    // Manejar atributos de tipo "Product"
    if (categoryAttribute.valueType === "Product") {
      const processProductPrice = (productId: any) => {
        const productIdNum = typeof productId === "number" ? productId : parseInt(productId);
        
        // Intentar buscar el producto real para sumar su precio base y sus propios atributos
        const foundProduct = allProducts.find(p => p.id === productIdNum || p.backendId === productId.toString());
        if (foundProduct) {
          // Convertir precio del producto a Bs
          let pPrice = foundProduct.price;
          if (foundProduct.priceCurrency && foundProduct.priceCurrency !== "Bs" && exchangeRates) {
            if (foundProduct.priceCurrency === "USD" && exchangeRates.USD?.rate) pPrice *= exchangeRates.USD.rate;
            else if (foundProduct.priceCurrency === "EUR" && exchangeRates.EUR?.rate) pPrice *= exchangeRates.EUR.rate;
          }
          totalAdjustment += pPrice;

          // Sumar ajustes de los atributos del sub-producto si están presentes en productAttributes
          const subAttrKey = `${attrKey}_${foundProduct.id}`;
          const subAttrs = (productAttributes as any)[subAttrKey];
          if (subAttrs) {
            const subCategory = categories.find(c => c.name === foundProduct.category);
            if (subCategory) {
              totalAdjustment += calculateProductUnitPriceWithAttributes(0, subAttrs, subCategory, exchangeRates, allProducts, categories);
            }
          }
        }
      };

      if (Array.isArray(selectedValue)) {
        selectedValue.forEach(processProductPrice);
      } else if (selectedValue) {
        processProductPrice(selectedValue);
      }
      return;
    }

    // Manejar arrays para selección múltiple
    if (Array.isArray(selectedValue)) {
      selectedValue.forEach((valStr) => {
        const attributeValue = categoryAttribute.values.find((val) => {
          if (typeof val === "string") {
            return val === valStr;
          }
          return val.id === valStr || val.label === valStr;
        });

        if (
          attributeValue &&
          typeof attributeValue === "object" &&
          "priceAdjustment" in attributeValue
        ) {
          const adjustment = attributeValue.priceAdjustment || 0;
          const currency = attributeValue.priceAdjustmentCurrency || "Bs";
          totalAdjustment += convertAdjustment(adjustment, currency);
        }
      });
    } else {
      // Manejar valores simples (selección única)
      const selectedValueStr = selectedValue.toString();
      const attributeValue = categoryAttribute.values.find((val) => {
        if (typeof val === "string") {
          return val === selectedValueStr;
        }
        return val.id === selectedValueStr || val.label === selectedValueStr;
      });

      if (
        attributeValue &&
        typeof attributeValue === "object" &&
        "priceAdjustment" in attributeValue
      ) {
        const adjustment = attributeValue.priceAdjustment || 0;
        const currency = attributeValue.priceAdjustmentCurrency || "Bs";
        totalAdjustment += convertAdjustment(adjustment, currency);
      }
    }
  });

  return basePrice + totalAdjustment;
};

// ===== USERS STORAGE (IndexedDB) =====

// Helper para mapear UserResponseDto del backend a User del frontend
const userFromBackendDto = (dto: UserResponseDto): User => ({
  id: dto.id,
  username: dto.username,
  email: dto.email,
  name: dto.name,
  role: dto.role as User["role"],
  status: dto.status as "active" | "inactive",
  createdAt: dto.createdAt || new Date().toISOString(),
  exclusiveCommission: dto.exclusiveCommission,
  baseSalary:
    dto.baseSalary !== undefined && dto.baseSalary !== null
      ? Number(dto.baseSalary)
      : undefined,
  baseSalaryCurrency: dto.baseSalaryCurrency,
});

const repopulateUsersCache = async (users: User[]): Promise<void> => {
  try {
    await db.clearStore("users");
    for (const u of users) {
      await db.put("users", u);
    }
  } catch (e) {
    console.warn("Error actualizando cache de usuarios:", e);
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    if (isOnline()) {
      try {
        const backendUsers = await apiClient.getUsers();
        const list = backendUsers.map(userFromBackendDto);
        void repopulateUsersCache(list);
        return list;
      } catch (error) {
        console.warn("Error cargando usuarios del backend, usando IndexedDB:", error);
        return await db.getAll<User>("users");
      }
    }
    return await db.getAll<User>("users");
  } catch (error) {
    console.error("Error loading users:", error);
    return [];
  }
};

export const getUser = async (id: string): Promise<User | undefined> => {
  try {
    if (isOnline()) {
      try {
        const dto = await apiClient.getUserById(id);
        const u = userFromBackendDto(dto);
        await db.put("users", u);
        return u;
      } catch (error) {
        console.warn("getUser: API falló, usando IndexedDB", error);
      }
    }
    return await db.get<User>("users", id);
  } catch (error) {
    console.error("Error loading user:", error);
    return undefined;
  }
};

export const addUser = async (
  user: Omit<User, "id" | "createdAt">
): Promise<User> => {
  try {
    const newUser: User = {
      ...user,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };

    await db.add("users", newUser);
    console.log("✅ Usuario guardado en IndexedDB:", newUser.username);
    return newUser;
  } catch (error) {
    console.error("Error adding user to IndexedDB:", error);
    throw error;
  }
};

export const updateUser = async (
  id: string,
  updates: Partial<User>
): Promise<User> => {
  try {
    const existingUser = await getUser(id);
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    const updatedUser: User = {
      ...existingUser,
      ...updates,
    };

    await db.update("users", updatedUser);
    return updatedUser;
  } catch (error) {
    console.error("Error updating user in IndexedDB:", error);
    throw error;
  }
};

export const deleteUser = async (id: string): Promise<void> => {
  try {
    await db.remove("users", id);
  } catch (error) {
    console.error("Error deleting user from IndexedDB:", error);
    throw error;
  }
};

// ===== VENDORS STORAGE (IndexedDB) =====
// Ahora obtenemos vendedores y referidos desde los usuarios según su rol

/**
 * Obtiene vendedores desde usuarios con rol "Store Seller" o "Vendedor de tienda"
 * y los convierte al formato Vendor para mantener compatibilidad
 */
export const getVendors = async (): Promise<Vendor[]> => {
  try {
    // Obtener todos los usuarios
    const users = await getUsers();

    // Filtrar usuarios con rol de vendedor de tienda u online (activos)
    // Normalizar rol (trim + comparación insensible a mayúsculas para etiquetas en español)
    const vendorUsers = users.filter((user) => {
      if (user.status !== "active") return false;
      const raw = ((user.role as string) || "").trim();
      if (!raw) return false;
      const r = raw.toLowerCase();
      return (
        raw === "Store Seller" ||
        raw === "Online Seller" ||
        r === "vendedor de tienda" ||
        r === "vendedor online"
      );
    });

    // Convertir usuarios a formato Vendor
    const vendors: Vendor[] = vendorUsers.map((user) => {
      const raw = ((user.role as string) || "").trim();
      const rl = raw.toLowerCase();
      const displayRole =
        raw === "Store Seller" || rl === "vendedor de tienda"
          ? "Vendedor de tienda"
          : raw === "Online Seller" || rl === "vendedor online"
            ? "Vendedor Online"
            : user.role as string;
      return {
        id: user.id,
        name: user.name,
        role: displayRole,
        type: "vendor" as const,
      };
    });

    return vendors;
  } catch (error) {
    console.error("Error loading vendors from users:", error);
    return [];
  }
};

/**
 * Obtiene referidos desde usuarios con rol "Online Seller" o "Vendedor Online"
 * y los convierte al formato Vendor para mantener compatibilidad
 */
export const getReferrers = async (): Promise<Vendor[]> => {
  try {
    // Obtener todos los usuarios
    const users = await getUsers();

    // Filtrar usuarios con rol de vendedor online (activos)
    const referrerUsers = users.filter((user) => {
      if (user.status !== "active") return false;
      const raw = ((user.role as string) || "").trim();
      if (!raw) return false;
      const r = raw.toLowerCase();
      return raw === "Online Seller" || r === "vendedor online";
    });

    // Convertir usuarios a formato Vendor
    const referrers: Vendor[] = referrerUsers.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role === "Online Seller" ? "Vendedor Online" : user.role,
      type: "referrer" as const,
    }));

    return referrers;
  } catch (error) {
    console.error("Error loading referrers from users:", error);
    return [];
  }
};

// ===== COMMISSIONS STORAGE (IndexedDB) =====

export interface Commission {
  id: string;
  commissionType: "role" | "user"; // Por rol o por usuario
  role?: string; // Solo si commissionType === "role"
  userId?: string; // Solo si commissionType === "user"
  userName?: string; // Nombre del usuario (para display)
  commissionKind: "percentage" | "net"; // Porcentual o neta
  value: number; // Valor o cantidad
  currency: "Bs" | "USD" | "EUR";
  createdAt: string;
  updatedAt: string;
}

export const getCommissions = async (): Promise<Commission[]> => {
  try {
    return await db.getAll<Commission>("commissions");
  } catch (error) {
    console.error("Error loading commissions from IndexedDB:", error);
    return [];
  }
};

export const getCommission = async (id: string): Promise<Commission | undefined> => {
  try {
    return await db.get<Commission>("commissions", id);
  } catch (error) {
    console.error("Error loading commission from IndexedDB:", error);
    return undefined;
  }
};

export const addCommission = async (commission: Omit<Commission, "id" | "createdAt" | "updatedAt">): Promise<Commission> => {
  try {
    const newCommission: Commission = {
      ...commission,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Guardar en IndexedDB (fuente de verdad)
    await db.add("commissions", newCommission);
    console.log("✅ Comisión guardada en IndexedDB:", newCommission.id);

    // 2. Sincronizar con backend (importante, pero no bloquea si falla)
    try {
      const { syncManager } = await import("./sync-manager");
      await syncManager.addToQueue({
        type: "create",
        entity: "commission",
        entityId: newCommission.id,
        data: newCommission,
      });
    } catch (syncError) {
      console.warn("⚠️ No se pudo agregar a cola de sincronización (se sincronizará después):", syncError);
      // No fallar, IndexedDB es la fuente de verdad
    }

    return newCommission;
  } catch (error) {
    console.error("Error adding commission to IndexedDB:", error);
    throw error;
  }
};

export const updateCommission = async (id: string, updates: Partial<Commission>): Promise<Commission> => {
  try {
    const existing = await db.get<Commission>("commissions", id);
    if (!existing) {
      throw new Error("Commission not found");
    }
    const updated: Commission = {
      ...existing,
      ...updates,
      id, // Asegurar que el ID no cambie
      updatedAt: new Date().toISOString(),
    };

    // 1. Actualizar en IndexedDB (fuente de verdad)
    await db.update("commissions", updated);
    console.log("✅ Comisión actualizada en IndexedDB:", id);

    // 2. Sincronizar con backend (importante, pero no bloquea si falla)
    try {
      const { syncManager } = await import("./sync-manager");
      await syncManager.addToQueue({
        type: "update",
        entity: "commission",
        entityId: id,
        data: updated,
      });
    } catch (syncError) {
      console.warn("⚠️ No se pudo agregar a cola de sincronización (se sincronizará después):", syncError);
      // No fallar, IndexedDB es la fuente de verdad
    }

    return updated;
  } catch (error) {
    console.error("Error updating commission in IndexedDB:", error);
    throw error;
  }
};

export const deleteCommission = async (id: string): Promise<void> => {
  try {
    // 1. Eliminar de IndexedDB (fuente de verdad)
    await db.remove("commissions", id);
    console.log("✅ Comisión eliminada de IndexedDB:", id);

    // 2. Sincronizar con backend (importante, pero no bloquea si falla)
    try {
      const { syncManager } = await import("./sync-manager");
      await syncManager.addToQueue({
        type: "delete",
        entity: "commission",
        entityId: id,
        data: { id },
      });
    } catch (syncError) {
      console.warn("⚠️ No se pudo agregar a cola de sincronización (se sincronizará después):", syncError);
      // No fallar, IndexedDB es la fuente de verdad
    }
  } catch (error) {
    console.error("Error deleting commission from IndexedDB:", error);
    throw error;
  }
};

// ===== PRODUCT COMMISSIONS (Comisiones por Categoría/Familia) =====

export interface ProductCommission {
  id: string;
  categoryId: string;
  categoryName: string;
  /** USD fijos por unidad vendida en esa familia/categoría (0 = sin comisión). */
  commissionValue: number;
  createdAt: string;
  updatedAt: string;
}

export const getProductCommissions = async (): Promise<ProductCommission[]> => {
  try {
    // Intentar obtener del backend via API
    const response = await apiClient.getProductCommissions();
    return response;
  } catch (error) {
    console.error("Error loading product commissions:", error);
    return [];
  }
};

export const upsertProductCommission = async (
  data: Omit<ProductCommission, "id" | "createdAt" | "updatedAt">
): Promise<ProductCommission> => {
  try {
    return await apiClient.upsertProductCommission(data);
  } catch (error) {
    console.error("Error upserting product commission:", error);
    throw error;
  }
};

export const batchUpsertProductCommissions = async (
  data: Omit<ProductCommission, "id" | "createdAt" | "updatedAt">[]
): Promise<ProductCommission[]> => {
  try {
    return await apiClient.batchUpsertProductCommissions(data);
  } catch (error) {
    console.error("Error batch upserting product commissions:", error);
    throw error;
  }
};

export const deleteProductCommission = async (categoryId: string): Promise<void> => {
  try {
    await apiClient.deleteProductCommission(categoryId);
  } catch (error) {
    console.error("Error deleting product commission:", error);
    throw error;
  }
};

// ===== SALE TYPE COMMISSION RULES (Reglas de distribución por tipo de venta) =====

export interface SaleTypeCommissionRule {
  id: string;
  saleType: string;
  saleTypeLabel: string;
  vendorRate: number; // Porcentaje que gana el vendedor de tienda
  referrerRate: number; // Porcentaje que gana el referido/postventa
  createdAt: string;
  updatedAt: string;
}

export const getSaleTypeCommissionRules = async (): Promise<SaleTypeCommissionRule[]> => {
  try {
    return await apiClient.getSaleTypeCommissionRules();
  } catch (error) {
    console.error("Error loading sale type commission rules:", error);
    return [];
  }
};

export const upsertSaleTypeCommissionRule = async (
  data: Omit<SaleTypeCommissionRule, "id" | "createdAt" | "updatedAt">
): Promise<SaleTypeCommissionRule> => {
  try {
    return await apiClient.upsertSaleTypeCommissionRule(data);
  } catch (error) {
    console.error("Error upserting sale type commission rule:", error);
    throw error;
  }
};

export const batchUpsertSaleTypeCommissionRules = async (
  data: Omit<SaleTypeCommissionRule, "id" | "createdAt" | "updatedAt">[]
): Promise<SaleTypeCommissionRule[]> => {
  try {
    return await apiClient.batchUpsertSaleTypeCommissionRules(data);
  } catch (error) {
    console.error("Error batch upserting sale type commission rules:", error);
    throw error;
  }
};

export const deleteSaleTypeCommissionRule = async (saleType: string): Promise<void> => {
  try {
    await apiClient.deleteSaleTypeCommissionRule(saleType);
  } catch (error) {
    console.error("Error deleting sale type commission rule:", error);
    throw error;
  }
};

export const seedDefaultSaleTypeRules = async (): Promise<SaleTypeCommissionRule[]> => {
  try {
    return await apiClient.seedDefaultSaleTypeRules();
  } catch (error) {
    console.error("Error seeding default sale type rules:", error);
    throw error;
  }
};

// ===== COMMISSION CALCULATION FUNCTIONS =====
// Alineado con ReportService.CalculateProductCommission (backend): USD por unidad × cantidad;
// distribución por tipo de venta = % de esa comisión de familia. Fallback legacy si comisión familia = 0.

export type CommissionCalculationContext = {
  productCommissions: ProductCommission[];
  saleTypeRules: SaleTypeCommissionRule[];
  users: User[];
  legacyCommissions: Commission[];
};

/** Código de tipo de venta usado para reglas de distribución (prioriza saleType, luego deliveryType). */
export const getOrderSaleTypeCodeForCommission = (order: Order): string => {
  if (order.saleType) return order.saleType;
  if (order.deliveryType) return order.deliveryType;
  return "entrega";
};

const SALE_TYPE_CODE_LABELS: Record<string, string> = {
  delivery_express: "Delivery express",
  encargo: "Encargo",
  encargo_entrega: "Encargo con entrega",
  entrega: "Entrega",
  retiro_almacen: "Retiro por almacén",
  retiro_tienda: "Retiro por tienda",
  sistema_apartado: "Sistema apartado",
  entrega_programada: "Entrega programada",
};

/** Etiqueta legible del tipo de venta (misma clave que reparte comisión). */
export const getCommissionSaleTypeLabelForOrder = (
  order: Order,
  rules: SaleTypeCommissionRule[]
): string => {
  const code = getOrderSaleTypeCodeForCommission(order);
  const rule = rules.find((r) => r.saleType.toLowerCase() === code.toLowerCase());
  if (rule?.saleTypeLabel?.trim()) return rule.saleTypeLabel.trim();
  return SALE_TYPE_CODE_LABELS[code] ?? code;
};

const findCategoryCommissionRate = (
  product: OrderProduct,
  productCommissions: ProductCommission[]
): number => {
  const cat = product.category?.trim() ?? "";
  if (!cat) return 0;
  const catLower = cat.toLowerCase();
  const found = productCommissions.find(
    (c) =>
      (c.categoryName && c.categoryName.trim().toLowerCase() === catLower) ||
      c.categoryId === cat ||
      c.categoryId?.trim().toLowerCase() === catLower
  );
  return found?.commissionValue ?? 0;
};

const legacyCommissionForSeller = (
  sellerId: string,
  product: OrderProduct,
  legacyCommissions: Commission[],
  users: User[]
): number => {
  const user = users.find((u) => u.id === sellerId);
  if (!user) return 0;
  const commission =
    legacyCommissions.find(
      (c) => c.commissionType === "user" && c.userId === sellerId
    ) ||
    legacyCommissions.find(
      (c) => c.commissionType === "role" && c.role === user.role
    );
  if (!commission) return 0;
  const productTotal = product.total;
  if (commission.commissionKind === "percentage") {
    return productTotal * (commission.value / 100);
  }
  return commission.value;
};

export type ProductCommissionSplit = {
  vendorCommission: number;
  referrerCommission: number;
  /** True cuando hay reparto vendedor/referido en el reporte (dos filas con comisiones compartidas). */
  isShared: boolean;
};

export const computeProductCommissionSplit = (
  order: Order,
  product: OrderProduct,
  ctx: CommissionCalculationContext
): ProductCommissionSplit => {
  const mainVendor = ctx.users.find((u) => u.id === order.vendorId);
  const isExclusiveVendor = mainVendor?.exclusiveCommission === true;
  const referrerId = order.referrerId?.trim();
  const hasReferrer = !!referrerId;
  const isSharedSale = hasReferrer && !isExclusiveVendor;

  const baseRate = findCategoryCommissionRate(product, ctx.productCommissions);
  const qty = Math.max(product.quantity || 1, 1);
  const familyCommission = baseRate > 0 ? baseRate * qty : 0;

  if (baseRate <= 0) {
    const vendorFull = legacyCommissionForSeller(
      order.vendorId,
      product,
      ctx.legacyCommissions,
      ctx.users
    );
    if (!hasReferrer) {
      return {
        vendorCommission: vendorFull,
        referrerCommission: 0,
        isShared: false,
      };
    }
    if (isExclusiveVendor) {
      return {
        vendorCommission: vendorFull,
        referrerCommission: 0,
        isShared: false,
      };
    }
    const referrerFull = legacyCommissionForSeller(
      referrerId!,
      product,
      ctx.legacyCommissions,
      ctx.users
    );
    return {
      vendorCommission: vendorFull / 2,
      referrerCommission: referrerFull / 2,
      isShared: true,
    };
  }

  if (isSharedSale) {
    const saleType = getOrderSaleTypeCodeForCommission(order);
    const rule = ctx.saleTypeRules.find(
      (r) => r.saleType.toLowerCase() === saleType.toLowerCase()
    );
    if (rule) {
      return {
        vendorCommission: familyCommission * (rule.vendorRate / 100),
        referrerCommission: familyCommission * (rule.referrerRate / 100),
        isShared: true,
      };
    }
    const half = familyCommission / 2;
    return {
      vendorCommission: half,
      referrerCommission: half,
      isShared: true,
    };
  }

  return {
    vendorCommission: familyCommission,
    referrerCommission: 0,
    isShared: false,
  };
};

/**
 * Monto de comisión para un vendedor/referido concreto (paridad con el reparto del pedido).
 */
export const calculateProductCommission = async (
  product: OrderProduct,
  order: Order,
  sellerId: string | null
): Promise<number> => {
  if (!sellerId) return 0;
  try {
    const [productCommissions, saleTypeRules, users, legacyCommissions] =
      await Promise.all([
        getProductCommissions(),
        getSaleTypeCommissionRules(),
        getUsers(),
        getCommissions(),
      ]);
    const ctx: CommissionCalculationContext = {
      productCommissions,
      saleTypeRules,
      users,
      legacyCommissions,
    };
    const split = computeProductCommissionSplit(order, product, ctx);
    if (sellerId === order.vendorId) return split.vendorCommission;
    if (order.referrerId && sellerId === order.referrerId) {
      return split.referrerCommission;
    }
    return 0;
  } catch (error) {
    console.error("Error calculating product commission:", error);
    return 0;
  }
};

/**
 * Calcula todas las comisiones de un pedido
 * Retorna un array con las comisiones por producto y vendedor
 */
export const calculateOrderCommissions = async (
  order: Order
): Promise<
  Array<{
    sellerId: string;
    sellerName: string;
    productId: string;
    productName: string;
    commission: number;
    isShared: boolean;
  }>
> => {
  const results: Array<{
    sellerId: string;
    sellerName: string;
    productId: string;
    productName: string;
    commission: number;
    isShared: boolean;
  }> = [];

  try {
    const [productCommissions, saleTypeRules, users, legacyCommissions] =
      await Promise.all([
        getProductCommissions(),
        getSaleTypeCommissionRules(),
        getUsers(),
        getCommissions(),
      ]);
    const ctx: CommissionCalculationContext = {
      productCommissions,
      saleTypeRules,
      users,
      legacyCommissions,
    };

    for (const product of order.products) {
      const split = computeProductCommissionSplit(order, product, ctx);

      if (split.vendorCommission === 0 && split.referrerCommission === 0) {
        continue;
      }

      if (split.vendorCommission !== 0) {
        results.push({
          sellerId: order.vendorId,
          sellerName: order.vendorName,
          productId: product.id,
          productName: product.name,
          commission: split.vendorCommission,
          isShared: split.isShared,
        });
      }

      if (split.isShared && order.referrerId && split.referrerCommission !== 0) {
        results.push({
          sellerId: order.referrerId,
          sellerName: order.referrerName || "",
          productId: product.id,
          productName: product.name,
          commission: split.referrerCommission,
          isShared: true,
        });
      }
    }
  } catch (error) {
    console.error("Error calculating order commissions:", error);
  }

  return results;
};

/**
 * Obtiene el tipo de compra de un pedido para el reporte
 */
export const getPurchaseType = (order: Order): string => {
  // Mapear deliveryType a tipo de compra
  if (order.deliveryType) {
    const typeMap: Record<string, string> = {
      entrega_programada: "Entrega",
      delivery_express: "Delivery express",
      retiro_tienda: "Retiro por tienda",
      retiro_almacen: "Retiro por almacén",
    };
    return typeMap[order.deliveryType] || order.deliveryType;
  }

  // Fallback a saleType
  if (order.saleType) {
    const typeMap: Record<string, string> = {
      encargo: "Encargo",
      entrega: "Entrega",
      sistema_apartado: "Sistema Apartado",
    };
    return typeMap[order.saleType] || order.saleType;
  }

  return "-";
};

export const getVendor = async (id: string): Promise<Vendor | undefined> => {
  try {
    // Buscar en usuarios primero
    const user = await getUser(id);
    if (user && user.status === "active") {
      // Verificar si es vendedor o referido
      const isVendor = user.role === "Store Seller";
      const isReferrer = user.role === "Online Seller";

      if (isVendor || isReferrer) {
        return {
          id: user.id,
          name: user.name,
          role:
            user.role === "Store Seller"
              ? "Vendedor de tienda"
              : user.role === "Online Seller"
                ? "Vendedor Online"
                : user.role,
          type: isVendor ? "vendor" : "referrer",
        };
      }
    }
    return undefined;
  } catch (error) {
    console.error("Error loading vendor from users:", error);
    return undefined;
  }
};

export const addVendor = async (
  vendor: Omit<Vendor, "id">
): Promise<Vendor> => {
  try {
    const newVendor: Vendor = {
      ...vendor,
      id: Date.now().toString(),
    };

    await db.add("vendors", newVendor);
    console.log("✅ Vendedor guardado en IndexedDB:", newVendor.name);
    return newVendor;
  } catch (error) {
    console.error("Error adding vendor to IndexedDB:", error);
    throw error;
  }
};

export const updateVendor = async (
  id: string,
  updates: Partial<Vendor>
): Promise<Vendor> => {
  try {
    const existingVendor = await getVendor(id);
    if (!existingVendor) {
      throw new Error(`Vendor with id ${id} not found`);
    }

    const updatedVendor: Vendor = {
      ...existingVendor,
      ...updates,
    };

    await db.update("vendors", updatedVendor);
    return updatedVendor;
  } catch (error) {
    console.error("Error updating vendor in IndexedDB:", error);
    throw error;
  }
};

export const deleteVendor = async (id: string): Promise<void> => {
  try {
    await db.remove("vendors", id);
  } catch (error) {
    console.error("Error deleting vendor from IndexedDB:", error);
    throw error;
  }
};
