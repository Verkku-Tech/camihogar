import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getUsers,
  getStores,
  getAccounts,
  getProviders,
  type User,
  type Store,
  type Account,
  type Provider,
} from "@/lib/storage"

// ponytail: default 5 minute stale cache for active catalogs, avoiding repeated API requests
const CATALOG_STALE_TIME = 1000 * 60 * 5

export function useActiveVendors() {
  const query = useQuery<User[]>({
    queryKey: ["catalogs", "vendors", "active"],
    queryFn: async () => {
      const all = await getUsers("active")
      return all.filter(
        (u) =>
          (u.status === "active" || !u.status) &&
          (u.role === "Store Seller" ||
            u.role === "Online Seller" ||
            (u.role as string) === "Vendedor de tienda" ||
            (u.role as string) === "Vendedor Online"),
      )
    },
    staleTime: CATALOG_STALE_TIME,
  })

  const vendorNames = useMemo(() => {
    const list = query.data ?? []
    const names = new Set(list.map((v) => v.name?.trim()).filter(Boolean))
    return Array.from(names).sort()
  }, [query.data])

  return {
    ...query,
    sellers: query.data ?? [],
    vendorNames,
  }
}

export function useActiveStores() {
  const query = useQuery<Store[]>({
    queryKey: ["catalogs", "stores", "active"],
    queryFn: async () => {
      const stores = await getStores("active")
      return stores.filter((s) => s.status === "active")
    },
    staleTime: CATALOG_STALE_TIME,
  })

  return {
    ...query,
    stores: query.data ?? [],
  }
}

export function useActiveAccounts() {
  const query = useQuery<Account[]>({
    queryKey: ["catalogs", "accounts", "active"],
    queryFn: async () => {
      const accounts = await getAccounts(undefined, true)
      return accounts.filter((a) => a.isActive !== false && Boolean(a.id?.trim()))
    },
    staleTime: CATALOG_STALE_TIME,
  })

  return {
    ...query,
    accounts: query.data ?? [],
  }
}

export function useActiveProviders(mode: "all" | "manufacturing" = "all") {
  const query = useQuery<Provider[]>({
    queryKey: ["catalogs", "providers", "active", mode],
    queryFn: async () => {
      const all = await getProviders()
      return all.filter((p) => {
        if (p.estado !== "activo") return false
        if (mode === "manufacturing") {
          return p.tipo === "servicios" || p.tipo === "productos-terminados"
        }
        return true
      })
    },
    staleTime: CATALOG_STALE_TIME,
  })

  const providerNames = useMemo(() => {
    const list = query.data ?? []
    const names = new Set(list.map((p) => p.razonSocial?.trim()).filter(Boolean))
    return Array.from(names).sort()
  }, [query.data])

  return {
    ...query,
    providers: query.data ?? [],
    providerNames,
  }
}
