import * as db from "./indexeddb";
import type { Currency } from "./currency-utils";
import { apiClient } from "./api-client";
import type {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ProductResponseDto,
  CreateProductDto,
  UpdateProductDto,
  UserResponseDto,
  OrderResponseDto,
  CreateOrderDto,
  UpdateOrderDto,
  OrderProductDto as OrderProductDtoBackend,
  PaymentDetailsDto,
  PartialPaymentDto as PartialPaymentDtoBackend,
} from "./api-client";
import { syncManager } from "./sync-manager";

export interface AttributeValue {
  id: string;
  label: string;
  isDefault?: boolean;
  priceAdjustment?: number; // positive for increase, negative for decrease
  priceAdjustmentCurrency?: Currency; // Moneda del ajuste de precio
  productId?: number; // ID del producto cuando valueType es "Product"
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
const backendIdToNumber = (backendId: string): number => {
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
              productId: val.productId?.toString(),
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
    values: attr.values.map((val) => ({
      id: val.id,
      label: val.label,
      isDefault: val.isDefault,
      priceAdjustment: val.priceAdjustment,
      priceAdjustmentCurrency: val.priceAdjustmentCurrency as
        | Currency
        | undefined,
      productId: val.productId ? backendIdToNumber(val.productId) : undefined,
    })),
  })),
});

// Helper para verificar si estamos online
const isOnline = (): boolean => {
  if (typeof window === "undefined") return false;
  return navigator.onLine;
};

export const getCategories = async (): Promise<Category[]> => {
  try {
    // Cargar siempre categorías locales desde IndexedDB primero (offline-first)
    const localCategoriesDB = await db.getAll<CategoryDB>("categories");
    const localCategories = localCategoriesDB.map(categoryFromDB);

    // Si hay conexión, intentar sincronizar con backend y hacer merge
    if (isOnline()) {
      try {
        const backendCategories = await apiClient.getCategories();
        const backendCategoriesMapped = backendCategories.map(
          categoryFromBackendDto
        );

        // Hacer merge: usar nombre como clave única (similar a SKU en productos y orderNumber en órdenes)
        // El nombre es único según el índice en IndexedDB
        const categoriesMap = new Map<string, Category>();

        // Primero agregar categorías locales
        for (const category of localCategories) {
          categoriesMap.set(category.name, category);
        }

        // Luego agregar/actualizar con categorías del backend (estas tienen prioridad)
        const idSet = new Set<number>(); // Para detectar IDs duplicados

        for (let i = 0; i < backendCategories.length; i++) {
          const backendCategory = backendCategories[i];
          const mappedCategory = backendCategoriesMapped[i];

          // Verificar si el ID ya existe
          if (idSet.has(mappedCategory.id)) {
            console.warn(
              `⚠️ ID duplicado detectado: ${mappedCategory.id} para categoría "${mappedCategory.name}". ` +
              `Backend ID: ${backendCategory.id}. Generando nuevo ID...`
            );
            // Generar un nuevo ID único sumando un offset basado en el índice
            mappedCategory.id = mappedCategory.id + (i * 1000000);
            // Asegurar que el nuevo ID no colisione
            while (idSet.has(mappedCategory.id)) {
              mappedCategory.id += 1;
            }
          }
          
          idSet.add(mappedCategory.id);

          // Verificar si ya existe una categoría con el mismo nombre
          const existing = categoriesMap.get(mappedCategory.name);
          if (existing && existing.id !== mappedCategory.id) {
            console.warn(
              `⚠️ Advertencia: Categoría "${mappedCategory.name}" existe con ID diferente. ` +
              `Local: ${existing.id}, Backend: ${mappedCategory.id}. Usando versión del backend.`
            );
          }

          // Las categorías del backend tienen prioridad
          categoriesMap.set(mappedCategory.name, mappedCategory);

          // Guardar/actualizar en IndexedDB usando put (hace update si existe, add si no)
          try {
            await db.put("categories", categoryToDB(mappedCategory, mappedCategory.backendId));
            console.log(`✅ Categoría sincronizada: ${mappedCategory.name} (ID: ${mappedCategory.id}, Backend ID: ${backendCategory.id})`);
          } catch (error) {
            console.error(`❌ Error guardando categoría ${mappedCategory.name}:`, error);
            // Continuar con las demás categorías aunque una falle
          }
        }

        const mergedCategories = Array.from(categoriesMap.values());
        console.log(
          `✅ Categorías: ${localCategories.length} locales + ${backendCategories.length} del backend = ${mergedCategories.length} totales`
        );

        // Log de debugging para verificar que todas se cargaron
        if (mergedCategories.length !== Math.max(localCategories.length, backendCategories.length)) {
          console.warn(
            `⚠️ Posible pérdida de categorías: esperadas ${Math.max(localCategories.length, backendCategories.length)}, ` +
            `obtenidas ${mergedCategories.length}`
          );
        }

        return mergedCategories;
      } catch (error) {
        console.warn(
          "⚠️ Error cargando categorías del backend, usando solo IndexedDB:",
          error
        );
        // Si falla el backend, retornar categorías locales
        return localCategories;
      }
    }

    // Si está offline, solo retornar categorías locales
    console.log(
      `✅ Categorías cargadas desde IndexedDB: ${localCategories.length}`
    );
    return localCategories;
  } catch (error) {
    console.error("Error loading categories from IndexedDB:", error);
    return [];
  }
};

