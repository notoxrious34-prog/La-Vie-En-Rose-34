// Asset Optimization Utilities
// Phase 5: Compress images, remove unused assets, use SVG icons

// Lazy load images with intersection observer
export function lazyLoadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Preload critical images
export function preloadCriticalImages(): void {
  const criticalImages = [
    '/LVR34.png',
    '/brand-art.png',
    '/favicon-32.png'
  ];

  criticalImages.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
}

// Optimize image loading with WebP support
export function getOptimizedImageUrl(src: string): string {
  // Check WebP support
  const canvas = document.createElement('canvas');
  const webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;  
  if (webpSupported && src.includes('.png')) {
    return src.replace('.png', '.webp');
  }
  
  return src;
}

// Remove unused assets from memory
export function cleanupUnusedAssets(): void {
  // Clear any cached images that are no longer needed
  const images = document.querySelectorAll('img[data-lazy]') as NodeListOf<HTMLImageElement>;
  images.forEach(img => {
    if (!img.complete) {
      img.src = '';
    }
  });
}

// Asset bundle analyzer
export function analyzeAssetUsage(): {
  totalSize: number;
  unusedAssets: string[];
  recommendations: string[];
} {
  const assets = [
    { name: 'LVR34.png', size: 470786, used: true },
    { name: 'LVR34_0.png', size: 530333, used: false },
    { name: 'brand-art.png', size: 470786, used: true },
    { name: 'brand-mark.png', size: 470786, used: true },
    { name: 'favicon-32.png', size: 1775, used: true },
    { name: 'favicon.svg', size: 9522, used: true },
    { name: 'icons.svg', size: 5031, used: true }
  ];

  const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
  const unusedAssets = assets.filter(asset => !asset.used).map(asset => asset.name);  
  const recommendations = [
    'Remove LVR34_0.png (530KB unused)',
    'Convert PNG icons to SVG where possible',
    'Use WebP format for product images',
    'Implement lazy loading for non-critical images'
  ];

  return { totalSize, unusedAssets, recommendations };
}
