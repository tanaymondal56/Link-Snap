import { useState, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Copy,
  Check,
  Share2,
  QrCode,
  Download,
  Mail,
  MessageCircle,
  Send,
} from 'lucide-react';
import copyToClipboard from '../../utils/clipboard';
import { downloadSvgAsPngSync } from '../../utils/qrExport';
import { ShareContext } from '../../context/ShareContext';

// LinkedIn custom SVG icon
const LinkedInIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

// Social share providers
const SHARE_CHANNELS = [
  {
    name: 'WhatsApp',
    icon: MessageCircle,
    color: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20',
    getUrl: (url, title) =>
      `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title ? title + ' - ' : ''}${url}`)}`,
  },
  {
    name: 'X (Twitter)',
    icon: Send,
    color: 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border-sky-500/20',
    getUrl: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title || 'Check this out on Link-Snap')}`,
  },
  {
    name: 'Telegram',
    icon: Send,
    color: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20',
    getUrl: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title || '')}`,
  },
  {
    name: 'LinkedIn',
    icon: LinkedInIcon,
    color: 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20',
    getUrl: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'Email',
    icon: Mail,
    color: 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/20',
    getUrl: (url, title, text) =>
      `mailto:?subject=${encodeURIComponent(title || 'Shared via Link-Snap')}&body=${encodeURIComponent(`${text ? text + '\n\n' : ''}${url}`)}`,
  },
];

export const ShareModal = ({ isOpen, onClose, data }) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setShowQR(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const url = data.url || (typeof window !== 'undefined' ? window.location.href : '');
  const title = data.title || 'Link-Snap';
  const text = data.text || '';

  const handleCopy = async () => {
    const success = await copyToClipboard(url, {
      showToast: true,
      toastMessage: 'Link copied to clipboard!',
    });
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('share-modal-qr-svg');
    if (!svg) return;
    downloadSvgAsPngSync(svg, `qr-share-${Date.now()}.png`, 3);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div
        data-modal-content
        className="relative w-full sm:max-w-md bg-gray-900/95 border border-gray-700/60 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] z-10 animate-modal-in overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Line */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Share Link</h3>
              <p className="text-xs text-gray-400 truncate max-w-[240px]">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Quick Copy Link Box */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Share URL
            </label>
            <div className="flex items-center gap-2 p-1.5 bg-gray-950/80 border border-gray-800 rounded-xl focus-within:border-purple-500/50 transition-colors">
              <input
                readOnly
                value={url}
                onClick={(e) => e.target.select()}
                className="flex-1 bg-transparent px-3 text-xs text-gray-200 outline-none select-all font-mono truncate"
              />
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all active:scale-95 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Social Channels Grid */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Send via
            </label>
            <div className="grid grid-cols-5 gap-2">
              {SHARE_CHANNELS.map((channel) => {
                const Icon = channel.icon;
                return (
                  <a
                    key={channel.name}
                    href={channel.getUrl(url, title, text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${channel.color}`}
                    title={`Share to ${channel.name}`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-medium leading-tight truncate w-full text-center">
                      {channel.name.split(' ')[0]}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Desktop-to-Mobile QR Handoff */}
          <div className="pt-2 border-t border-gray-800/80">
            <button
              onClick={() => setShowQR(!showQR)}
              className="w-full flex items-center justify-between p-2.5 bg-gray-800/40 hover:bg-gray-800/80 border border-gray-700/50 rounded-xl text-xs font-medium text-gray-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-purple-400" />
                <span>{showQR ? 'Hide QR Code' : 'Scan QR code on mobile'}</span>
              </span>
              <span className="text-gray-500 text-[11px]">{showQR ? 'Collapse' : 'Show'}</span>
            </button>

            {showQR && (
              <div className="mt-3 flex flex-col items-center justify-center p-4 bg-gray-950/90 border border-gray-800 rounded-2xl animate-fade-in">
                <div className="p-3 bg-white rounded-xl shadow-lg">
                  <QRCodeSVG
                    id="share-modal-qr-svg"
                    value={url}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2.5 text-center">
                  Point any smartphone camera to open instantly
                </p>
                <button
                  onClick={handleDownloadQR}
                  className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg transition-colors border border-gray-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save QR Image
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ShareModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shareData, setShareData] = useState(null);

  const share = useCallback(async (data = {}) => {
    const payload = {
      title: data.title || (typeof document !== 'undefined' ? document.title : 'Link-Snap'),
      text: data.text || '',
      url: data.url || (typeof window !== 'undefined' ? window.location.href : ''),
    };

    // 1. If native share is supported and available, try it first
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare(payload)
    ) {
      try {
        await navigator.share(payload);
        return { success: true, method: 'native' };
      } catch (err) {
        // User aborted the native dialog - treat as safe cancel, do not open fallback modal
        if (err.name === 'AbortError') {
          return { success: false, method: 'native', cancelled: true };
        }
        // If native share failed for any other reason, proceed to custom modal fallback
      }
    }

    // 2. Open rich custom in-app share modal
    setShareData(payload);
    setIsOpen(true);
    return { success: true, method: 'modal' };
  }, []);

  const closeShareModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <ShareContext.Provider value={{ share, closeShareModal }}>
      {children}
      <ShareModal isOpen={isOpen} onClose={closeShareModal} data={shareData} />
    </ShareContext.Provider>
  );
};

export default ShareModalProvider;