export const getCategory = async (
  id: number
): Promise<Category | undefined> => {
  try {
    const categoryDB = await db.get<CategoryDB>("categories", id.toString());
    return categoryDB ? categoryFromDB(categoryDB) : undefined;
  } catch (error) {
    console.error("Error loading category from IndexedDB:", error);
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

      // Guardar también en IndexedDB (preservando backendId si existe)
      await db.add("categories", categoryToDB(newCategory, newCategory.backendId));
      console.log(
        "✅ Categoría guardada en backend y IndexedDB:",
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
            // Merge con los datos nuevos del usuario
            newCategory = { ...newCategory, ...category };
            await db.update("categories", categoryToDB(newCategory, newCategory.backendId));
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
                          productId: val.productId?.toString(),
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

        // Actualizar también en IndexedDB con los datos del backend
        await db.update("categories", categoryToDB(syncedCategory, syncedCategory.backendId));
        console.log(
          "✅ Categoría actualizada en backend y IndexedDB:",
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
                              productId: val.productId?.toString(),
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
            await db.update("categories", categoryToDB(syncedCategory, syncedCategory.backendId));
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
                      productId: val.productId?.toString(),
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
  name: dto.name,
  category: dto.category || "", // El backend devuelve el nombre de la categoría en 'category'
  price: dto.price,
  priceCurrency: dto.priceCurrency as Currency | undefined,
  stock: dto.stock,
  status: dto.status,
  sku: dto.sku || "", // El DTO tiene 'sku' en minúsculas
  attributes: dto.attributes,
});

export const getProducts = async (): Promise<Product[]> => {
  try {
    // Cargar siempre productos locales desde IndexedDB primero (offline-first)
    const localProductsDB = await db.getAll<ProductDB>("products");
    const localProducts = localProductsDB.map(productFromDB);

    // Si hay conexión, intentar sincronizar con backend y hacer merge
    if (isOnline()) {
      try {
        const backendProducts = await apiClient.getProducts();
        const backendProductsMapped = backendProducts.map(
          productFromBackendDto
        );

        // Hacer merge: combinar productos del backend con los locales
        // Usar SKU como clave única para evitar duplicados (más confiable que ID)
        // Los productos del backend tienen prioridad sobre los locales
        const productsMap = new Map<string, Product>();

        // Primero agregar productos locales
        for (const product of localProducts) {
          if (product.sku) {
            productsMap.set(product.sku, product);
          }
        }

        // Luego agregar/actualizar con productos del backend (estos tienen prioridad)
        for (const product of backendProductsMapped) {
          if (product.sku) {
            productsMap.set(product.sku, product);
            // Guardar/actualizar en IndexedDB
            try {
              await db.update("products", productToDB(product));
            } catch {
              await db.add("products", productToDB(product));
            }
          }
        }

        const mergedProducts = Array.from(productsMap.values());
        console.log(
          `✅ Productos: ${localProducts.length} locales + ${backendProductsMapped.length} del backend = ${mergedProducts.length} totales`
        );
        return mergedProducts;
      } catch (error) {
        console.warn(
          "⚠️ Error cargando productos del backend, usando solo IndexedDB:",
          error
        );
        // Si falla el backend, retornar productos locales
        return localProducts;
      }
    }

    // Si está offline, solo retornar productos locales
    console.log(
      `✅ Productos cargados desde IndexedDB: ${localProducts.length}`
    );
    return localProducts;
  } catch (error) {
    console.error("Error loading products from IndexedDB:", error);
    return [];
  }
};

export const getProduct = async (id: number): Promise<Product | undefined> => {
  try {
    const productDB = await db.get<ProductDB>("products", id.toString());
    return productDB ? productFromDB(productDB) : undefined;
  } catch (error) {
    console.error("Error loading product from IndexedDB:", error);
    return undefined;
  }
};

export const getProductsByCategory = async (
  category: string
): Promise<Product[]> => {
  try {
    const productsDB = await db.getByIndex<ProductDB>(
      "products",
      "category",
      category
    );
    return productsDB.map(productFromDB);
  } catch (error) {
    console.error("Error loading products by category from IndexedDB:", error);
    return [];
  }
};

export const getProductsByStatus = async (
  status: string
): Promise<Product[]> => {
  try {
    const productsDB = await db.getByIndex<ProductDB>(
      "products",
      "status",
      status
    );
    return productsDB.map(productFromDB);
  } catch (error) {
    console.error("Error loading products by status from IndexedDB:", error);
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

      // Guardar también en IndexedDB
      await db.add("products", productToDB(newProduct));
      console.log(
        "✅ Producto guardado en backend y IndexedDB:",
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
  const existingProduct = await getProduct(id);
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

        // Actualizar también en IndexedDB con los datos del backend
        await db.update("products", productToDB(syncedProduct));
        console.log(
          "✅ Producto actualizado en backend y IndexedDB:",
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
          entityId: id.toString(),
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
  manufacturingStatus?: "debe_fabricar" | "fabricando" | "fabricado"; // Estado de fabricación (solo si no_disponible)
  manufacturingProviderId?: string; // ID del proveedor asignado
  manufacturingProviderName?: string; // Nombre del proveedor (para display)
  manufacturingStartedAt?: string; // Fecha de inicio de fabricación
  manufacturingCompletedAt?: string; // Fecha de finalización de fabricación
  manufacturingNotes?: string; // Notas de fabricación
  // Estado de ubicación del producto
  locationStatus?: "EN TIENDA" | "FABRICACION" | ""; // Estado de ubicación: EN TIENDA, FABRICACION o en blanco
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
  status: "Presupuesto" | "Generado" | "Generada" | "Fabricación" | "Por despachar" | "Completada" | "Cancelado";
  createdAt: string;
  updatedAt: string;
  productMarkups?: Record<string, number>;
  createSupplierOrder?: boolean;
  observations?: string; // Observaciones generales del pedido
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
}

export interface Vendor {
  id: string;
  name: string;
  role: string;
  type: "vendor" | "referrer";
}

// ===== ORDERS STORAGE (IndexedDB) =====

// Helper functions para mapear orders entre frontend y backend
const orderFromBackendDto = (dto: OrderResponseDto): Order => ({
  id: dto.id,
  orderNumber: dto.orderNumber,
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
    manufacturingStatus: p.manufacturingStatus as "debe_fabricar" | "fabricando" | "fabricado" | undefined,
    manufacturingProviderId: p.manufacturingProviderId,
    manufacturingProviderName: p.manufacturingProviderName,
    manufacturingStartedAt: p.manufacturingStartedAt,
    manufacturingCompletedAt: p.manufacturingCompletedAt,
    manufacturingNotes: p.manufacturingNotes,
    locationStatus: (() => {
      // Normalizar valores antiguos a nuevos
      if (p.locationStatus === "en_tienda") return "EN TIENDA" as const
      if (p.locationStatus === "mandar_a_fabricar") return "FABRICACION" as const
      return (p.locationStatus as "EN TIENDA" | "FABRICACION" | "" | undefined) ?? undefined
    })(),
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
});

export const getOrders = async (): Promise<Order[]> => {
  try {
    // Cargar siempre órdenes locales desde IndexedDB primero (offline-first)
    const localOrders = await db.getAll<Order>("orders");

    // Si hay conexión, intentar sincronizar con backend y hacer merge
    if (isOnline()) {
      try {
        const backendOrders = await apiClient.getOrders();
        const backendOrdersMapped = backendOrders.map(orderFromBackendDto);

        // Hacer merge usando orderNumber como clave única para evitar duplicados
        // Los pedidos del backend tienen prioridad sobre los locales
        const ordersMap = new Map<string, Order>();

        // Primero agregar órdenes locales
        for (const order of localOrders) {
          ordersMap.set(order.orderNumber, order);
        }

        // Luego agregar/actualizar con órdenes del backend (estas tienen prioridad)
        for (const order of backendOrdersMapped) {
          ordersMap.set(order.orderNumber, order);
          // Guardar/actualizar en IndexedDB
          try {
            await db.update("orders", order);
          } catch {
            await db.add("orders", order);
          }
        }

        const mergedOrders = Array.from(ordersMap.values());
        console.log(
          `✅ Órdenes: ${localOrders.length} locales + ${backendOrdersMapped.length} del backend = ${mergedOrders.length} totales`
        );
        return mergedOrders;
      } catch (error) {
        console.warn(
          "⚠️ Error cargando órdenes del backend, usando solo IndexedDB:",
          error
        );
        // Si falla el backend, retornar órdenes locales
        return localOrders;
      }
    }

    // Si está offline, solo retornar órdenes locales
    console.log(`✅ Órdenes cargadas desde IndexedDB (offline): ${localOrders.length}`);
    return localOrders;
  } catch (error) {
    console.error("Error loading orders from IndexedDB:", error);
    return [];
  }
};

export const getOrder = async (id: string): Promise<Order | undefined> => {
  try {
    return await db.get<Order>("orders", id);
  } catch (error) {
    console.error("Error loading order from IndexedDB:", error);
    return undefined;
  }
};

export const getOrdersByClient = async (clientId: string): Promise<Order[]> => {
  try {
    return await db.getByIndex<Order>("orders", "clientId", clientId);
  } catch (error) {
    console.error("Error loading orders by client from IndexedDB:", error);
    return [];
  }
};

export const getOrdersByStatus = async (status: string): Promise<Order[]> => {
  try {
    return await db.getByIndex<Order>("orders", "status", status);
  } catch (error) {
    console.error("Error loading orders by status from IndexedDB:", error);
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

      // Guardar también en IndexedDB
      await db.add("orders", newOrder);
      console.log("✅ Pedido guardado en backend y IndexedDB:", newOrder.orderNumber);
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
    // Obtener el número de pedidos para generar el siguiente número
    const orders = await getOrders();
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
              } : undefined,
            })) : undefined,
            deliveryAddress: updatedOrder.deliveryAddress !== existingOrder.deliveryAddress ? updatedOrder.deliveryAddress : undefined,
            hasDelivery: updatedOrder.hasDelivery !== existingOrder.hasDelivery ? updatedOrder.hasDelivery : undefined,
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

          // Actualizar también en IndexedDB con los datos del backend
          await db.update("orders", syncedOrder);
          console.log("✅ Pedido actualizado en backend y IndexedDB:", syncedOrder.orderNumber);
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
            } : undefined,
          })),
          status: updatedOrder.status,
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
  dispatchDate?: string; // Fecha de despacho
  completedAt?: string; // Fecha de completado
}

