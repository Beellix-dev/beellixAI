import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { FinalSlide } from '../hooks/useWebSocket';

const SLIDE_W = 1280;
const SLIDE_H = 720;

// PDF page size in mm (16:9 landscape)
const PDF_W_MM = 254;
const PDF_H_MM = 142.875;

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'presentation';
}

/**
 * 直接从 DOM 元素截图生成 PDF
 * 这样可以确保 PDF 与演示视图完全一致
 */
export async function exportSlidesToPdfFromDOM(
  slideElements: HTMLElement[],
  title: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [PDF_W_MM, PDF_H_MM],
  });

  for (let i = 0; i < slideElements.length; i++) {
    onProgress?.(i + 1, slideElements.length);

    // 直接截取已渲染的 DOM 元素
    const canvas = await html2canvas(slideElements[i], {
      scale: 2, // 提高清晰度
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (i > 0) {
      pdf.addPage([PDF_W_MM, PDF_H_MM], 'landscape');
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, PDF_W_MM, PDF_H_MM);
  }

  const filename = sanitizeFilename(title) + '.pdf';
  pdf.save(filename);
}

function waitForImageLoad(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${img.src}`));
  });
}

export async function exportSlidesToPdf(
  slides: FinalSlide[],
  title: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  // Create offscreen container
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: `${SLIDE_W}px`,
    height: `${SLIDE_H}px`,
    overflow: 'hidden',
    zIndex: '-1',
    backgroundColor: '#ffffff',
  });
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [PDF_W_MM, PDF_H_MM],
    });

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      onProgress?.(i + 1, slides.length);

      // Build slide DOM
      container.innerHTML = '';
      Object.assign(container.style, {
        position: 'fixed',
        width: `${SLIDE_W}px`,
        height: `${SLIDE_H}px`,
      });

      // Background image layer
      if (slide.imageUrl) {
        const img = document.createElement('img');
        img.src = slide.imageUrl;
        img.crossOrigin = 'anonymous';
        Object.assign(img.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        });
        container.appendChild(img);
        await waitForImageLoad(img);
      }

      // HTML overlay layer
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'relative',
        width: '100%',
        height: '100%',
      });
      overlay.innerHTML = slide.finalHtml;
      container.appendChild(overlay);

      // Small delay to let browser layout/paint
      await new Promise(r => setTimeout(r, 100));

      // Capture with higher quality
      const canvas = await html2canvas(container, {
        width: SLIDE_W,
        height: SLIDE_H,
        scale: 2, // 提高清晰度
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        pdf.addPage([PDF_W_MM, PDF_H_MM], 'landscape');
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, PDF_W_MM, PDF_H_MM);
    }

    const filename = sanitizeFilename(title) + '.pdf';
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
