"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Search, Phone, Mail, Plus } from "lucide-react"
import { getClients, type Client } from "@/lib/storage"
import { type ClientResponseDto } from "@/lib/api-client"
import { CreateClientDialog } from "@/components/clients/create-client-dialog"

interface ClientLookupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientSelect: (client: {
    id: string
    name: string
    address?: string
    telefono?: string
    telefono2?: string
    email?: string
    rutId?: string
  }) => void
}

export function ClientLookupDialog({ open, onOpenChange, onClientSelect }: ClientLookupDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

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

  useEffect(() => {
    if (open) {
      loadClients()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const filteredClients = clients.filter(
    (client) =>
      client.nombreRazonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.apodo && client.apodo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      client.telefono.includes(searchTerm) ||
      (client.telefono2 && client.telefono2.includes(searchTerm)) ||
      client.rutId.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleClientSelect = (client: Client) => {
    onClientSelect({
      id: client.id,
      name: client.nombreRazonSocial,
      address: client.direccion || undefined,
      telefono: client.telefono,
      telefono2: client.telefono2,
      email: client.email,
      rutId: client.rutId,
    })
    onOpenChange(false)
    setSearchTerm("")
  }

  const handleClientCreated = (newClientDto: ClientResponseDto) => {
    // Recargar la lista de clientes
    loadClients()

    const newClient: Client = {
      ...newClientDto,
      tipoCliente: (newClientDto.tipoCliente?.toLowerCase() as Client["tipoCliente"]) || "particular",
      estado: (newClientDto.estado?.toLowerCase() as Client["estado"]) || "activo"
    }

    // Seleccionar automáticamente el cliente recién creado
    handleClientSelect(newClient)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none sm:w-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto p-3 sm:p-4 md:p-6 rounded-none sm:rounded-lg m-0 sm:m-4">
          <DialogHeader className="pb-2 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl">Seleccionar Cliente</DialogTitle>
            <DialogDescription>
              Busca y selecciona un cliente existente o crea uno nuevo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar cliente por nombre, apodo, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
                title="Crear nuevo cliente"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Nuevo</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando clientes...</div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No se encontraron clientes" : "No hay clientes activos"}
              </div>
            ) : (
              <>
                {/* Vista de tarjetas para móvil */}
                <div className="space-y-2 sm:hidden">
                  {filteredClients.map((client) => (
                    <Card
                      key={client.id}
                      className="p-4 cursor-pointer hover:bg-muted/50 active:bg-muted/70 transition-colors"
                      onClick={() => handleClientSelect(client)}
                    >
                      <div className="space-y-2">
                        <div className="font-medium text-base">{client.nombreRazonSocial}</div>
                        {client.apodo && (
                          <div className="text-xs text-muted-foreground">Apodo: {client.apodo}</div>
                        )}
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {client.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span className="break-all">{client.email}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{client.telefono}</span>
                          </div>
                          {client.telefono2 && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span>{client.telefono2}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Vista de tabla para desktop */}
                <div className="hidden sm:block overflow-x-auto">
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
                        <TableRow key={client.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div>
                              <div>{client.nombreRazonSocial}</div>
                              {client.apodo && (
                                <div className="text-xs text-muted-foreground">Apodo: {client.apodo}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="break-words max-w-[200px]">
                            {client.email || "-"}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div>{client.telefono}</div>
                              {client.telefono2 && (
                                <div className="text-sm text-muted-foreground">{client.telefono2}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleClientSelect(client)}
                            >
                              Seleccionar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para crear cliente */}
      <CreateClientDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onClientCreated={handleClientCreated}
      />
    </>
  )
}