// Función para obtener pedidos y presupuestos unificados
export const getUnifiedOrders = async (): Promise<UnifiedOrder[]> => {
  try {
    const [orders, budgets] = await Promise.all([
      getOrders(),
      getBudgets(),
    ]);

    // Convertir pedidos a formato unificado
    const unifiedOrders: UnifiedOrder[] = orders.map((order) => ({
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
      dispatchDate: order.dispatchDate,
      completedAt: order.completedAt,
    }));

    // Convertir presupuestos a formato unificado
    const unifiedBudgets: UnifiedOrder[] = budgets.map((budget) => ({
      id: budget.id,
      orderNumber: budget.budgetNumber, // Usar budgetNumber como orderNumber
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
      order.products.filter(
        (product) =>
          product.locationStatus === "FABRICACION" &&
          product.manufacturingStatus !== "fabricado"
      ).length
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

export const getBudgets = async (): Promise<Budget[]> => {
  try {
    // Cargar siempre presupuestos locales desde IndexedDB primero (offline-first)
    const localBudgets = await db.getAll<Budget>("budgets");

    // Si hay conexión, intentar sincronizar con backend (por ahora solo local)
    if (isOnline()) {
      // TODO: Cuando el backend esté listo, descomentar:
      // const backendBudgets = await apiClient.getBudgets();
      // Hacer merge similar a orders
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
  try {
    const budgets = await getBudgets();
    const budgetNumber = `PRE-${String(budgets.length + 1).padStart(3, "0")}`;

    const now = new Date();
    const validForDays = budget.validForDays || 30;
    const expiresAt = new Date(now);
    expiresAt.setDate(now.getDate() + validForDays);

    const newBudget: Budget = {
      ...budget,
      id: Date.now().toString(),
      budgetNumber,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "Presupuesto", // Nuevo estado inicial
      validForDays,
    };

    await db.add("budgets", newBudget);
    console.log("✅ Presupuesto guardado en IndexedDB:", newBudget.budgetNumber);
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
    await db.remove("budgets", id);
  } catch (error) {
    console.error("Error deleting budget from IndexedDB:", error);
    throw error;
  }
};

// ===== CLIENTS STORAGE (IndexedDB) =====

export const getClients = async (): Promise<Client[]> => {
  try {
    return await db.getAll<Client>("clients");
  } catch (error) {
    console.error("Error loading clients from IndexedDB:", error);
    return [];
  }
};

export const getClient = async (id: string): Promise<Client | undefined> => {
  try {
    return await db.get<Client>("clients", id);
  } catch (error) {
    console.error("Error loading client from IndexedDB:", error);
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

export const getProviders = async (): Promise<Provider[]> => {
  try {
    return await db.getAll<Provider>("providers");
  } catch (error) {
    console.error("Error loading providers from IndexedDB:", error);
    return [];
  }
};

export const getProvider = async (
  id: string
): Promise<Provider | undefined> => {
  try {
    return await db.get<Provider>("providers", id);
  } catch (error) {
    console.error("Error loading provider from IndexedDB:", error);
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

// ===== STORES STORAGE (IndexedDB) =====

export const getStores = async (): Promise<Store[]> => {
  try {
    return await db.getAll<Store>("stores");
  } catch (error) {
    console.error("Error loading stores from IndexedDB:", error);
    return [];
  }
};

export const getStore = async (id: string): Promise<Store | undefined> => {
  try {
    return await db.get<Store>("stores", id);
  } catch (error) {
    console.error("Error loading store from IndexedDB:", error);
    return undefined;
  }
};

export const addStore = async (
  store: Omit<Store, "id" | "createdAt" | "updatedAt">
): Promise<Store> => {
  try {
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
  } catch (error) {
    console.error("Error adding store to IndexedDB:", error);
    throw error;
  }
};

export const updateStore = async (
  id: string,
  updates: Partial<Store>
): Promise<Store> => {
  try {
    const existingStore = await getStore(id);
    if (!existingStore) {
      throw new Error(`Store with id ${id} not found`);
    }

    const updatedStore: Store = {
      ...existingStore,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await db.update("stores", updatedStore);
    return updatedStore;
  } catch (error) {
    console.error("Error updating store in IndexedDB:", error);
    throw error;
  }
};

export const deleteStore = async (id: string): Promise<void> => {
  try {
    await db.remove("stores", id);
  } catch (error) {
    console.error("Error deleting store from IndexedDB:", error);
    throw error;
  }
};

// ===== ACCOUNTS STORAGE (IndexedDB) =====

export const getAccounts = async (): Promise<Account[]> => {
  try {
    return await db.getAll<Account>("accounts");
  } catch (error) {
    console.error("Error loading accounts from IndexedDB:", error);
    return [];
  }
};

export const getAccount = async (id: string): Promise<Account | undefined> => {
  try {
    return await db.get<Account>("accounts", id);
  } catch (error) {
    console.error("Error loading account from IndexedDB:", error);
    return undefined;
  }
};

export const addAccount = async (
  account: Omit<Account, "id" | "createdAt" | "updatedAt">
): Promise<Account> => {
  try {
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
    await db.remove("accounts", id);
  } catch (error) {
    console.error("Error deleting account from IndexedDB:", error);
    throw error;
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
  exchangeRates?: { USD?: any; EUR?: any }
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

    // Omitir atributos de tipo "Product" - estos se calculan por separado con el precio completo
    if (categoryAttribute.valueType === "Product") {
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
  exchangeRates?: { USD?: any; EUR?: any }
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

    // Omitir atributos de tipo "Product" - estos se calculan por separado con el precio completo
    if (categoryAttribute.valueType === "Product") {
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
});

export const getUsers = async (): Promise<User[]> => {
  try {
    // Cargar siempre usuarios locales desde IndexedDB primero (offline-first)
    const localUsers = await db.getAll<User>("users");

    // Si hay conexión, intentar sincronizar con backend y hacer merge
    if (isOnline()) {
      try {
        const backendUsers = await apiClient.getUsers();
        const backendUsersMapped = backendUsers.map(userFromBackendDto);

        // Hacer merge: combinar usuarios del backend con los locales
        // Crear un Map usando el ID como clave para evitar duplicados
        // Los usuarios del backend tienen prioridad sobre los locales
        const usersMap = new Map<string, User>();

        // Primero agregar usuarios locales
        for (const user of localUsers) {
          usersMap.set(user.id, user);
        }

        // Luego agregar/actualizar con usuarios del backend (estos tienen prioridad)
        for (const user of backendUsersMapped) {
          usersMap.set(user.id, user);
          // Guardar/actualizar en IndexedDB
          try {
            await db.update("users", user);
          } catch {
            await db.add("users", user);
          }
        }

        const mergedUsers = Array.from(usersMap.values());
        console.log(
          `✅ Usuarios: ${localUsers.length} locales + ${backendUsersMapped.length} del backend = ${mergedUsers.length} totales`
        );
        return mergedUsers;
      } catch (error) {
        console.warn(
          "⚠️ Error cargando usuarios del backend, usando solo IndexedDB:",
          error
        );
        // Si falla el backend, retornar usuarios locales
        return localUsers;
      }
    }

    // Si está offline, solo retornar usuarios locales
    console.log(
      `✅ Usuarios cargados desde IndexedDB: ${localUsers.length}`
    );
    return localUsers;
  } catch (error) {
    console.error("Error loading users from IndexedDB:", error);
    return [];
  }
};

export const getUser = async (id: string): Promise<User | undefined> => {
  try {
    return await db.get<User>("users", id);
  } catch (error) {
    console.error("Error loading user from IndexedDB:", error);
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

    // Filtrar usuarios con rol de vendedor de tienda (activos)
    // Los roles pueden venir en formato API ("Store Seller") o display ("Vendedor de tienda")
    const vendorUsers = users.filter(
      (user) => user.status === "active" && user.role === "Store Seller"
    );

    // Convertir usuarios a formato Vendor
    const vendors: Vendor[] = vendorUsers.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role === "Store Seller" ? "Vendedor de tienda" : user.role,
      type: "vendor" as const,
    }));

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
    // Los roles pueden venir en formato API ("Online Seller") o display ("Vendedor Online")
    const referrerUsers = users.filter(
      (user) => user.status === "active" && user.role === "Online Seller"
    );

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
      id: crypto.randomUUID(),
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

// ===== COMMISSION CALCULATION FUNCTIONS =====

/**
 * Calcula la comisión de un producto para un vendedor específico
 * Basado en las comisiones configuradas en IndexedDB
 */
export const calculateProductCommission = async (
  product: OrderProduct,
  order: Order,
  sellerId: string | null
): Promise<number> => {
  if (!sellerId) return 0;

  try {
    // Obtener comisiones y usuarios desde IndexedDB
    const [commissions, users] = await Promise.all([
      getCommissions(),
      getUsers(),
    ]);

    // Obtener usuario para determinar su rol
    const user = users.find((u) => u.id === sellerId);
    if (!user) return 0;

    // Buscar comisión por usuario primero, luego por rol
    const commission =
      commissions.find(
        (c) => c.commissionType === "user" && c.userId === sellerId
      ) ||
      commissions.find(
        (c) => c.commissionType === "role" && c.role === user.role
      );

    if (!commission) return 0;

    // Calcular monto base (precio del producto después de descuentos)
    const productTotal = product.total;

    if (commission.commissionKind === "percentage") {
      return productTotal * (commission.value / 100);
    } else {
      // Comisión neta (fija por artículo)
      return commission.value;
    }
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

  const isSharedSale = !!order.referrerId;

  try {
    // Procesar cada producto del pedido
    for (const product of order.products) {
      // Comisión del vendedor principal
      const vendorCommission = await calculateProductCommission(
        product,
        order,
        order.vendorId
      );

      results.push({
        sellerId: order.vendorId,
        sellerName: order.vendorName,
        productId: product.id,
        productName: product.name,
        commission: isSharedSale ? vendorCommission / 2 : vendorCommission,
        isShared: isSharedSale,
      });

      // Si es venta compartida, agregar comisión del referrer
      if (isSharedSale && order.referrerId) {
        const referrerCommission = await calculateProductCommission(
          product,
          order,
          order.referrerId
        );

        results.push({
          sellerId: order.referrerId,
          sellerName: order.referrerName || "",
          productId: product.id,
          productName: product.name,
          commission: referrerCommission / 2,
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
