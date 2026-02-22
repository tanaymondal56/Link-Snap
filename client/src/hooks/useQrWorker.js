import { useRef, useCallback, useEffect } from 'react';

/**
 * React hook for off-main-thread QR code SVG → PNG export.
 *
 * Uses a Web Worker with OffscreenCanvas when supported.
 * Returns `false` from exportToPng() when the worker can't handle the task,
 * signalling the caller to use the synchronous (main-thread) fallback.
 *
 * Worker lifecycle: created lazily on first export, terminated on unmount.
 */
export const useQrWorker = () => {
  const workerRef = useRef(null);
  const activeRef = useRef(true); // Track if component is still mounted

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * Export an SVG element as a high-res PNG download.
   * @param {SVGElement} svgElement - The SVG DOM element to export
   * @param {string} filename - Download filename (e.g. 'qr-abc123.png')
   * @param {number} [scale=3] - Resolution multiplier
   * @returns {Promise<boolean>} true if worker succeeded, false if caller should use fallback
   */
  const exportToPng = useCallback(async (svgElement, filename, scale = 3) => {
    // Feature detection: OffscreenCanvas required by the worker
    if (typeof OffscreenCanvas === 'undefined') {
      return false;
    }

    try {
      // Lazy-init worker on first use
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL('../workers/qrWorker.js', import.meta.url),
          { type: 'module' }
        );
      }

      const svgString = new XMLSerializer().serializeToString(svgElement);

      return new Promise((resolve) => {
        const handleMessage = (e) => {
          workerRef.current?.removeEventListener('message', handleMessage);

          if (!activeRef.current) {
            // Component unmounted while waiting — clean up silently
            resolve(false);
            return;
          }

          if (e.data.success) {
            const url = URL.createObjectURL(e.data.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = e.data.filename;
            a.click();
            // Revoke after a short delay to ensure download starts
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            resolve(true);
          } else {
            console.warn('[QR Worker] fallback triggered:', e.data.error);
            resolve(false);
          }
        };

        const handleError = () => {
          workerRef.current?.removeEventListener('message', handleMessage);
          workerRef.current?.removeEventListener('error', handleError);
          resolve(false);
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.addEventListener('error', handleError);
        workerRef.current.postMessage({ svgString, filename, scale });
      });
    } catch {
      return false;
    }
  }, []);

  return { exportToPng };
};
