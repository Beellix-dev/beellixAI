import html2canvas from 'html2canvas-pro';

/**
 * 幻灯片截图缓存
 * 用于存储已渲染的幻灯片高质量截图
 */
class SlideCache {
  private cache = new Map<string, string>(); // slideId -> base64 image data

  /**
   * 从 DOM 元素生成高质量截图并缓存
   */
  async captureSlide(slideId: string, element: HTMLElement): Promise<string> {
    // 检查缓存
    const cached = this.cache.get(slideId);
    if (cached) return cached;

    // 截图
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    this.cache.set(slideId, imageData);
    return imageData;
  }

  /**
   * 获取缓存的截图
   */
  getCachedSlide(slideId: string): string | undefined {
    return this.cache.get(slideId);
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取所有缓存的截图
   */
  getAllCached(): Map<string, string> {
    return new Map(this.cache);
  }
}

export const slideCache = new SlideCache();
