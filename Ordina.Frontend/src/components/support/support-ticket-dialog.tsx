import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'

interface SupportTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SupportTicketDialog({ open, onOpenChange }: SupportTicketDialogProps) {
  const { user } = useAuth()
  const [category, setCategory] = useState('system_error')
  const [priority, setPriority] = useState('medium')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subject.trim()) {
      toast.error('Por favor escribe un asunto breve')
      return
    }

    if (!description.trim()) {
      toast.error('Por favor detalla la descripción del problema')
      return
    }

    setIsSubmitting(true)
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : ''
      const clientInfo = typeof window !== 'undefined'
        ? `${navigator.userAgent} (${window.innerWidth}x${window.innerHeight})`
        : ''

      const response = await apiClient.createSupportTicket({
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        currentUrl,
        clientInfo,
      })

      toast.success(`Ticket #${response.ticketCode} reportado`, {
        description: 'El equipo técnico (verkkutech@gmail.com) ha sido notificado.',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      })

      setSubject('')
      setDescription('')
      setCategory('system_error')
      setPriority('medium')
      onOpenChange(false)
    } catch (err: any) {
      toast.error('No se pudo enviar el reporte', {
        description: err?.message || 'Ocurrió un error inesperado al registrar el ticket.',
        icon: <AlertCircle className="w-5 h-5 text-destructive" />
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Reportar un Problema / Soporte
            </DialogTitle>
            <DialogDescription>
              Describe la incidencia o duda técnica. Se enviará a soporte con el contexto de tu sesión.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Context Badge */}
            <div className="p-2.5 rounded-lg bg-muted/60 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border border-border">
              <span><strong>Usuario:</strong> {user?.name || user?.email || 'N/A'}</span>
              <span><strong>Rol:</strong> {user?.role || 'N/A'}</span>
              <span className="truncate max-w-[200px]" title={typeof window !== 'undefined' ? window.location.pathname : ''}>
                <strong>Pantalla:</strong> {typeof window !== 'undefined' ? window.location.pathname : '/'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-medium">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="h-9">
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system_error">Error de Sistema</SelectItem>
                    <SelectItem value="data">Datos o Inventario</SelectItem>
                    <SelectItem value="performance">Lentitud / Rendimiento</SelectItem>
                    <SelectItem value="question">Duda Operativa</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-xs font-medium">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority" className="h-9">
                    <SelectValue placeholder="Selecciona prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica / Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-xs font-medium">Asunto breve *</Label>
              <Input
                id="subject"
                placeholder="Ej. Error al guardar pedido #1042"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                required
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium">Descripción detallada *</Label>
              <Textarea
                id="description"
                placeholder="Indica qué intentabas hacer, los pasos para reproducirlo o el mensaje de error observado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Reporte
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
