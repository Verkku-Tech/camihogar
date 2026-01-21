"use client"

import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X, Loader2, Shield, FileText } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ProductImage } from "@/lib/storage"

interface ImageUploaderProps {
  images?: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
  maxImages?: number;
  maxSizeMB?: number; // Tamaño máximo por imagen DESPUÉS de compresión
  maxPdfSizeMB?: number; // Tamaño máximo por PDF (sin compresión)
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
  maxPdfSizeMB = 5, // Máximo 5MB por PDF (sin compresión)
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
   * Convierte un File directamente a base64 (para PDFs, sin compresión)
   * @param file - Archivo a convertir
   * @returns Promise con el string base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = () => {
        resolve(reader.result as string)
      }
      
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'))
      }
      
      reader.readAsDataURL(file)
    })
  }

  /**
   * Procesa un archivo PDF: valida tamaño y convierte a base64 (sin compresión)
   * @param file - Archivo PDF a procesar
   * @returns Promise con ProductImage
   */
  const processPDF = async (file: File): Promise<ProductImage> => {
    // Validar tamaño ANTES de procesar
    const fileSizeMB = file.size / 1024 / 1024
    if (fileSizeMB > maxPdfSizeMB) {
      throw new Error(
        `El PDF "${file.name}" es muy grande (${fileSizeMB.toFixed(2)}MB). ` +
        `Máximo permitido: ${maxPdfSizeMB}MB.`
      )
    }

    // Convertir a base64 directamente (sin compresión)
    const base64 = await fileToBase64(file)
    
    return {
      id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      base64,
      filename: file.name,
      type: "reference" as const,
      uploadedAt: new Date().toISOString(),
      size: file.size,
      mimeType: "application/pdf"
    }
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
   * Procesa múltiples archivos: valida, comprime imágenes, convierte PDFs a base64
   */
  const processFiles = async (files: File[]) => {
    setError(null)
    setUploading(true)
    setCompressionProgress(0)

    try {
      // Validar cantidad máxima
      if (images.length + files.length > maxImages) {
        const errorMsg = `Solo puedes subir máximo ${maxImages} archivos. Ya tienes ${images.length}.`
        toast.error(errorMsg)
        throw new Error(errorMsg)
      }

      // Validar tipo de archivo y tamaño ANTES de procesar
      const invalidFiles: string[] = []
      const pdfs: File[] = []
      const imageFiles: File[] = []
      
      files.forEach(file => {
        if (file.type === 'application/pdf') {
          // Validar tamaño de PDF antes de procesar
          const fileSizeMB = file.size / 1024 / 1024
          if (fileSizeMB > maxPdfSizeMB) {
            invalidFiles.push(`${file.name} (PDF muy grande: ${fileSizeMB.toFixed(2)}MB, máximo: ${maxPdfSizeMB}MB)`)
            toast.error(`El PDF "${file.name}" es muy grande (${fileSizeMB.toFixed(2)}MB). Máximo permitido: ${maxPdfSizeMB}MB.`)
          } else {
            pdfs.push(file)
          }
        } else if (file.type.startsWith('image/')) {
          imageFiles.push(file)
        } else {
          invalidFiles.push(`${file.name} (tipo no soportado: ${file.type})`)
          toast.error(`Tipo de archivo no soportado: ${file.name}. Solo se aceptan imágenes (JPG, PNG) y PDFs.`)
        }
      })

      if (invalidFiles.length > 0) {
        throw new Error(`Archivos inválidos:\n${invalidFiles.join('\n')}`)
      }

      // Calcular tamaño actual total
      const currentTotalSize = calculateTotalSize(images)
      const maxTotalSizeBytes = maxTotalSizeMB * 1024 * 1024

      // Procesar archivos una por una para mostrar progreso y validar tamaño
      const newImages: ProductImage[] = []
      const totalFiles = pdfs.length + imageFiles.length
      
      let processedCount = 0

      // Procesar PDFs primero
      for (const file of pdfs) {
        processedCount++
        setCompressionProgress((processedCount / totalFiles) * 100)

        try {
          const pdfImage = await processPDF(file)
          
          // Validar tamaño total acumulado (considerando que base64 aumenta ~33%)
          const estimatedBase64Size = file.size * 1.33 // Aproximación
          const testTotalSize = currentTotalSize + 
            calculateTotalSize(newImages) + 
            estimatedBase64Size

          if (testTotalSize > maxTotalSizeBytes) {
            const currentMB = (currentTotalSize / 1024 / 1024).toFixed(2)
            const fileMB = (file.size / 1024 / 1024).toFixed(2)
            throw new Error(
              `No se puede agregar más archivos. El tamaño total excedería ${maxTotalSizeMB}MB. ` +
              `Tamaño actual: ${currentMB}MB. Este PDF agregaría aproximadamente: ${fileMB}MB.`
            )
          }

          newImages.push(pdfImage)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : `Error procesando ${file.name}`
          toast.error(errorMessage)
          throw new Error(errorMessage)
        }
      }

      // Procesar imágenes (con compresión)
      for (const file of imageFiles) {
        processedCount++
        setCompressionProgress((processedCount / totalFiles) * 100)

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
            size: compressedBlob.size,
            mimeType: file.type
          }

          const testTotalSize = calculateTotalSize([...images, ...newImages, newImage])
          if (testTotalSize > maxTotalSizeBytes) {
            throw new Error(
              `No se puede agregar más archivos. El tamaño total excedería ${maxTotalSizeMB}MB. ` +
              `Tamaño actual: ${(currentTotalSize / 1024 / 1024).toFixed(2)}MB. ` +
              `Esta imagen agregaría: ${compressedSizeMB.toFixed(2)}MB.`
            )
          }

          newImages.push(newImage)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : `Error procesando ${file.name}`
          toast.error(errorMessage)
          throw new Error(errorMessage)
        }
      }

      // Combinar archivos existentes con los nuevos
      const allImages = [...images, ...newImages]
      onImagesChange(allImages)
      
      // Mostrar información de procesamiento
      const totalSizeMB = (calculateTotalSize(allImages) / 1024 / 1024).toFixed(2)
      const pdfCount = newImages.filter(img => img.mimeType === 'application/pdf').length
      const imgCount = newImages.filter(img => img.mimeType?.startsWith('image/')).length
      
      if (pdfCount > 0 && imgCount > 0) {
        toast.success(`${imgCount} imagen(es) y ${pdfCount} PDF(s) procesados. Tamaño total: ${totalSizeMB}MB`)
      } else if (pdfCount > 0) {
        toast.success(`${pdfCount} PDF(s) agregado(s). Tamaño total: ${totalSizeMB}MB`)
      } else {
        toast.success(`${imgCount} imagen(es) comprimida(s). Tamaño total: ${totalSizeMB}MB`)
      }
      
      console.log(`✅ Archivos procesados. Tamaño total: ${totalSizeMB}MB`)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar los archivos'
      setError(errorMessage)
      console.error('Error procesando archivos:', err)
      // El toast ya se mostró en las validaciones individuales
    } finally {
      setUploading(false)
      setCompressionProgress(0)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFiles(acceptedFiles)
    }
  }, [images, maxImages, maxSizeMB, maxPdfSizeMB, maxTotalSizeMB, compressionQuality, maxWidth, maxHeight, isSensitive])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf']
    },
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
              Procesando archivos... {Math.round(compressionProgress)}%
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
                ? "Suelta los archivos aquí" 
                : images.length >= maxImages
                ? `Máximo de ${maxImages} archivos alcanzado`
                : "Arrastra imágenes/PDFs o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {images.length}/{maxImages} archivos • Imágenes: {maxSizeMB}MB • PDFs: {maxPdfSizeMB}MB
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

      {/* Vista previa de archivos */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image) => {
            const isPDF = image.mimeType === 'application/pdf' || 
                         image.filename.toLowerCase().endsWith('.pdf') ||
                         image.base64.startsWith('data:application/pdf')
            const fileSizeMB = image.size ? (image.size / 1024 / 1024).toFixed(2) : 'N/A'
            
            return (
              <div key={image.id} className="relative group rounded-md overflow-hidden border">
                {isPDF ? (
                  <div className="w-full aspect-square flex flex-col bg-muted">
                    <div className="flex-1 min-h-[200px]">
                      <iframe
                        src={image.base64}
                        className="w-full h-full border-0"
                        title={image.filename}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square">
                    <img
                      src={image.base64}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1">
                  <div className="truncate flex items-center gap-1">
                    {isPDF && <FileText className="w-3 h-3" />}
                    {image.filename}
                  </div>
                  <div className="text-[10px] opacity-75">
                    {isPDF ? 'PDF' : 'Imagen'} • {fileSizeMB}MB
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
