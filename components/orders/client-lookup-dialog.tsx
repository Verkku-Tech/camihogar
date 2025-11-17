"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search } from "lucide-react"
import { getClients, type Client } from "@/lib/storage"

interface ClientLookupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientSelect: (client: { id: string; name: string; address?: string }) => void
}

export function ClientLookupDialog({ open, onOpenChange, onClientSelect }: ClientLookupDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadClients = async () => {
      try {
        setIsLoading(true)
        const loadedClients = await getClients()
        // Filtrar solo clientes activos
        setClients(loadedClients.filter((client) => client.estado === "activo"))
      } catch (error) {
        console.error("Error loading clients:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (open) {
      loadClients()
    }
  }, [open])

  const filteredClients = clients.filter(
    (client) =>
      client.nombreRazonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      client.telefono.includes(searchTerm) ||
      client.rutId.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleClientSelect = (client: Client) => {
    onClientSelect({
      id: client.id,
      name: client.nombreRazonSocial,
      address: client.direccion || undefined,
    })
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

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando clientes...</div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No se encontraron clientes" : "No hay clientes activos"}
            </div>
          ) : (
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
                    <TableCell className="font-medium">{client.nombreRazonSocial}</TableCell>
                    <TableCell>{client.email || "-"}</TableCell>
                    <TableCell>{client.telefono}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleClientSelect(client)}>
                        Seleccionar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
