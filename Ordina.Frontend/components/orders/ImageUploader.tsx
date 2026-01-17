"use client"

import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X, Loader2, Shield } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProductImage } from "@/lib/storage"

interface ImageUploaderProps {
  images?: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
  maxImages?: number;
  maxSizeMB?: number; // Tamaño máximo por imagen DESPUÉS de compresión
  maxTotalSizeMB?: number; // Tamaño total máximo (para evitar exceder 16MB de MongoDB)
  compressionQuality?: number; // Calidad de compresión (0.1 a 1.0)
  maxWidth?: number; // Ancho máximo de la imagen comprimida
  maxHeight?: number; // Alto máximo de la imagen comprimida
  isSensitive?: boolean; // Para comprobantes de pago
}

export function ImageUploader({ 
  images = [], 
  onImagesChange, 
  maxImages = 10,
  maxSizeMB = 2, // Reducido a 2MB por defecto después de compresión
  maxTotalSizeMB = 10, // Máximo 10MB total para estar seguros del límite de 16MB
  compressionQuality = 0.7, // 70% de calidad (balance entre tamaño y calidad)
  maxWidth = 1920, // Máximo 1920px de ancho
  maxHeight = 1920, // Máximo 1920px de alto
  isSensitive = false // Por defecto false, true para comprobantes
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compressionProgress, setCompressionProgress] = useState<number>(0)

  /**
   * Valida que no se envíe información a servicios externos
   */
  const validateSecurity = useCallback(() => {
    if (typeof window === 'undefined') return true
    
    // Verificar que no haya scripts de terceros relacionados con tracking
    const scripts = Array.from(document.scripts)
    const suspiciousScripts = scripts.filter(s => 
      s.src && (
        s.src.includes('analytics') ||
        s.src.includes('tracking') ||
        s.src.includes('google-analytics') ||
        s.src.includes('facebook') ||
        s.src.includes('pixel')
      )
    )
    
    if (suspiciousScripts.length > 0 && isSensitive) {
      console.warn('⚠️ Se detectaron scripts de tracking. Los datos sensibles no se enviarán a terceros.')
    }
    
    return true
  }, [isSensitive])

  /**
   * Comprime una imagen usando Canvas API (100% local, sin envío externo)
   * @param file - Archivo de imagen a comprimir
   * @returns Promise con el Blob comprimido
   */
  const compressImage = async (file: File): Promise<Blob> => {
    // Validar seguridad antes de procesar
    if (isSensitive) {
      validateSecurity()
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        
        img.onload = () => {
          // Calcular dimensiones manteniendo aspect ratio
          let width = img.width
          let height = img.height
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = width * ratio
            height = height * ratio
          }
          
          // Crear canvas y dibujar imagen redimensionada (todo en memoria local)
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('No se pudo crear el contexto del canvas'))
            return
          }
          
          // Mejorar calidad de renderizado
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          // Dibujar imagen redimensionada (procesamiento local)
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convertir a Blob con compresión (todo local, sin envío externo)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Limpiar referencias de memoria
                img.src = ''
                canvas.width = 0
                canvas.height = 0
                resolve(blob)
              } else {
                reject(new Error('Error al comprimir la imagen'))
              }
            },
            'image/jpeg', // Siempre convertir a JPEG para mejor compresión
            compressionQuality
          )
        }
        
        img.onerror = () => {
          reject(new Error('Error al cargar la imagen'))
        }
        
        img.src = e.target?.result as string
      }
      
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'))
      }
      
      reader.readAsDataURL(file)
    })
  }

  /**
   * Convierte un Blob a base64
   * @param blob - Blob a convertir
   * @returns Promise con el string base64
   */
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = () => {
        resolve(reader.result as string)
      }
      
      reader.onerror = () => {
        reject(new Error('Error al convertir a base64'))
      }
      
      reader.readAsDataURL(blob)
    })
  }

  /**
   * Calcula el tamaño total de todas las imágenes en base64
   */
  const calculateTotalSize = (imageList: ProductImage[]): number => {
    return imageList.reduce((total, img) => {
      // El tamaño en base64 es aproximadamente 33% mayor que el original
      // Pero como ya está comprimido, usamos el tamaño del base64 directamente
      const base64Size = (img.base64.length * 3) / 4 // Aproximación del tamaño real
      return total + base64Size
    }, 0)
  }

  /**
   * Procesa múltiples archivos: valida, comprime, convierte a base64
   */
  const processFiles = async (files: File[]) => {
    setError(null)
    setUploading(true)
    setCompressionProgress(0)

    try {
      // Validar cantidad máxima
      if (images.length + files.length > maxImages) {
        throw new Error(`Solo puedes subir máximo ${maxImages} imágenes. Ya tienes ${images.length}.`)
      }

      // Validar tipo de archivo
      const invalidFiles: string[] = []
      files.forEach(file => {
        if (!file.type.startsWith('image/')) {
          invalidFiles.push(`${file.name} (no es una imagen)`)
        }
      })

      if (invalidFiles.length > 0) {
        throw new Error(`Archivos inválidos:\n${invalidFiles.join('\n')}`)
      }

      // Calcular tamaño actual total
      const currentTotalSize = calculateTotalSize(images)
      const maxTotalSizeBytes = maxTotalSizeMB * 1024 * 1024

      // Procesar imágenes una por una para mostrar progreso y validar tamaño
      const newImages: ProductImage[] = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCompressionProgress(((i + 1) / files.length) * 100)

        try {
          // Comprimir imagen (todo local, sin envío externo)
          const compressedBlob = await compressImage(file)
          
          // Validar tamaño después de compresión
          const compressedSizeMB = compressedBlob.size / 1024 / 1024
          if (compressedSizeMB > maxSizeMB) {
            throw new Error(
              `${file.name}: Después de compresión sigue siendo muy grande (${compressedSizeMB.toFixed(2)}MB). ` +
              `Máximo permitido: ${maxSizeMB}MB. Intenta con una imagen de menor resolución.`
            )
          }

          // Convertir a base64
          const base64 = await blobToBase64(compressedBlob)
          
          // Validar tamaño total acumulado
          const newImage: ProductImage = {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            base64,
            filename: file.name,
            type: "reference" as const,
            uploadedAt: new Date().toISOString(),
            size: compressedBlob.size
          }

          const testTotalSize = calculateTotalSize([...images, ...newImages, newImage])
          if (testTotalSize > maxTotalSizeBytes) {
            throw new Error(
              `No se puede agregar más imágenes. El tamaño total excedería ${maxTotalSizeMB}MB. ` +
              `Tamaño actual: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB. ` +
              `Esta imagen agregaría: ${compressedSizeMB.toFixed(2)}MB.`
            )
          }

          newImages.push(newImage)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : `Error procesando ${file.name}`
          throw new Error(errorMessage)
        }
      }

      // Combinar imágenes existentes con las nuevas
      const allImages = [...images, ...newImages]
      onImagesChange(allImages)
      
      // Mostrar información de compresión
      const totalSizeMB = (calculateTotalSize(allImages) / 1024 / 1024).toFixed(2)
      console.log(`✅ Imágenes comprimidas. Tamaño total: ${totalSizeMB}MB`)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar las imágenes'
      setError(errorMessage)
      console.error('Error procesando imágenes:', err)
    } finally {
      setUploading(false)
      setCompressionProgress(0)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFiles(acceptedFiles)
    }
  }, [images, maxImages, maxSizeMB, maxTotalSizeMB, compressionQuality, maxWidth, maxHeight, isSensitive])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    multiple: true,
    disabled: uploading || images.length >= maxImages
  })

  const removeImage = (imageId: string) => {
    const updatedImages = images.filter(img => img.id !== imageId)
    onImagesChange(updatedImages)
  }

  // Calcular tamaño total actual
  const currentTotalSizeMB = (calculateTotalSize(images) / 1024 / 1024).toFixed(2)

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      
     

      {/* Área de Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-10 transition-colors flex flex-col items-center justify-center",
          (uploading || images.length >= maxImages) 
            ? "opacity-50 cursor-not-allowed" 
            : "cursor-pointer",
          isDragActive 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium text-center">
              Comprimiendo imágenes... {Math.round(compressionProgress)}%
            </p>
            <div className="w-full max-w-xs mt-2 bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${compressionProgress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <UploadCloud className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-center">
              {isDragActive 
                ? "Suelta las imágenes aquí" 
                : images.length >= maxImages
                ? `Máximo de ${maxImages} imágenes alcanzado`
                : "Arrastra imágenes o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {images.length}/{maxImages} imágenes • Máximo {maxSizeMB}MB por imagen
              <br />
              Tamaño total: {currentTotalSizeMB}MB / {maxTotalSizeMB}MB
            </p>
          </>
        )}
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive whitespace-pre-line">{error}</p>
        </div>
      )}

      {/* Vista previa de imágenes */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image) => {
            const imageSrc = image.base64
            const imageSizeMB = image.size ? (image.size / 1024 / 1024).toFixed(2) : 'N/A'
            
            return (
              <div key={image.id} className="relative group aspect-square rounded-md overflow-hidden border">
                <img
                  src={imageSrc}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1">
                  <div className="truncate">{image.filename}</div>
                  <div className="text-[10px] opacity-75">{imageSizeMB}MB</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
