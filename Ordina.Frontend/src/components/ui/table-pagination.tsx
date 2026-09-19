"use client"

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  startIndex: number
  endIndex: number
  onPageChange: (page: number) => void
  itemsPerPage?: number
  onItemsPerPageChange?: (items: number) => void
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  itemsPerPage = 10,
  onItemsPerPageChange,
}: TablePaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      // Mostrar todas las páginas si son pocas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Lógica para mostrar páginas con ellipsis
      if (currentPage <= 3) {
        // Al inicio
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        // Al final
        pages.push(1)
        pages.push('ellipsis')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // En el medio
        pages.push(1)
        pages.push('ellipsis')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (totalPages <= 1 && totalItems <= itemsPerPage) {
    return (
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {startIndex}-{endIndex} de {totalItems}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Mostrando {startIndex}-{endIndex} de {totalItems}
        </span>
        {onItemsPerPageChange && (
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => onItemsPerPageChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="default"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="gap-1 px-2.5 sm:pl-2.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:block">Anterior</span>
            </Button>
          </PaginationItem>

          {getPageNumbers().map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              )
            }

            return (
              <PaginationItem key={page}>
                <Button
                  variant={currentPage === page ? "outline" : "ghost"}
                  size="icon"
                  onClick={() => onPageChange(page)}
                  className={currentPage === page ? "font-semibold" : ""}
                >
                  {page}
                </Button>
              </PaginationItem>
            )
          })}

          <PaginationItem>
            <Button
              variant="ghost"
              size="default"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="gap-1 px-2.5 sm:pr-2.5"
            >
              <span className="hidden sm:block">Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

