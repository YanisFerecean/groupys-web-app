/**
 * Resize an image File using an offscreen canvas.
 *
 * @param file      Source image file (non-image files are returned unchanged)
 * @param maxWidth  Target max width  (or exact width when cover=true)
 * @param maxHeight Target max height (or exact height when cover=true)
 * @param cover     true  → crop-fill to exact maxWidth×maxHeight
 *                  false → fit within the box, preserving aspect ratio
 */
export async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  cover = false,
): Promise<File> {
  // GIFs must not be drawn through a canvas — that strips animation to a single frame
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let srcX = 0, srcY = 0, srcW = img.width, srcH = img.height;
      let dstW: number, dstH: number;

      if (cover) {
        // Crop-fill: scale so the shorter side fills the target, then centre-crop
        dstW = maxWidth;
        dstH = maxHeight;
        const scale = Math.max(maxWidth / img.width, maxHeight / img.height);
        srcW = maxWidth / scale;
        srcH = maxHeight / scale;
        srcX = (img.width - srcW) / 2;
        srcY = (img.height - srcH) / 2;
      } else {
        // Fit: scale down only if larger than the box
        const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        dstW = Math.round(img.width * scale);
        dstH = Math.round(img.height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Canvas toBlob failed"));
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.88,
      );
    };

    img.onerror = reject;
    img.src = objectUrl;
  });
}
