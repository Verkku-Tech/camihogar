"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { type OrderProduct } from "@/lib/storage"

interface RemoveProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: OrderProduct | null
  onConfirm: () => void
}

export function RemoveProductDialog({ open, onOpenChange, product, onConfirm }: RemoveProductDialogProps) {
  if (!product) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar "{product.name}" del pedido?
            <br />
            <span className="text-sm text-muted-foreground mt-2 block">
              Cantidad: {product.quantity} unidades - Total: ${product.total.toFixed(2)}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
