import { useState } from 'react';
import { X, Link as LinkIcon, Sparkles, Check, ExternalLink, Copy, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import showToast from '../components/ui/Toast';
import { getShortUrl } from '../utils/urlHelper';

const LinkSuccessModal = ({ isOpen, onClose, linkData }) => {
  const [copiedId, setCopiedId] = useState(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl animate-modal-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700/50 sticky top-0 bg-gray-900/95 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Check size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Link Created Successfully!</h2>
              <p className="text-sm text-gray-400">
                {linkData.title || 'Your link is ready to share'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Custom Alias Link (if exists) - Show First */}
          {customUrl && (
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-5 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Custom Alias</span>
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                  Primary
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {/* QR Code */}
                <div
                  id="qr-custom"
                  className="bg-white p-3 rounded-xl shadow-lg self-center sm:self-start"
                >
                  <QRCodeSVG value={customUrl} size={120} level="H" />
                </div>

                {/* Link Info & Actions */}
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Short URL</p>
                    <p className="text-purple-400 font-mono text-lg font-medium break-all">
                      {customUrl}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => copyToClipboard(customUrl, 'custom')}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
                    >
                      {copiedId === 'custom' ? <Check size={16} /> : <Copy size={16} />}
                      Copy
                    </button>
                    <a
                      href={customUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                    >
                      <ExternalLink size={16} />
                      Open
                    </a>
                    <button
                      onClick={() => downloadQR('qr-custom', `qr-${linkData.customAlias}.png`)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      <Download size={16} />
                      QR
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Random ID Link */}
          <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon size={18} className="text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Random Short ID</span>
              {!customUrl && (
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                  Primary
                </span>
              )}
              {customUrl && (
                <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                  Backup
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
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
            </div>
          </div>

          {/* Original URL Info */}
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
            <p className="text-xs text-gray-500 mb-1">Redirects to</p>
            <p className="text-gray-300 text-sm break-all">{linkData.originalUrl}</p>
          </div>
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
  );
};

export default LinkSuccessModal;
