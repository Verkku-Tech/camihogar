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

// Agregar nuevas constantes de claves
const ORDERS_KEY = "camihogar_orders";
const CLIENTS_KEY = "camihogar_clients";
const PROVIDERS_KEY = "camihogar_providers";
const STORES_KEY = "camihogar_stores";
const USERS_KEY = "camihogar_users";
const VENDORS_KEY = "camihogar_vendors";

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
}

export interface PartialPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
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
  paymentType: "directo" | "apartado";
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
  deliveryAddress?: string;
  hasDelivery: boolean;
  status: "Pendiente" | "Apartado" | "Completado" | "Cancelado";
  createdAt: string;
  updatedAt: string;
  productMarkups?: Record<string, number>;
  createSupplierOrder?: boolean;
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

// ===== CLIENTS STORAGE =====

export const getClients = (): Client[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CLIENTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading clients from localStorage:", error);
  }
  return [];
};

export const saveClients = (clients: Client[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  } catch (error) {
    console.error("Error saving clients to localStorage:", error);
  }
};

export const addClient = (
  client: Omit<Client, "id" | "fechaCreacion" | "tieneNotasDespacho">
): Client => {
  const clients = getClients();
  const newClient: Client = {
    ...client,
    id: Date.now().toString(),
    fechaCreacion: new Date().toISOString().split("T")[0],
    tieneNotasDespacho: false,
  };
  saveClients([...clients, newClient]);
  return newClient;
};

export const updateClient = (id: string, updates: Partial<Client>): void => {
  const clients = getClients();
  const updatedClients = clients.map((client) =>
    client.id === id ? { ...client, ...updates } : client
  );
  saveClients(updatedClients);
};

export const deleteClient = (id: string): void => {
  const clients = getClients();
  saveClients(clients.filter((client) => client.id !== id));
};

// ===== PROVIDERS STORAGE =====

export const getProviders = (): Provider[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PROVIDERS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading providers from localStorage:", error);
  }
  return [];
};

export const saveProviders = (providers: Provider[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
  } catch (error) {
    console.error("Error saving providers to localStorage:", error);
  }
};

export const addProvider = (
  provider: Omit<Provider, "id" | "fechaCreacion">
): Provider => {
  const providers = getProviders();
  const newProvider: Provider = {
    ...provider,
    id: Date.now().toString(),
    fechaCreacion: new Date().toISOString().split("T")[0],
  };
  saveProviders([...providers, newProvider]);
  return newProvider;
};

export const updateProvider = (
  id: string,
  updates: Partial<Provider>
): void => {
  const providers = getProviders();
  const updatedProviders = providers.map((provider) =>
    provider.id === id ? { ...provider, ...updates } : provider
  );
  saveProviders(updatedProviders);
};

export const deleteProvider = (id: string): void => {
  const providers = getProviders();
  saveProviders(providers.filter((provider) => provider.id !== id));
};

// ===== STORES STORAGE =====

export const getStores = (): Store[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORES_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading stores from localStorage:", error);
  }
  return [];
};

export const saveStores = (stores: Store[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORES_KEY, JSON.stringify(stores));
  } catch (error) {
    console.error("Error saving stores to localStorage:", error);
  }
};

export const addStore = (
  store: Omit<Store, "id" | "createdAt" | "updatedAt">
): Store => {
  const stores = getStores();
  const now = new Date().toISOString();
  const newStore: Store = {
    ...store,
    id: Date.now().toString(),
    createdAt: now,
    updatedAt: now,
  };
  saveStores([...stores, newStore]);
  return newStore;
};

export const updateStore = (id: string, updates: Partial<Store>): void => {
  const stores = getStores();
  const updatedStores = stores.map((store) =>
    store.id === id
      ? { ...store, ...updates, updatedAt: new Date().toISOString() }
      : store
  );
  saveStores(updatedStores);
};

export const deleteStore = (id: string): void => {
  const stores = getStores();
  saveStores(stores.filter((store) => store.id !== id));
};

// ===== USERS STORAGE =====

export const getUsers = (): User[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(USERS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading users from localStorage:", error);
  }
  return [];
};

export const saveUsers = (users: User[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error("Error saving users to localStorage:", error);
  }
};

export const addUser = (user: Omit<User, "id" | "createdAt">): User => {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, newUser]);
  return newUser;
};

export const updateUser = (id: string, updates: Partial<User>): void => {
  const users = getUsers();
  const updatedUsers = users.map((user) =>
    user.id === id ? { ...user, ...updates } : user
  );
  saveUsers(updatedUsers);
};

export const deleteUser = (id: string): void => {
  const users = getUsers();
  saveUsers(users.filter((user) => user.id !== id));
};

// ===== VENDORS STORAGE =====

export const getVendors = (): Vendor[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(VENDORS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading vendors from localStorage:", error);
  }
  // Si no hay datos, retornar datos iniciales
  return [
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
};

export const saveVendors = (vendors: Vendor[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VENDORS_KEY, JSON.stringify(vendors));
  } catch (error) {
    console.error("Error saving vendors to localStorage:", error);
  }
};

export const addVendor = (vendor: Omit<Vendor, "id">): Vendor => {
  const vendors = getVendors();
  const newVendor: Vendor = {
    ...vendor,
    id: Date.now().toString(),
  };
  saveVendors([...vendors, newVendor]);
  return newVendor;
};

export const updateVendor = (id: string, updates: Partial<Vendor>): void => {
  const vendors = getVendors();
  const updatedVendors = vendors.map((vendor) =>
    vendor.id === id ? { ...vendor, ...updates } : vendor
  );
  saveVendors(updatedVendors);
};

export const deleteVendor = (id: string): void => {
  const vendors = getVendors();
  saveVendors(vendors.filter((vendor) => vendor.id !== id));
};
