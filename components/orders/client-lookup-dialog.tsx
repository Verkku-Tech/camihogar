"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search } from "lucide-react"

interface ClientLookupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientSelect: (client: { id: string; name: string }) => void
}

// Mock clients data
const mockClients = [
  { id: "1", name: "María González", email: "maria@email.com", phone: "0414-1234567" },
  { id: "2", name: "Carlos Rodríguez", email: "carlos@email.com", phone: "0424-2345678" },
  { id: "3", name: "Laura Martínez", email: "laura@email.com", phone: "0412-3456789" },
  { id: "4", name: "Pedro Silva", email: "pedro@email.com", phone: "0416-4567890" },
  { id: "5", name: "Ana López", email: "ana@email.com", phone: "0426-5678901" },
]

export function ClientLookupDialog({ open, onOpenChange, onClientSelect }: ClientLookupDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredClients = mockClients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm),
  )

  const handleClientSelect = (client: { id: string; name: string }) => {
    onClientSelect(client)
    onOpenChange(false)
    setSearchTerm("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Seleccionar Cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar cliente por nombre, email o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => handleClientSelect({ id: client.id, name: client.name })}>
                      Seleccionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredClients.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No se encontraron clientes</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
