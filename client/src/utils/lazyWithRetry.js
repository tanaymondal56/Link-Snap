/**
 * Wraps dynamic React component imports with automatic retries and exponential backoff
 * to prevent transient cellular/network dropouts from crashing the React app shell.
 *
 * @param {Function} componentImport - e.g. () => import('./pages/MyPage')
 * @param {number} [retriesLeft=2] - Number of retry attempts
 * @param {number} [interval=1000] - Interval between retries in ms
 * @returns {Promise<{ default: React.ComponentType }>}
 */
export function lazyWithRetry(componentImport, retriesLeft = 2, interval = 1000) {
  return new Promise((resolve, reject) => {
    componentImport()
      .then(resolve)
      .catch((error) => {
        // If strictly offline or retries exhausted, reject immediately
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          reject(error);
          return;
        }

        if (retriesLeft === 0) {
          reject(error);
          return;
        }

        setTimeout(() => {
          lazyWithRetry(componentImport, retriesLeft - 1, interval * 1.5)
            .then(resolve)
            .catch(reject);
        }, interval);
      });
  });
}

export default lazyWithRetry;
