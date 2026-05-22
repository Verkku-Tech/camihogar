"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PinGeneratorCard } from "@/components/pin/pin-generator-card";

interface PinGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PinGeneratorDialog({ open, onOpenChange }: PinGeneratorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PIN de acceso</DialogTitle>
          <DialogDescription>
            Genera un código para que el vendedor pueda editar productos al
            confirmar una reserva.
          </DialogDescription>
        </DialogHeader>
        <PinGeneratorCard />
      </DialogContent>
    </Dialog>
  );
}
