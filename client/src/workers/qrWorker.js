// Web Worker: SVG → PNG conversion off the main thread
// Uses OffscreenCanvas (Chrome 69+, Firefox 105+, Safari 16.4+)

self.onmessage = async (e) => {
  const { svgString, filename, scale = 3 } = e.data;

  try {
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas not supported');
    }

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const imageBitmap = await createImageBitmap(svgBlob);

    const width = imageBitmap.width;
    const height = imageBitmap.height;

    const canvas = new OffscreenCanvas(width * scale, height * scale);
    const ctx = canvas.getContext('2d');

    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // Close the bitmap to free memory immediately
    imageBitmap.close();

    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });

    self.postMessage({ success: true, blob: pngBlob, filename });
  } catch (error) {
    self.postMessage({ success: false, error: error.message, filename });
  }
};
