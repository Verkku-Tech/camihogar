"use client"

import React, { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ProductImage } from "@/lib/storage"

interface ImageGalleryProps {
  images: ProductImage[]
  title?: string // Título opcional (ej: "Comprobante de Pago", "Imágenes del Producto")
  maxThumbnails?: number // Máximo de miniaturas visibles antes de mostrar "ver más"
  className?: string
}

export function ImageGallery({ 
  images, 
  title,
  maxThumbnails = 3,
  className 
}: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  if (!images || images.length === 0) {
    return null
  }

  const visibleThumbnails = showAll ? images : images.slice(0, maxThumbnails)
  const hasMore = images.length > maxThumbnails

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index)
  }

  const closeLightbox = () => {
    setSelectedImageIndex(null)
  }

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedImageIndex === null) return
    
    if (direction === 'prev') {
      setSelectedImageIndex(
        selectedImageIndex === 0 ? images.length - 1 : selectedImageIndex - 1
      )
    } else {
      setSelectedImageIndex(
        selectedImageIndex === images.length - 1 ? 0 : selectedImageIndex + 1
      )
    }
  }

  // Manejar teclado (ESC para cerrar, flechas para navegar)
  useEffect(() => {
    if (selectedImageIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox()
      } else if (e.key === 'ArrowLeft') {
        navigateImage('prev')
      } else if (e.key === 'ArrowRight') {
        navigateImage('next')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImageIndex, images.length])

  const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null

  return (
    <>
      <div className={cn("space-y-2", className)}>
        {title && (
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {title} ({images.length})
            </span>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          {visibleThumbnails.map((image, index) => {
            const actualIndex = showAll ? index : index
            return (
              <button
                key={image.id}
                onClick={() => openLightbox(actualIndex)}
                className="relative group aspect-square w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden border-2 border-border hover:border-primary transition-all hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                type="button"
                aria-label={`Ver imagen ${index + 1} de ${images.length}`}
              >
                <img
                  src={image.base64}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate">
                    {image.filename}
                  </p>
                </div>
              </button>
            )
          })}
          
          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="aspect-square w-20 h-20 sm:w-24 sm:h-24 rounded-md border-2 border-dashed border-muted-foreground/50 hover:border-primary transition-colors flex items-center justify-center text-muted-foreground hover:text-primary text-xs font-medium"
              type="button"
            >
              +{images.length - maxThumbnails}
              <br />
              más
            </button>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && selectedImageIndex !== null && (
        <Dialog open={selectedImageIndex !== null} onOpenChange={closeLightbox}>
          <DialogContent className="max-w-5xl max-h-[90vh] p-0 bg-black/95 border-none">
            <DialogDescription className="sr-only">
              Visualizador de imagen {selectedImageIndex + 1} de {images.length}: {selectedImage.filename}
            </DialogDescription>
            <div className="relative w-full h-full flex items-center justify-center min-h-[400px]">
              {/* Botón cerrar */}
              <Button
                variant="ghost"
                size="icon"
                onClick={closeLightbox}
                className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
                aria-label="Cerrar"
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Navegación anterior */}
              {images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateImage('prev')}
                  className="absolute left-4 z-50 text-white hover:bg-white/20"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
              )}

              {/* Imagen principal */}
              <div className="w-full h-full flex items-center justify-center p-8">
                <img
                  src={selectedImage.base64}
                  alt={selectedImage.filename}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              </div>

              {/* Navegación siguiente */}
              {images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateImage('next')}
                  className="absolute right-4 z-50 text-white hover:bg-white/20"
                  aria-label="Imagen siguiente"
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              )}

              {/* Información de la imagen */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                <p className="font-medium">{selectedImage.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedImageIndex + 1} de {images.length}
                  {selectedImage.size && (
                    <> • {(selectedImage.size / 1024 / 1024).toFixed(2)}MB</>
                  )}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

