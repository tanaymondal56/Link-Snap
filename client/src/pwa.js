import { registerSW } from 'virtual:pwa-register';

let updateSWFn = null;
let isRegistered = false;

/**
 * Initialize and register Service Worker immediately on app startup.
 * Guarantees that the PWA is installed and offline-capable without relying on lazy-loaded components.
 */
export const initPWA = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || isRegistered) return;
  isRegistered = true;

  try {
    updateSWFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New service worker ready, dispatching update notification');
        window.dispatchEvent(new CustomEvent('pwa-need-refresh'));

        const isStandalone =
          typeof window !== 'undefined' &&
          (window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: window-controls-overlay)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://'));

        // If standard browser tab (not standalone installed PWA), auto-activate the waiting worker
        // so that lazy chunk imports match the latest build assets without waiting for a manual prompt
        if (!isStandalone && updateSWFn) {
          console.log('[PWA] Standard browser mode detected - activating waiting service worker');
          updateSWFn(false);
        }
      },
      onNeedReload() {
        console.log('[PWA] Service worker updated and controlling clients');
        window.dispatchEvent(new CustomEvent('pwa-controller-changed'));
      },
      onOfflineReady() {
        console.log('[PWA] App precache complete - ready for offline usage');
        window.dispatchEvent(new CustomEvent('pwa-offline-ready'));
      },
      onRegistered(registration) {
        if (registration) {
          // Periodically check for updates every 60 seconds when online
          setInterval(() => {
            if (navigator.onLine) {
              registration.update().catch(() => {});
            }
          }, 60 * 1000);
        }
      },
      onRegisterError(err) {
        console.warn('[PWA] Service worker registration failed:', err);
      },
    });
  } catch (err) {
    console.warn('[PWA] registerSW error:', err);
  }
};

/**
 * Trigger immediate activation of the waiting service worker.
 */
export const updateAppServiceWorker = async (reloadPage = true) => {
  if (updateSWFn) {
    await updateSWFn(reloadPage);
  } else if (reloadPage && typeof window !== 'undefined') {
    window.location.reload();
  }
};
