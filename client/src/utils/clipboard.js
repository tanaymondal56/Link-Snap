import showToast from './toastUtils';

/**
 * Copies text to the clipboard using modern navigator.clipboard with
 * seamless fallback to a temporary textarea + document.execCommand('copy')
 * for iOS WebViews, insecure origins, or restricted iframe contexts.
 *
 * @param {string} text - The text to copy
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.showToast=true] - Whether to display a toast notification
 * @param {string} [options.toastMessage='Copied to clipboard!'] - Custom toast message
 * @param {string} [options.errorMessage='Failed to copy to clipboard'] - Custom error message
 * @returns {Promise<boolean>} Resolves to true if successfully copied, false otherwise
 */
export async function copyToClipboard(text, options = {}) {
  const {
    showToast: notify = true,
    toastMessage = 'Copied to clipboard!',
    errorMessage = 'Failed to copy to clipboard',
  } = options;

  if (text === null || text === undefined) {
    return false;
  }

  const stringText = String(text);

  // 1. Try modern asynchronous Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(stringText);
      if (notify) {
        showToast.success(toastMessage);
      }
      return true;
    } catch (err) {
      // Permission denied or non-transient activation error; fall through to textarea fallback
      console.warn('[Clipboard] navigator.clipboard.writeText failed, falling back:', err);
    }
  }

  // 2. Fallback to hidden textarea with document.execCommand('copy')
  if (typeof document !== 'undefined') {
    const activeElement = document.activeElement;
    try {
      const textArea = document.createElement('textarea');
      textArea.value = stringText;
      
      // Prevent zooming and page scroll
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.setAttribute('aria-hidden', 'true');

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, stringText.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (activeElement && typeof activeElement.focus === 'function') {
        activeElement.focus();
      }

      if (successful) {
        if (notify) {
          showToast.success(toastMessage);
        }
        return true;
      }
    } catch (fallbackErr) {
      console.error('[Clipboard] Fallback copy failed:', fallbackErr);
    }
  }

  if (notify) {
    showToast.error(errorMessage);
  }
  return false;
}

/**
 * Safely reads text from clipboard with permissions check
 * @returns {Promise<string|null>}
 */
export async function readFromClipboard() {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch (err) {
      console.warn('[Clipboard] Failed to read from clipboard:', err);
      return null;
    }
  }
  return null;
}

export default copyToClipboard;
