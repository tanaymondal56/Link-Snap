import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, ShieldAlert, Copy, Check, X } from 'lucide-react';
import copyToClipboard from '../../utils/clipboard';
import { ExternalLinkContext } from '../../context/ExternalLinkContext';

export const ExternalLinkModal = ({ isOpen, onClose, url, onProceed }) => {
  const [copied, setCopied] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !url) return null;

  const getHostname = (target) => {
    try {
      return new URL(target).hostname;
    } catch {
      return target;
    }
  };
  const hostname = getHostname(url);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url, {
      showToast: true,
      toastMessage: 'External URL copied to clipboard',
    });
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpen = () => {
    if (rememberSession) {
      sessionStorage.setItem('ls_allow_external_links', 'true');
    }
    onProceed(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        data-modal-content
        className="relative w-full sm:max-w-md bg-gray-900/95 border border-gray-700/60 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] z-10 animate-modal-in overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 shrink-0" />

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Leaving Link-Snap
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Opening destination in external browser
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Domain Pill */}
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-800 text-amber-300 border border-gray-700">
              <ExternalLink className="w-3 h-3" />
              {hostname}
            </span>
          </div>

          {/* Full URL Box */}
          <div className="p-3 bg-gray-950/80 border border-gray-800 rounded-xl mb-4 font-mono text-xs text-gray-300 break-all select-all">
            {url}
          </div>

          {/* Remember session checkbox */}
          <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
              className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-xs text-gray-400">
              Don't ask again for external links during this session
            </span>
          </label>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleOpen}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Browser
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-xl transition-all border border-gray-700 active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 text-gray-400 hover:text-white text-sm font-medium transition-colors text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ExternalLinkProvider = ({ children }) => {
  const [modalState, setModalState] = useState({ isOpen: false, url: '' });

  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true
  );

  useEffect(() => {
    // Only intercept in installed PWA standalone mode
    if (!isStandalone) return;

    const handleGlobalClick = (e) => {
      // Find nearest anchor tag
      const anchor = e.target.closest('a');
      if (!anchor || !anchor.href) return;

      const href = anchor.getAttribute('href') || '';
      // Ignore in-page hashes, protocol schemes
      if (
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        href.startsWith('blob:')
      ) {
        return;
      }

      // Check if session bypass is enabled
      if (sessionStorage.getItem('ls_allow_external_links') === 'true') {
        return;
      }

      try {
        const targetUrl = new URL(anchor.href, window.location.origin);
        // If external domain and target is external or target="_blank"
        if (targetUrl.origin !== window.location.origin) {
          e.preventDefault();
          e.stopPropagation();
          setModalState({ isOpen: true, url: anchor.href });
        }
      } catch {
        // Safe ignore
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, [isStandalone]);

  const handleClose = useCallback(() => {
    setModalState({ isOpen: false, url: '' });
  }, []);

  const handleProceed = useCallback((targetUrl) => {
    if (typeof window !== 'undefined' && targetUrl) {
      try {
        const parsed = new URL(targetUrl, window.location.origin);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          window.open(parsed.href, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // Safe ignore
      }
    }
  }, []);

  const openExternalUrl = useCallback((url) => {
    if (!url || typeof window === 'undefined') return;

    try {
      const parsed = new URL(url, window.location.origin);
      // Reject dangerous protocols (e.g. javascript:)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return;
      }
      // If internal or same origin, open directly without leaving warning
      if (parsed.origin === window.location.origin) {
        window.open(parsed.href, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {
      return;
    }

    if (sessionStorage.getItem('ls_allow_external_links') === 'true' || !isStandalone) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setModalState({ isOpen: true, url });
  }, [isStandalone]);

  return (
    <ExternalLinkContext.Provider value={{ openExternalUrl }}>
      {children}
      <ExternalLinkModal
        isOpen={modalState.isOpen}
        url={modalState.url}
        onClose={handleClose}
        onProceed={handleProceed}
      />
    </ExternalLinkContext.Provider>
  );
};

export default ExternalLinkProvider;
