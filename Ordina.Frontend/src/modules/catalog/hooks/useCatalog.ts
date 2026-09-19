import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../../lib/api-client'

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  priceUsd: number
  priceBs?: number
  stock: number
  isActive: boolean
  description?: string
  dimensions?: string
  color?: string
  material?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
}

export function useProducts(params: {
  pageNumber?: number
  pageSize?: number
  searchTerm?: string
}) {
  const queryParams = new URLSearchParams()
  if (params.pageNumber) queryParams.set('pageNumber', params.pageNumber.toString())
  if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString())
  if (params.searchTerm) queryParams.set('searchTerm', params.searchTerm)

  return useQuery<{
    items: Product[]
    totalCount: number
    page: number
    pageSize: number
  }>({
    queryKey: ['products', params],
    queryFn: () => apiFetch(`products?${queryParams.toString()}`)
  })
}

export function useAllProducts() {
  return useQuery<Product[]>({
    queryKey: ['products', 'all'],
    queryFn: () => apiFetch('products/all'),
    staleTime: 1000 * 60 * 5 // 5 min cache
  })
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => apiFetch('categories'),
    staleTime: 1000 * 60 * 10 // 10 min cache
  })
}
