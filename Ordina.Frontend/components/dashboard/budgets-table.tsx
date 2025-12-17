"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getBudgets, Budget } from "@/lib/storage"
import { formatCurrency } from "@/lib/currency-utils"
import { FileText, Calendar, Clock } from "lucide-react"

function getStatusColor(status: string) {
  switch (status) {
    case "Presupuesto":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300"
    case "Aprobado":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "Rechazado":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    case "Vencido":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    case "Convertido":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

export function BudgetsTable() {
  const router = useRouter()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadBudgets = async () => {
      try {
        const allBudgets = await getBudgets()
        // Ordenar por fecha de creación (más recientes primero) y limitar
        const sortedBudgets = allBudgets
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
        setBudgets(sortedBudgets)
      } catch (error) {
        console.error("Error loading budgets:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadBudgets()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">Presupuesto</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Total</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Fecha Creación</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Válido Hasta</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((index) => (
                  <TableRow key={index}>
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                    <TableCell className="h-12 animate-pulse bg-muted" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (budgets.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No hay presupuestos disponibles</p>
            <p className="text-sm text-muted-foreground">
              Los presupuestos creados aparecerán aquí
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium text-muted-foreground">Presupuesto</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-muted-foreground">Total</TableHead>
                <TableHead className="font-medium text-muted-foreground">Fecha Creación</TableHead>
                <TableHead className="font-medium text-muted-foreground">Válido Hasta</TableHead>
                <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((budget) => {
                const expired = isExpired(budget.expiresAt)
                const status = expired && budget.status === "Presupuesto" ? "Vencido" : budget.status
                
                return (
                  <TableRow 
                    key={budget.id} 
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/presupuestos/${budget.budgetNumber}`)}
                  >
                    <TableCell className="font-medium text-green-600">{budget.budgetNumber}</TableCell>
                    <TableCell className="font-medium">{budget.clientName}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(budget.total, budget.baseCurrency || "Bs")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(budget.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className={`flex items-center gap-1 ${expired ? "text-red-600" : ""}`}>
                        <Clock className="w-3 h-3" />
                        {formatDate(budget.expiresAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(status)}>
                        {status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

