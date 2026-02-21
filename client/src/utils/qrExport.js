/**
 * Synchronous (main-thread) fallback for SVG → PNG export.
 * Used when the Web Worker / OffscreenCanvas path is unavailable.
 *
 * @param {SVGElement} svgElement - The SVG DOM node
 * @param {string} filename - Download filename
 * @param {number} [scale=3] - Resolution multiplier
 */
export const downloadSvgAsPngSync = (svgElement, filename, scale = 3) => {
  if (!svgElement) return;

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename;
    link.click();
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    console.error('[QR Export] Failed to load SVG for PNG conversion');
  };

  img.src = url;
};

/**
 * High-level QR export: tries the worker first, falls back to sync.
 *
 * @param {object} params
 * @param {Function} params.exportToPng - Worker hook's exportToPng
 * @param {string} params.selector - CSS selector for the SVG parent (e.g. '#primary-qr')
 * @param {string} params.filename - Download filename
 * @param {number} [params.scale=3] - Resolution multiplier
 */
export const exportQrCode = async ({ exportToPng, selector, filename, scale = 3 }) => {
  const svg = document.querySelector(`${selector} svg`) || document.querySelector(selector);
  if (!svg) return;

  // Try worker path
  if (exportToPng) {
    const success = await exportToPng(svg, filename, scale);
    if (success) return;
  }

  // Fallback to sync
  downloadSvgAsPngSync(svg, filename, scale);
};
