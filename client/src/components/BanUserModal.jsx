import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Ban,
  X,
  Link as LinkIcon,
  MessageSquare,
  AlertTriangle,
  Clock,
  ChevronDown,
} from 'lucide-react';
import useScrollLock from '../hooks/useScrollLock';

// Ban reason templates
const REASON_TEMPLATES = [
  { label: 'Select a reason...', value: '' },
  {
    label: 'Spam or promotional content',
    value: 'Violation: Spam or promotional content detected',
  },
  {
    label: 'Malicious/phishing links',
    value: 'Violation: Distribution of malicious or phishing links',
  },
  { label: 'Terms of Service violation', value: 'Violation: Terms of Service violation' },
  { label: 'Abuse of service', value: 'Violation: Abuse of service detected' },
  { label: 'Inappropriate content', value: 'Violation: Inappropriate or offensive content' },
  { label: 'Fraudulent activity', value: 'Violation: Fraudulent or deceptive activity' },
  { label: 'Custom reason', value: 'custom' },
];

// Ban duration options
const DURATION_OPTIONS = [
  { label: 'Permanent', value: 'permanent', description: 'Ban indefinitely' },
  { label: '1 Hour', value: '1h', description: 'Temporary ban' },
  { label: '24 Hours', value: '24h', description: 'One day ban' },
  { label: '7 Days', value: '7d', description: 'One week ban' },
  { label: '30 Days', value: '30d', description: 'One month ban' },
];

const BanUserModal = ({ isOpen, onClose, onConfirm, user }) => {
  const [reason, setReason] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [duration, setDuration] = useState('permanent');
  const [disableLinks, setDisableLinks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setReason('');
    setSelectedTemplate('');
    setShowCustomReason(false);
    setDuration('permanent');
    setDisableLinks(true);
    onClose();
  }, [onClose]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, handleClose]);

  // Handle template selection
  const handleTemplateChange = (value) => {
    setSelectedTemplate(value);
    if (value === 'custom') {
      setShowCustomReason(true);
      setReason('');
    } else if (value) {
      setShowCustomReason(false);
      setReason(value);
    } else {
      setShowCustomReason(false);
      setReason('');
    }
  };

  // Lock background scroll
  useScrollLock(isOpen);

  if (!isOpen || !user) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({ reason, disableLinks, duration });
      setReason('');
      setSelectedTemplate('');
      setShowCustomReason(false);
      setDuration('permanent');
      setDisableLinks(true);
    } catch {
      // Keep modal open on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDuration = DURATION_OPTIONS.find((d) => d.value === duration);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div data-modal-content className="relative w-[95%] max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] overscroll-contain">
        {/* Gradient top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-5 md:p-6 pt-8 overflow-y-auto custom-scrollbar">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="p-4 bg-orange-500/20 rounded-2xl ring-4 ring-gray-800">
              <Ban className="w-8 h-8 text-orange-400" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white text-center mb-2">Ban User</h3>

          {/* User Info */}
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold text-white">
              {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium text-sm">{user.email}</p>
              {(user.firstName || user.lastName) && (
                <p className="text-gray-400 text-xs">
                  {user.firstName} {user.lastName}
                </p>
              )}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <p className="text-orange-200 text-xs">
                This user will be immediately logged out and blocked from accessing their account.
              </p>
            </div>
          </div>

          {/* Ban Duration Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-2 text-gray-400" />
              Ban Duration
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    duration === opt.value
                      ? opt.value === 'permanent'
                        ? 'bg-red-500/20 border-red-500/50 text-red-300 border'
                        : 'bg-orange-500/20 border-orange-500/50 text-orange-300 border'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 border hover:border-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedDuration?.description}
              {duration !== 'permanent' &&
                ' - User will be automatically unbanned after this period'}
            </p>
          </div>

          {/* Reason Template Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-2 text-gray-400" />
              Ban Reason
            </label>
            <div className="relative">
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none cursor-pointer text-sm"
              >
                {REASON_TEMPLATES.map((template) => (
                  <option key={template.value} value={template.value} className="bg-gray-800">
                    {template.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Custom Reason Input */}
          {showCustomReason && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Custom Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the reason for this ban..."
                className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none text-sm"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">{reason.length}/500</p>
            </div>
          )}

          {/* Link Disable Toggle */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setDisableLinks(!disableLinks)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                disableLinks
                  ? 'bg-orange-500/10 border-orange-500/40 hover:border-orange-500/60'
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg transition-colors ${
                    disableLinks ? 'bg-orange-500/20' : 'bg-gray-700/50'
                  }`}
                >
                  <LinkIcon
                    className={`w-4 h-4 transition-colors ${
                      disableLinks ? 'text-orange-400' : 'text-gray-400'
                    }`}
                  />
                </div>
                <div className="text-left">
                  <p
                    className={`text-sm font-medium transition-colors ${
                      disableLinks ? 'text-orange-300' : 'text-white'
                    }`}
                  >
                    Disable User's Links
                  </p>
                  <p className="text-gray-400 text-xs">
                    {disableLinks
                      ? 'Short links will stop redirecting'
                      : 'Short links will remain active'}
                  </p>
                </div>
              </div>
              {/* Toggle Switch */}
              <div
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                  disableLinks ? 'bg-orange-500' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                    disableLinks ? 'left-6' : 'left-1'
                  }`}
                />
              </div>
            </button>
            {/* Status indicator text */}
            <p
              className={`text-xs mt-2 text-center transition-colors ${
                disableLinks ? 'text-orange-400' : 'text-gray-500'
              }`}
            >
              {disableLinks ? '⚠️ Links will be disabled when banned' : '✓ Links will stay active'}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 border border-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Banning...
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  {duration === 'permanent'
                    ? 'Ban User'
                    : `Ban for ${DURATION_OPTIONS.find((d) => d.value === duration)?.label}`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BanUserModal;
