/**
 * Redimensiona y comprime una imagen seleccionada a formato cuadrado WebP (fallback JPEG)
 * Máximo 256x256 px a ~20-50 KB, ideal para almacenamiento directo como Data URL.
 */
export function processAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("El archivo seleccionado debe ser una imagen válida."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Error al decodificar la imagen."));
      img.onload = () => {
        const targetSize = 256;
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo inicializar el procesador de imagen."));
          return;
        }

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

        // ponytail: compresión canvas estándar nativa sin dependencias externas
        let dataUrl = canvas.toDataURL("image/webp", 0.85);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        }
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
