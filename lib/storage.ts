import * as db from "./indexeddb";

export interface AttributeValue {
  id: string;
  label: string;
  isDefault?: boolean;
  priceAdjustment?: number; // positive for increase, negative for decrease
}

export interface Category {
  id: number;
  name: string;
  description: string;
  products: number;
  maxDiscount: number;
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

export const getCategories = async (): Promise<Category[]> => {
  try {
    const categoriesDB = await db.getAll<CategoryDB>("categories");
    return categoriesDB.map(categoryFromDB);
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

export const addCategory = async (
  category: Omit<Category, "id">
): Promise<Category> => {
  try {
    const categories = await getCategories();
    const newId = Math.max(...categories.map((c) => c.id), 0) + 1;
    const newCategory: Category = { ...category, id: newId };

    await db.add("categories", categoryToDB(newCategory));
    console.log("✅ Categoría guardada en IndexedDB:", newCategory.name);
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
  try {
    const existingCategory = await getCategory(id);
    if (!existingCategory) {
      throw new Error(`Category with id ${id} not found`);
    }

    const updatedCategory: Category = {
      ...existingCategory,
      ...updates,
    };

    await db.update("categories", categoryToDB(updatedCategory));
    return updatedCategory;
  } catch (error) {
    console.error("Error updating category in IndexedDB:", error);
    throw error;
  }
};

export const deleteCategory = async (id: number): Promise<void> => {
  try {
    await db.remove("categories", id.toString());
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

export const getProducts = async (): Promise<Product[]> => {
  try {
    const productsDB = await db.getAll<ProductDB>("products");
    return productsDB.map(productFromDB);
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
  try {
    const products = await getProducts();
    const newId = Math.max(...products.map((p) => p.id), 0) + 1;
    const newProduct: Product = { ...product, id: newId };

    await db.add("products", productToDB(newProduct));
    console.log("✅ Producto guardado en IndexedDB:", newProduct.name);
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
  try {
    const existingProduct = await getProduct(id);
    if (!existingProduct) {
      throw new Error(`Product with id ${id} not found`);
    }

    const updatedProduct: Product = {
      ...existingProduct,
      ...updates,
    };

    await db.update("products", productToDB(updatedProduct));
    return updatedProduct;
  } catch (error) {
    console.error("Error updating product in IndexedDB:", error);
    throw error;
  }
};

export const deleteProduct = async (id: number): Promise<void> => {
  try {
    await db.remove("products", id.toString());
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
  attributes?: Record<string, string | number>;
  discount?: number; // Descuento aplicado al producto (monto)
  observations?: string; // Observaciones específicas del producto
}

export interface PartialPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
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
  saleType?: "apartado" | "entrega" | "contado"; // Nuevo campo
  paymentMode?: "simple" | "mixto"; // Nuevo campo
  paymentMethod: string;
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
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString().split("T")[0],
      tieneNotasDespacho: false,
    };

    await db.add("clients", newClient);
    console.log("✅ Cliente guardado en IndexedDB:", newClient.nombreRazonSocial);
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

export const getProvider = async (id: string): Promise<Provider | undefined> => {
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
 * @param basePrice - Precio base del producto
 * @param quantity - Cantidad del producto
 * @param productAttributes - Atributos seleccionados del producto (ej: { "attrId": "valueId" })
 * @param category - Categoría del producto que contiene la definición de atributos
 * @returns Precio total calculado (precio base + ajustes de atributos) * cantidad
 */
export const calculateProductTotalWithAttributes = (
  basePrice: number,
  quantity: number,
  productAttributes: Record<string, string | number> | undefined,
  category: Category | undefined
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

    // Buscar el valor seleccionado en los valores del atributo
    const selectedValueStr = selectedValue.toString();
    const attributeValue = categoryAttribute.values.find((val) => {
      if (typeof val === "string") {
        return val === selectedValueStr;
      }
      // Si es AttributeValue, comparar por id o label
      return val.id === selectedValueStr || val.label === selectedValueStr;
    });

    // Si encontramos el valor y tiene un ajuste de precio, sumarlo
    if (attributeValue && typeof attributeValue === "object" && "priceAdjustment" in attributeValue) {
      const adjustment = attributeValue.priceAdjustment || 0;
      totalAdjustment += adjustment;
    }
  });

  // Calcular: (precio base + ajustes totales) * cantidad
  const pricePerUnit = basePrice + totalAdjustment;
  return pricePerUnit * quantity;
};

/**
 * Calcula el precio unitario de un producto considerando los ajustes de precio de los atributos
 * @param basePrice - Precio base del producto
 * @param productAttributes - Atributos seleccionados del producto
 * @param category - Categoría del producto que contiene la definición de atributos
 * @returns Precio unitario calculado (precio base + ajustes de atributos)
 */
export const calculateProductUnitPriceWithAttributes = (
  basePrice: number,
  productAttributes: Record<string, string | number> | undefined,
  category: Category | undefined
): number => {
  if (!productAttributes || !category || !category.attributes) {
    return basePrice;
  }

  let totalAdjustment = 0;

  Object.entries(productAttributes).forEach(([attrKey, selectedValue]) => {
    const categoryAttribute = category.attributes.find(
      (attr) => attr.id.toString() === attrKey || attr.title === attrKey
    );

    if (!categoryAttribute || !categoryAttribute.values) {
      return;
    }

    const selectedValueStr = selectedValue.toString();
    const attributeValue = categoryAttribute.values.find((val) => {
      if (typeof val === "string") {
        return val === selectedValueStr;
      }
      return val.id === selectedValueStr || val.label === selectedValueStr;
    });

    if (attributeValue && typeof attributeValue === "object" && "priceAdjustment" in attributeValue) {
      const adjustment = attributeValue.priceAdjustment || 0;
      totalAdjustment += adjustment;
    }
  });

  return basePrice + totalAdjustment;
};

// ===== USERS STORAGE (IndexedDB) =====

export const getUsers = async (): Promise<User[]> => {
  try {
    return await db.getAll<User>("users");
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

const DEFAULT_VENDORS: Vendor[] = [
  { id: "1", name: "Juan Pérez", role: "Vendedor de tienda", type: "vendor" },
  { id: "2", name: "Ana López", role: "Vendedor de tienda", type: "vendor" },
  {
    id: "3",
    name: "Carlos Silva",
    role: "Vendedor de tienda",
    type: "vendor",
  },
  {
    id: "4",
    name: "María González",
    role: "Vendedor Online",
    type: "referrer",
  },
  {
    id: "5",
    name: "Pedro Martínez",
    role: "Vendedor Online",
    type: "referrer",
  },
  {
    id: "6",
    name: "Laura Rodríguez",
    role: "Vendedor Online",
    type: "referrer",
  },
];

export const getVendors = async (): Promise<Vendor[]> => {
  try {
    const vendors = await db.getAll<Vendor>("vendors");
    // Si no hay datos, inicializar con datos por defecto
    if (vendors.length === 0) {
      // Inicializar con datos por defecto
      for (const vendor of DEFAULT_VENDORS) {
        try {
          await db.add("vendors", vendor);
        } catch (error) {
          // Ignorar errores de duplicados si ya existen
          console.warn("Vendor already exists:", vendor.id);
        }
      }
      return DEFAULT_VENDORS;
    }
    return vendors;
  } catch (error) {
    console.error("Error loading vendors from IndexedDB:", error);
    return DEFAULT_VENDORS;
  }
};

export const getVendor = async (id: string): Promise<Vendor | undefined> => {
  try {
    return await db.get<Vendor>("vendors", id);
  } catch (error) {
    console.error("Error loading vendor from IndexedDB:", error);
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
