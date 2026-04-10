"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Search, Phone, Mail, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { getClients, clientFromBackendDto, type Client } from "@/lib/storage"
import { apiClient, type ClientResponseDto } from "@/lib/api-client"
import { CreateClientDialog } from "@/components/clients/create-client-dialog"
import { toast } from "sonner"

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

function filterActiveClients(clients: Client[]): Client[] {
  return clients.filter((c) => c.estado === "activo")
}

function filterClientsLocal(clients: Client[], q: string): Client[] {
  const term = q.trim().toLowerCase()
  if (!term) return clients
  return clients.filter(
    (client) =>
      client.nombreRazonSocial.toLowerCase().includes(term) ||
      (client.apodo && client.apodo.toLowerCase().includes(term)) ||
      (client.email && client.email.toLowerCase().includes(term)) ||
      (client.telefono && client.telefono.includes(q.trim())) ||
      (client.telefono2 && client.telefono2.includes(q.trim())) ||
      client.rutId.toLowerCase().includes(term),
  )
}

export function ClientLookupDialog({ open, onOpenChange, onClientSelect }: ClientLookupDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [offlineMode, setOfflineMode] = useState(false)

  useEffect(() => {
    if (open) {
      setPage(1)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    loadClients()
  }, [open, page, pageSize])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      if (page === 1) {
        loadClients()
      } else {
        setPage(1)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, open])

  useEffect(() => {
    if (typeof window === "undefined") return
    const syncOnline = () => setOfflineMode(!navigator.onLine)
    syncOnline()
    window.addEventListener("online", syncOnline)
    window.addEventListener("offline", syncOnline)
    return () => {
      window.removeEventListener("online", syncOnline)
      window.removeEventListener("offline", syncOnline)
    }
  }, [])

  const loadClients = async () => {
    if (!open) return
    try {
      setIsLoading(true)
      const online = typeof navigator !== "undefined" && navigator.onLine

      if (!online) {
        setOfflineMode(true)
        const loaded = await getClients()
        const active = filterActiveClients(loaded)
        const filtered = filterClientsLocal(active, searchTerm)
        const total = filtered.length
        const pages = Math.max(1, Math.ceil(total / pageSize) || 1)
        const safePage = Math.min(page, pages)
        if (safePage !== page) {
          setPage(safePage)
          setIsLoading(false)
          return
        }
        const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
        setClients(slice)
        setTotalPages(pages)
        setTotalCount(total)
        return
      }

      setOfflineMode(false)
      const search = searchTerm.trim() !== "" ? searchTerm : undefined
      const result = await apiClient.getClientsPaged(page, pageSize, search)
      const mapped = (result.items || []).map(clientFromBackendDto)
      const activeOnly = filterActiveClients(mapped)
      setClients(activeOnly)
      setTotalPages(result.totalPages)
      setTotalCount(result.totalCount)
    } catch (error) {
      console.error("Error loading clients:", error)
      toast.error("Error al cargar clientes. Verifique su conexión.")
    } finally {
      setIsLoading(false)
    }
  }

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
    void loadClients()
    handleClientSelect(clientFromBackendDto(newClientDto))
  }

  const displayClients = clients
  const emptyMessage = searchTerm.trim()
    ? "No se encontraron clientes"
    : "No hay clientes activos"

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
            {offlineMode && (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                Sin conexión: se muestra la lista en caché local con búsqueda en este equipo.
              </p>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre, apodo o RUT..."
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

            {totalCount > 0 && !offlineMode && (
              <p className="text-sm text-muted-foreground">Total (coincidencias): {totalCount}</p>
            )}
            {offlineMode && totalCount > 0 && (
              <p className="text-sm text-muted-foreground">En caché: {totalCount} activo(s) coincidente(s)</p>
            )}

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando clientes...</div>
            ) : displayClients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
            ) : (
              <>
                <div className="space-y-2 sm:hidden">
                  {displayClients.map((client) => (
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
                      {displayClients.map((client) => (
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
                            <Button size="sm" onClick={() => handleClientSelect(client)}>
                              Seleccionar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between px-2 pt-2">
                  <div className="text-sm text-muted-foreground">
                    Página {page} de {totalPages || 1}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || totalPages === 0 || isLoading}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateClientDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onClientCreated={handleClientCreated}
      />
    </>
  )
}
