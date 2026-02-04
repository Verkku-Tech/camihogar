"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Eye } from "lucide-react"

export interface OrderGroupCollapsibleProps {
  orderId: string
  orderNumber: string
  clientName: string
  orderDate: string
  productCount: number
  isExpanded: boolean
  onOpenChange: (open: boolean) => void
  /** Contenido a la derecha de la fila del pedido (ej: Total, Estado, Fecha, botones Ver/Despachar) */
  headerRight?: React.ReactNode
  /** Checkbox para seleccionar el pedido completo (ej: despacho masivo). Si no se pasa, no se muestra. */
  selectControl?: {
    checked: boolean | "indeterminate"
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    "aria-label"?: string
  }
  /** Contenido expandido (ej: tabla de productos del pedido) */
  children: React.ReactNode
  /** Si es true, se muestra el botón "Ver Detalles" y se llama onViewDetails al hacer clic. */
  showViewDetailsButton?: boolean
  /** Callback al hacer clic en Ver Detalles (ej: () => router.push(\`/pedidos/${orderNumber}\`)). */
  onViewDetails?: () => void
}

/**
 * Componente reutilizable para mostrar un pedido como fila expandible (agrupación por orden).
 * Usado en Fabricación y Despachos con el mismo aspecto: fila con #pedido, cliente, cantidad, y contenido expandible.
 */
export function OrderGroupCollapsible({
  orderId,
  orderNumber,
  clientName,
  orderDate,
  productCount,
  isExpanded,
  onOpenChange,
  headerRight,
  selectControl,
  children,
  showViewDetailsButton = true,
  onViewDetails,
}: OrderGroupCollapsibleProps) {
  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onViewDetails?.()
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onOpenChange}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <Table>
            <TableBody>
              <TableRow className="hover:bg-muted/50 cursor-pointer border-b">
                <TableCell className="font-medium" style={{ width: "180px" }}>
                  <div className="flex items-center gap-2">
                    {selectControl && (
                      <Checkbox
                        checked={selectControl.checked}
                        onCheckedChange={(checked) =>
                          selectControl.onCheckedChange(checked === true)
                        }
                        onClick={(e) => e.stopPropagation()}
                        disabled={selectControl.disabled}
                        aria-label={selectControl["aria-label"]}
                        className="mr-2"
                      />
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold">#{orderNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(orderDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{clientName}</div>
                  <div className="text-xs text-muted-foreground">
                    {productCount} producto{productCount !== 1 ? "s" : ""}
                  </div>
                </TableCell>
                <TableCell colSpan={6}>
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    {showViewDetailsButton && onViewDetails && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleViewClick}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ver Detalles
                      </Button>
                    )}
                    {headerRight}
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </div>
    </Collapsible>
  )
}
