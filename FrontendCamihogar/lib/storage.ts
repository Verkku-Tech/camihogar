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
  }[];
}

const categoryToDB = (category: Category): CategoryDB => ({
  ...category,
  id: category.id.toString(),
});

const categoryFromDB = (categoryDB: CategoryDB): Category => ({
  ...categoryDB,
  id: Number.parseInt(categoryDB.id),
});

// Helper para convertir string ID del backend a number ID del frontend
// Usa un hash simple para generar un ID numérico consistente
const backendIdToNumber = (backendId: string): number => {
  // Si el string ID puede parsearse como número, usarlo directamente
  const parsed = Number.parseInt(backendId);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  // Si no, generar un hash numérico del string
  let hash = 0;
  for (let i = 0; i < backendId.length; i++) {
    const char = backendId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convertir a 32 bits
  }

  // Retornar un número positivo
  return Math.abs(hash) || Date.now();
};

// Helper functions para mapear entre frontend y backend
const categoryToBackendDto = (
  category: Omit<Category, "id">
): CreateCategoryDto => ({
  name: category.name,
  description: category.description,
  maxDiscount: category.maxDiscount,
  maxDiscountCurrency: category.maxDiscountCurrency,
  attributes: category.attributes.map((attr) => ({
    title: attr.title,
    description: attr.description,
    valueType: attr.valueType,
    maxSelections: attr.maxSelections,
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
  })),
});

const categoryFromBackendDto = (dto: CategoryResponseDto): Category => ({
  id: backendIdToNumber(dto.id),
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

        // Hacer merge: combinar categorías del backend con las locales
        // Crear un Map usando el ID como clave para evitar duplicados
        // Las categorías del backend tienen prioridad sobre las locales
        const categoriesMap = new Map<number, Category>();

        // Primero agregar categorías locales
        for (const category of localCategories) {
          categoriesMap.set(category.id, category);
        }

        // Luego agregar/actualizar con categorías del backend (estas tienen prioridad)
        for (const category of backendCategoriesMapped) {
          categoriesMap.set(category.id, category);
          // Guardar/actualizar en IndexedDB
          try {
            await db.update("categories", categoryToDB(category));
          } catch {
            await db.add("categories", categoryToDB(category));
          }
        }

        const mergedCategories = Array.from(categoriesMap.values());
        console.log(
          `✅ Categorías: ${localCategories.length} locales + ${backendCategoriesMapped.length} del backend = ${mergedCategories.length} totales`
        );
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
      await db.update("categories", categoryToDB(updatedLocalCategory));

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
  let newCategory: Category;
  let syncedToBackend = false;

  // Intentar guardar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      const createDto = categoryToBackendDto(category);
      const backendCategory = await apiClient.createCategory(createDto);
      newCategory = categoryFromBackendDto(backendCategory);

      // Guardar también en IndexedDB
      await db.add("categories", categoryToDB(newCategory));
      console.log(
        "✅ Categoría guardada en backend y IndexedDB:",
        newCategory.name
      );
      syncedToBackend = true;
      return newCategory;
    } catch (error) {
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

    await db.add("categories", categoryToDB(newCategory));
    console.log("✅ Categoría guardada en IndexedDB:", newCategory.name);

    // Encolar para sincronización si NO se sincronizó con el backend
    // (puede ser porque está offline O porque falló el backend aunque esté online)
    if (!syncedToBackend) {
      try {
        const createDto = categoryToBackendDto(newCategory);
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

  const updatedCategory: Category = {
    ...existingCategory,
    ...updates,
  };

  // Variable para rastrear si la categoría existe en el backend
  let backendCategoryId: string | null = null;

  // Intentar actualizar en el backend primero si hay conexión
  if (isOnline()) {
    try {
      // Buscar la categoría en el backend por nombre para obtener su ObjectId
      try {
        const backendCategory = await apiClient.getCategoryByName(
          existingCategory.name
        );
        if (backendCategory) {
          backendCategoryId = backendCategory.id;
        }
      } catch (error) {
        // La categoría no existe en el backend todavía
        console.warn(
          "⚠️ Categoría no encontrada en backend por nombre, actualizando solo localmente"
        );
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
              ? updatedCategory.attributes.map((attr) => ({
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
                }))
              : undefined,
        };

        const backendCategory = await apiClient.updateCategory(
          backendCategoryId,
          updateDto
        );
        const syncedCategory = categoryFromBackendDto(backendCategory);

        // Actualizar también en IndexedDB con los datos del backend
        await db.update("categories", categoryToDB(syncedCategory));
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
    } catch (error) {
      console.warn(
        "⚠️ Error actualizando categoría en backend, guardando localmente:",
        error
      );
      // Continuar para guardar localmente
    }
  }

  // Guardar en IndexedDB
  try {
    await db.update("categories", categoryToDB(updatedCategory));

    // Encolar para sincronización si la categoría no está en el backend o estamos offline
    const shouldEnqueue = !isOnline() || !backendCategoryId;
    if (shouldEnqueue) {
      try {
        const updateDto: UpdateCategoryDto = {
          name: updatedCategory.name,
          description: updatedCategory.description,
          maxDiscount: updatedCategory.maxDiscount,
          maxDiscountCurrency: updatedCategory.maxDiscountCurrency,
          attributes: updatedCategory.attributes.map((attr) => ({
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
          })),
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
}

export interface PartialPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
  currency?: Currency; // Moneda del pago
  paymentDetails?: {
    // Pago Móvil
    pagomovilReference?: string;
    pagomovilBank?: string;
    pagomovilPhone?: string;
    // Transferencia
    transferenciaBank?: string;
    transferenciaReference?: string;
    // Efectivo
    cashAmount?: string;
    cashCurrency?: "Bs" | "USD" | "EUR"; // Moneda del pago en efectivo
    cashReceived?: number; // Monto recibido del cliente
    exchangeRate?: number; // Tasa de cambio usada al momento del pago
    // Para Pago Móvil y Transferencia
    originalAmount?: number; // Monto original en la moneda del pago
    originalCurrency?: "Bs" | "USD" | "EUR"; // Moneda original del pago
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
  saleType?: "delivery_express" | "encargo" | "encargo_entrega" | "entrega" | "retiro_almacen" | "retiro_tienda" | "sa";
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
  };
  partialPayments?: PartialPayment[]; // Ahora usa la interfaz exportada
  mixedPayments?: PartialPayment[]; // Para pagos mixtos
  deliveryAddress?: string;
  hasDelivery: boolean;
  status: "Pendiente" | "Apartado" | "Completado" | "Cancelado";
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
}

export interface Client {
  id: string;
  nombreRazonSocial: string;
  rutId: string;
  direccion: string;
  telefono: string;
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

export const getOrders = async (): Promise<Order[]> => {
  try {
    return await db.getAll<Order>("orders");
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
  try {
    // Obtener el número de pedidos para generar el siguiente número
    const orders = await getOrders();
    const orderNumber = `ORD-${String(orders.length + 1).padStart(3, "0")}`;

    const newOrder: Order = {
      ...order,
      id: Date.now().toString(),
      orderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.add("orders", newOrder);
    console.log("✅ Pedido guardado en IndexedDB:", newOrder.orderNumber);
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

    await db.update("orders", updatedOrder);
    return updatedOrder;
  } catch (error) {
    console.error("Error updating order in IndexedDB:", error);
    throw error;
  }
};

export const deleteOrder = async (id: string): Promise<void> => {
  try {
    await db.remove("orders", id);
  } catch (error) {
    console.error("Error deleting order from IndexedDB:", error);
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
