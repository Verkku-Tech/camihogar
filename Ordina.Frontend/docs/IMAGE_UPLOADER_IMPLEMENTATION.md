# Guía de Implementación: ImageUploader con Base64

Esta guía detalla cómo implementar el componente `ImageUploader` que convierte imágenes a base64 y las guarda en IndexedDB. Puedes replicar este patrón en cualquier parte del proyecto.

## 📋 Tabla de Contenidos

1. [Paso 1: Definir la Interfaz de Imagen](#paso-1-definir-la-interfaz-de-imagen)
2. [Paso 2: Actualizar la Interfaz del Modelo](#paso-2-actualizar-la-interfaz-del-modelo)
3. [Paso 3: Usar el Componente ImageUploader](#paso-3-usar-el-componente-imageuploader)
4. [Paso 4: Guardar las Imágenes](#paso-4-guardar-las-imágenes)
5. [Cómo Funciona la Conversión a Base64](#cómo-funciona-la-conversión-a-base64)
6. [Manejo de Múltiples Imágenes](#manejo-de-múltiples-imágenes)
7. [Ejemplo Completo](#ejemplo-completo)

---

## Paso 1: Definir la Interfaz de Imagen

### Ubicación: `lib/storage.ts`

Agrega la interfaz `ProductImage` (o el nombre que prefieras) antes de la interfaz que la usará:

```typescript
// Interfaz para imágenes
export interface ProductImage {
  id: string; // ID único para la imagen
  base64: string; // Imagen en base64 (data:image/jpeg;base64,...)
  filename: string; // Nombre original del archivo
  type: "model" | "reference" | "other"; // Tipo de imagen
  uploadedAt: string; // Fecha de carga (ISO string)
  size?: number; // Tamaño del archivo en bytes (opcional)
}
```

**Notas importantes:**
- El campo `base64` incluye el prefijo `data:image/jpeg;base64,` automáticamente
- El `id` debe ser único para cada imagen
- El `type` puede personalizarse según tus necesidades

---

## Paso 2: Actualizar la Interfaz del Modelo

### Ubicación: `lib/storage.ts`

Agrega el campo `images` a la interfaz que necesites (ej: `OrderProduct`, `Client`, etc.):

```typescript
export interface OrderProduct {
  // ... campos existentes ...
  images?: ProductImage[]; // Imágenes asociadas
}
```

**Notas:**
- El campo es opcional (`?`) para mantener compatibilidad con datos existentes
- Puede ser un array vacío `[]` o `undefined`

---

## Paso 3: Usar el Componente ImageUploader

### Ubicación: Tu componente (ej: `product-edit-dialog.tsx`)

#### 3.1 Importar los tipos necesarios

```typescript
import type { ProductImage } from "@/lib/storage";
import { ImageUploader } from "./ImageUploader"; // o la ruta correcta
```

#### 3.2 Agregar estado para las imágenes

```typescript
const [productImages, setProductImages] = useState<ProductImage[]>([]);
```

#### 3.3 Inicializar el estado cuando se carga el modelo

```typescript
useEffect(() => {
  if (product) {
    // ... otros estados ...
    setProductImages(product.images || []);
  }
}, [product]);
```

#### 3.4 Usar el componente en el JSX

```typescript
<div className="space-y-2">
  <Label htmlFor="ProductImages" className="text-sm">
    Imágenes de referencia
  </Label>
  <ImageUploader
    images={productImages}
    onImagesChange={setProductImages}
    maxImages={10}        // Opcional: máximo de imágenes (default: 10)
    maxSizeMB={5}         // Opcional: tamaño máximo por imagen (default: 5MB)
  />
</div>
```

**Props del ImageUploader:**
- `images`: Array de imágenes actuales
- `onImagesChange`: Callback que se ejecuta cuando cambian las imágenes
- `maxImages`: (Opcional) Máximo de imágenes permitidas
- `maxSizeMB`: (Opcional) Tamaño máximo por imagen en MB

---

## Paso 4: Guardar las Imágenes

### En la función de guardado (ej: `handleSave`)

```typescript
const handleSave = () => {
  const updatedProduct: OrderProduct = {
    ...product,
    // ... otros campos ...
    images: productImages.length > 0 ? productImages : undefined,
  };
  
  onProductUpdate(updatedProduct);
};
```

**Notas:**
- Si no hay imágenes, puedes usar `undefined` o `[]`
- Las imágenes se guardan automáticamente en IndexedDB cuando guardas el objeto

---

## Cómo Funciona la Conversión a Base64

### Proceso paso a paso:

1. **Usuario selecciona archivos**: El componente `ImageUploader` usa `react-dropzone` para permitir arrastrar o seleccionar imágenes.

2. **Validación**: Se valida:
   - Cantidad máxima de imágenes
   - Tamaño máximo por archivo
   - Tipo de archivo (solo imágenes)

3. **Conversión a Base64**: Para cada archivo:
   ```typescript
   const fileToBase64 = (file: File): Promise<string> => {
     return new Promise((resolve, reject) => {
       const reader = new FileReader()
       reader.onload = () => resolve(reader.result as string)
       reader.onerror = () => reject(new Error('Error al leer el archivo'))
       reader.readAsDataURL(file) // Convierte a base64 con prefijo
     })
   }
   ```

4. **Creación del objeto ProductImage**: Se crea un objeto con:
   - `id`: Generado automáticamente
   - `base64`: String completo con prefijo `data:image/...`
   - `filename`: Nombre original
   - `type`: Tipo de imagen
   - `uploadedAt`: Fecha actual
   - `size`: Tamaño en bytes

5. **Actualización del estado**: Se llama a `onImagesChange` con el nuevo array de imágenes.

---

## Manejo de Múltiples Imágenes

### Procesamiento en Paralelo

El componente usa `Promise.all()` para procesar múltiples imágenes simultáneamente:

```typescript
const newImages: ProductImage[] = await Promise.all(
  files.map(async (file) => {
    const base64 = await fileToBase64(file)
    return {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      base64,
      filename: file.name,
      type: "reference" as const,
      uploadedAt: new Date().toISOString(),
      size: file.size
    }
  })
)
```

**Ventajas:**
- ✅ Procesa 3-4 imágenes a la vez sin problemas
- ✅ Más rápido que procesar secuencialmente
- ✅ Feedback visual con estado de carga

**Consideraciones:**
- Si subes muchas imágenes grandes, puede consumir mucha memoria
- El límite de `maxImages` ayuda a controlar esto

---

## Ejemplo Completo

### Componente completo de ejemplo:

```typescript
"use client"

import { useState, useEffect } from "react"
import type { OrderProduct, ProductImage } from "@/lib/storage"
import { ImageUploader } from "./ImageUploader"

interface MyComponentProps {
  product: OrderProduct | null
  onSave: (product: OrderProduct) => void
}

export function MyComponent({ product, onSave }: MyComponentProps) {
  const [productImages, setProductImages] = useState<ProductImage[]>([])

  // Inicializar imágenes cuando se carga el producto
  useEffect(() => {
    if (product) {
      setProductImages(product.images || [])
    }
  }, [product])

  const handleSave = () => {
    if (!product) return

    const updatedProduct: OrderProduct = {
      ...product,
      images: productImages.length > 0 ? productImages : undefined,
    }

    onSave(updatedProduct)
  }

  return (
    <div>
      <ImageUploader
        images={productImages}
        onImagesChange={setProductImages}
        maxImages={10}
        maxSizeMB={5}
      />
      <button onClick={handleSave}>Guardar</button>
    </div>
  )
}
```

---

## Replicar en Otras Áreas

### Para usar en un componente diferente (ej: Clientes):

1. **Actualizar la interfaz del modelo:**
   ```typescript
   export interface Client {
     // ... campos existentes ...
     images?: ProductImage[]; // O ClientImage si prefieres otro nombre
   }
   ```

2. **En tu componente:**
   ```typescript
   const [clientImages, setClientImages] = useState<ProductImage[]>([])
   
   useEffect(() => {
     if (client) {
       setClientImages(client.images || [])
     }
   }, [client])
   
   // En el JSX:
   <ImageUploader
     images={clientImages}
     onImagesChange={setClientImages}
     maxImages={5}  // Ajusta según necesidad
     maxSizeMB={3}  // Ajusta según necesidad
   />
   
   // En handleSave:
   const updatedClient: Client = {
     ...client,
     images: clientImages.length > 0 ? clientImages : undefined,
   }
   ```

---

## Preguntas Frecuentes

### ¿Por qué base64 y no URLs?

- ✅ Funciona offline (no necesita servidor)
- ✅ Se guarda directamente en IndexedDB
- ✅ No requiere gestión de archivos en el servidor
- ⚠️ Aumenta el tamaño de los datos (pero IndexedDB lo maneja bien)

### ¿Cuántas imágenes puedo subir?

- Por defecto: máximo 10 imágenes
- Configurable con `maxImages`
- Cada imagen: máximo 5MB por defecto
- Configurable con `maxSizeMB`

### ¿Cómo optimizar el tamaño?

Si necesitas comprimir imágenes antes de convertir a base64, puedes agregar una función de compresión (ver la sección opcional en el código del ImageUploader).

### ¿Las imágenes se guardan automáticamente?

No, las imágenes se guardan cuando guardas el objeto completo (ej: cuando guardas el producto). El componente solo maneja el estado local.

---

## Resumen de Pasos Rápidos

1. ✅ Agregar interfaz `ProductImage` en `storage.ts`
2. ✅ Agregar campo `images?: ProductImage[]` a tu modelo
3. ✅ Importar `ImageUploader` y `ProductImage` en tu componente
4. ✅ Agregar estado: `const [images, setImages] = useState<ProductImage[]>([])`
5. ✅ Inicializar en `useEffect` cuando se carga el modelo
6. ✅ Usar `<ImageUploader images={images} onImagesChange={setImages} />`
7. ✅ Incluir `images` en la función de guardado

¡Listo! Ya puedes usar el ImageUploader en cualquier parte del proyecto. 🎉

