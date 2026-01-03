import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Link as LinkIcon, Sparkles, Check, ExternalLink, Copy, Download, AlertTriangle, Clock } from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';

import showToast from '../components/ui/Toast';
import { getShortUrl } from '../utils/urlHelper';
import { useScrollLock } from '../hooks/useScrollLock';

const LinkSuccessModal = ({ isOpen, onClose, linkData }) => {

  const [copiedId, setCopiedId] = useState(null);

  // Scroll Lock
  useScrollLock(isOpen);

  if (!isOpen || !linkData) return null;

  const randomUrl = getShortUrl(linkData.shortId);


  const copyToClipboard = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast.success('Link copied to clipboard!', 'Copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadQR = (elementId, filename) => {
    const svg = document.querySelector(`#${elementId} svg`);
    if (!svg) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = filename;
      downloadLink.click();
    };
    img.src = url;
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      <div 
        className="flex min-h-full items-start justify-center p-4 sm:items-center sm:pt-4"
        style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        {/* Modal - Allowed to grow */}
        <div className="relative w-full max-w-2xl bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl animate-modal-in flex flex-col my-8">
              {/* QR Code */}
              <div
                id="qr-random"
                className="bg-white p-3 rounded-xl shadow-lg self-center sm:self-start"
              >
                <QRCodeSVG value={randomUrl} size={120} level="H" />
              </div>

              {/* Link Info & Actions */}
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Short URL</p>
                  <p className="text-blue-400 font-mono text-lg font-medium break-all">
                    {randomUrl}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copyToClipboard(randomUrl, 'random')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
                  >
                    {copiedId === 'random' ? <Check size={16} /> : <Copy size={16} />}
                    Copy
                  </button>
                  <a
                    href={randomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                  >
                    <ExternalLink size={16} />
                    Open
                  </a>
                  <button
                    onClick={() => downloadQR('qr-random', `qr-${linkData.shortId}.png`)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    <Download size={16} />
                    QR
                  </button>
                </div>
              </div>


          {/* Original URL Info */}
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
            <p className="text-xs text-gray-500 mb-1">Redirects to</p>
            <p className="text-gray-300 text-sm break-all">{linkData.originalUrl}</p>
  
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-700/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl transition-all font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
    </div>,
    document.body
  );
};

export default LinkSuccessModal;
