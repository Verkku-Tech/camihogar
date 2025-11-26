// Wrapper genérico para IndexedDB
const DB_NAME = "camihogar_db";
const DB_VERSION = 4; // Incrementar para agregar exchange_rates

interface StoreConfig {
  name: string;
  keyPath: string;
  indexes?: Array<{ name: string; keyPath: string; unique?: boolean }>;
}

// Configuración de stores (tablas)
const STORES: StoreConfig[] = [
  {
    name: "orders",
    keyPath: "id",
    indexes: [
      { name: "orderNumber", keyPath: "orderNumber", unique: true },
      { name: "clientId", keyPath: "clientId" },
      { name: "createdAt", keyPath: "createdAt" },
      { name: "status", keyPath: "status" },
    ],
  },
  {
    name: "categories",
    keyPath: "id",
    indexes: [{ name: "name", keyPath: "name", unique: true }],
  },
  {
    name: "products",
    keyPath: "id",
    indexes: [
      { name: "sku", keyPath: "sku", unique: true },
      { name: "category", keyPath: "category" },
      { name: "status", keyPath: "status" },
    ],
  },
  {
    name: "clients",
    keyPath: "id",
    indexes: [
      { name: "rutId", keyPath: "rutId", unique: true },
      { name: "nombreRazonSocial", keyPath: "nombreRazonSocial" },
    ],
  },
  {
    name: "providers",
    keyPath: "id",
    indexes: [{ name: "rif", keyPath: "rif", unique: true }],
  },
  {
    name: "stores",
    keyPath: "id",
    indexes: [{ name: "code", keyPath: "code", unique: true }],
  },
  {
    name: "users",
    keyPath: "id",
    indexes: [{ name: "username", keyPath: "username", unique: true }],
  },
  {
    name: "vendors",
    keyPath: "id",
  },
  {
    name: "sync_queue",
    keyPath: "id",
    indexes: [
      { name: "status", keyPath: "status" },
      { name: "entity", keyPath: "entity" },
      { name: "timestamp", keyPath: "timestamp" },
    ],
  },
  {
    name: "exchange_rates",
    keyPath: "id",
    indexes: [
      { name: "toCurrency", keyPath: "toCurrency" },
      { name: "effectiveDate", keyPath: "effectiveDate" },
      { name: "isActive", keyPath: "isActive" },
    ],
  },
];

// Inicializar la base de datos
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Error opening database: ${request.error}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion || 0;

      // Crear stores si no existen o actualizar índices
      STORES.forEach((storeConfig) => {
        if (!db.objectStoreNames.contains(storeConfig.name)) {
          const objectStore = db.createObjectStore(storeConfig.name, {
            keyPath: storeConfig.keyPath,
          });

          // Crear índices
          storeConfig.indexes?.forEach((index) => {
            objectStore.createIndex(index.name, index.keyPath, {
              unique: index.unique || false,
            });
          });
        } else if (oldVersion < 4 && storeConfig.name === "exchange_rates") {
          // Agregar índices al store existente si se está actualizando
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const objectStore = transaction.objectStore(storeConfig.name);
            storeConfig.indexes?.forEach((index) => {
              if (!objectStore.indexNames.contains(index.name)) {
                objectStore.createIndex(index.name, index.keyPath, {
                  unique: index.unique || false,
                });
              }
            });
          }
        }
      });
    };
  });
};

// Función genérica para obtener la base de datos
const getDB = async (): Promise<IDBDatabase> => {
  try {
    const db = await initDB();
    return db;
  } catch (error) {
    console.error("Error getting database:", error);
    throw error;
  }
};

// ===== OPERACIONES GENÉRICAS =====

// Crear/Agregar un registro
export const add = async <T extends { id: string }>(
  storeName: string,
  item: T
): Promise<T> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.add(item);

    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
};

// Obtener un registro por ID
export const get = async <T>(
  storeName: string,
  id: string
): Promise<T | undefined> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Obtener todos los registros
export const getAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// Actualizar un registro
export const update = async <T extends { id: string }>(
  storeName: string,
  item: T
): Promise<T> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.put(item);

    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
};

// Eliminar un registro
export const remove = async (storeName: string, id: string): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Buscar por índice
export const getByIndex = async <T>(
  storeName: string,
  indexName: string,
  value: any
): Promise<T[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);
    const index = objectStore.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// Contar registros
export const count = async (storeName: string): Promise<number> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const objectStore = transaction.objectStore(storeName);
    const request = objectStore.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
