import React, { useRef, useEffect } from "react";
import { useScroll, useTransform, useSpring } from "framer-motion";

interface ScrollCanvasProps {
  images: HTMLImageElement[];
}

export const ScrollCanvas: React.FC<ScrollCanvasProps> = ({ images }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollYProgress } = useScroll();

  // Smooth scroll interpolation (lerping)
  const smoothProgress = useSpring(scrollYProgress, {
    damping: 35,
    stiffness: 180,
    restDelta: 0.0001,
  });

  // Map progress (0.0 to 1.0) directly to image index (0 to 299)
  const frameIndex = useTransform(smoothProgress, [0, 1], [0, 299]);

  const drawCoverImage = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number
  ) => {
    if (!img.complete || img.naturalWidth === 0) return;
    
    ctx.clearRect(0, 0, w, h);
    const imgRatio = img.width / img.height;
    const canvasRatio = w / h;
    let sWidth = img.width;
    let sHeight = img.height;
    let sx = 0;
    let sy = 0;

    if (imgRatio > canvasRatio) {
      sWidth = img.height * canvasRatio;
      sx = (img.width - sWidth) / 2;
    } else {
      sHeight = img.width / imgRatio;
      sy = (img.height - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, w, h);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set initial size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Draw first frame immediately if available
    if (images.length > 0) {
      drawCoverImage(ctx, images[0], canvas.width, canvas.height);
    }

    // Subscribe to scroll transform index changes
    const unsubscribe = frameIndex.on("change", (latest) => {
      const idx = Math.min(299, Math.max(0, Math.round(latest)));
      const img = images[idx];
      if (img) {
        drawCoverImage(ctx, img, canvas.width, canvas.height);
      }
    });

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const idx = Math.min(299, Math.max(0, Math.round(frameIndex.get())));
      const img = images[idx];
      if (img) {
        drawCoverImage(ctx, img, canvas.width, canvas.height);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      unsubscribe();
      window.removeEventListener("resize", handleResize);
    };
  }, [images, frameIndex]);

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-0 overflow-hidden bg-primary-bg">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover pointer-events-none block"
      />
    </div>
  );
};
