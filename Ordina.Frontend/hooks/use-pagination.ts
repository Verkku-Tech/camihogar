import { useState, useMemo, useEffect } from 'react'

interface UsePaginationProps<T> {
  data: T[]
  itemsPerPage?: number
}

export function usePagination<T>({ 
  data, 
  itemsPerPage = 10 
}: UsePaginationProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(data.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage

  const paginatedData = useMemo(() => {
    return data.slice(startIndex, endIndex)
  }, [data, startIndex, endIndex])

  // Resetear a página 1 cuando cambian los datos (filtros, búsqueda, etc.)
  useEffect(() => {
    setCurrentPage(1)
  }, [data.length])

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  return {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    nextPage,
    previousPage,
    startIndex: startIndex + 1, // Para mostrar (1-10 de 50)
    endIndex: Math.min(endIndex, data.length),
    totalItems: data.length,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  }
}

