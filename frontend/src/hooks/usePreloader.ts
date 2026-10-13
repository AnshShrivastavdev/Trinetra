import { useState, useEffect } from "react";

export const usePreloader = (frameCount: number = 300) => {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [images, setImages] = useState<HTMLImageElement[]>([]);

  useEffect(() => {
    let loadedCount = 0;
    const loadedImages: HTMLImageElement[] = [];

    const loadImages = async () => {
      const promises = Array.from({ length: frameCount }, (_, i) => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          const frameIndex = String(i + 1).padStart(3, "0");
          img.src = `/frames/ezgif-frame-${frameIndex.trim()}.jpg`;
          
          img.onload = () => {
            loadedCount++;
            setProgress(Math.round((loadedCount / frameCount) * 100));
            resolve(img);
          };
          
          img.onerror = () => {
            // Gracefully resolve even on frame failure to avoid locking preloader
            loadedCount++;
            setProgress(Math.round((loadedCount / frameCount) * 100));
            resolve(img);
          };
          
          loadedImages[i] = img;
        });
      });

      await Promise.all(promises);
      setImages(loadedImages);
      setIsLoading(false);
    };

    loadImages();
  }, [frameCount]);

  return { isLoading, progress, images };
};
