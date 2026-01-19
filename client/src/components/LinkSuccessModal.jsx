import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ExternalLink, Copy, Download, Sparkles, PartyPopper, Link as LinkIcon } from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';

import showToast from '../utils/toastUtils';
import { getShortUrl } from '../utils/urlHelper';
import { useScrollLock } from '../hooks/useScrollLock';

const LinkSuccessModal = ({ isOpen, onClose, linkData }) => {

  const [copiedId, setCopiedId] = useState(null);

  // Scroll Lock
  useScrollLock(isOpen);

  if (!isOpen || !linkData) return null;

  const randomUrl = getShortUrl(linkData.shortId);
  const customUrl = linkData.customAlias ? getShortUrl(linkData.customAlias) : null;


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
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm bg-gray-900/80">
      {/* Modal */}
      <div 
        data-modal-content
        className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl animate-modal-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Header with Confetti Effect */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-transparent p-6 pb-4 border-b border-gray-800">
          {/* Background Sparkle Effect */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-2 left-4 text-yellow-400 animate-pulse"><Sparkles size={12} /></div>
            <div className="absolute top-8 right-8 text-emerald-400 animate-pulse delay-100"><Sparkles size={10} /></div>
            <div className="absolute bottom-4 left-12 text-green-400 animate-pulse delay-200"><Sparkles size={8} /></div>
            <div className="absolute top-4 right-16 text-lime-400 animate-pulse delay-300"><Sparkles size={10} /></div>
          </div>
          
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <PartyPopper size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Link Created!</h2>
              <p className="text-sm text-emerald-300/80">Your short link is ready to share</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Main Link Section */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* QR Code */}
            <div
              id="qr-random"
              className="bg-white p-3 rounded-xl shadow-lg shrink-0"
            >
              <QRCodeSVG value={customUrl || randomUrl} size={100} level="H" />
            </div>

            {/* Link Info */}
            <div className="flex-1 w-full text-center sm:text-left">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Your Short Link</p>
              <p className="text-lg font-mono font-semibold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent break-all">
                {customUrl || randomUrl}
              </p>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                <button
                  onClick={() => copyToClipboard(customUrl || randomUrl, 'main')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    copiedId === 'main' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`}
                >
                  {copiedId === 'main' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedId === 'main' ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={customUrl || randomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink size={14} />
                  Open
                </a>
                <button
                  onClick={() => downloadQR('qr-random', `qr-${linkData.customAlias || linkData.shortId}.png`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={14} />
                  QR
                </button>
              </div>
            </div>
          </div>

          {/* Show original shortId if custom alias is set */}
          {customUrl && (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Original ID</p>
                  <p className="text-sm font-mono text-gray-400">{randomUrl}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(randomUrl, 'original')}
                  className={`p-2 rounded-lg transition-colors ${
                    copiedId === 'original' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {copiedId === 'original' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Redirects To */}
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon size={14} className="text-gray-500" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Redirects to</p>
            </div>
            <p className="text-gray-300 text-sm break-all leading-relaxed">{linkData.originalUrl}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LinkSuccessModal;
