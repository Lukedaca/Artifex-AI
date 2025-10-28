import { ManualEdits, UploadedFile } from "../types";

export const cropImageToAspectRatio = (file: File, targetAspectRatio: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      const { width: originalWidth, height: originalHeight } = image;
      const originalAspectRatio = originalWidth / originalHeight;

      let sx = 0, sy = 0, sWidth = originalWidth, sHeight = originalHeight;

      if (originalAspectRatio > targetAspectRatio) {
        sWidth = originalHeight * targetAspectRatio;
        sx = (originalWidth - sWidth) / 2;
      } else if (originalAspectRatio < targetAspectRatio) {
        sHeight = originalWidth / targetAspectRatio;
        sy = (originalHeight - sHeight) / 2;
      }

      const canvas = document.createElement('canvas');
      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) return reject(new Error('Could not get canvas context'));

      ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

      canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_cropped.png";
          const newFile = new File([blob], newFileName, { type: 'image/png' });
          resolve(newFile);
        }, 'image/png', 0.95);
    };

    image.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    image.src = url;
  });
};

export const applyEditsToImage = (file: File, edits: ManualEdits): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            
            // Simulate sharpness with a small contrast boost, same as the preview
            const sharpnessContrast = 1 + (edits.sharpness - 100) / 100 * 0.25;

            ctx.filter = `brightness(${edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturation}%) contrast(${sharpnessContrast})`;
            ctx.drawImage(image, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Canvas toBlob failed'));
                const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_edited.png";
                const newFile = new File([blob], newFileName, { type: 'image/png' });
                resolve(newFile);
            }, 'image/png', 0.98);
        };
        image.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
        image.src = url;
    });
};

export const base64ToFile = (base64: string, filename: string, mimeType: string): Promise<File> => {
    return fetch(`data:${mimeType};base64,${base64}`)
        .then(res => res.blob())
        .then(blob => new File([blob], filename, { type: mimeType }));
};