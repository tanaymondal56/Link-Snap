import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, X, Link as LinkIcon, AlertTriangle, RefreshCw } from 'lucide-react';

const UnbanUserModal = ({ isOpen, onClose, onConfirm, user }) => {
  const [reenableLinks, setReenableLinks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  const resetState = useCallback(() => {
    setReenableLinks(true);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

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

  if (!isOpen || !user) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({ reenableLinks });
      resetState();
    } catch {
      // Keep modal open on error, just stop submitting
      setIsSubmitting(false);
    }
  };

  // Check if user had links disabled when banned
  const hadLinksDisabled = user.disableLinksOnBan !== false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl shadow-green-500/10 animate-modal-in overflow-hidden">
        {/* Gradient top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="p-4 bg-green-500/20 rounded-2xl ring-4 ring-gray-800">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white text-center mb-2">Activate User</h3>

          {/* User Info */}
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm font-bold text-white">
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

          {/* Info */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-green-200 text-xs">
                This user will regain full access to their account and be able to login again.
              </p>
            </div>
          </div>

          {/* Link Re-enable Toggle - Only show if user had links disabled */}
          {hadLinksDisabled && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setReenableLinks(!reenableLinks)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                  reenableLinks
                    ? 'bg-green-500/10 border-green-500/40 hover:border-green-500/60'
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      reenableLinks ? 'bg-green-500/20' : 'bg-gray-700/50'
                    }`}
                  >
                    <RefreshCw
                      className={`w-4 h-4 transition-colors ${
                        reenableLinks ? 'text-green-400' : 'text-gray-400'
                      }`}
                    />
                  </div>
                  <div className="text-left">
                    <p
                      className={`text-sm font-medium transition-colors ${
                        reenableLinks ? 'text-green-300' : 'text-white'
                      }`}
                    >
                      Re-enable User's Links
                    </p>
                    <p className="text-gray-400 text-xs">
                      {reenableLinks
                        ? 'Short links will start redirecting again'
                        : 'Short links will stay disabled'}
                    </p>
                  </div>
                </div>
                {/* Toggle Switch */}
                <div
                  className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                    reenableLinks ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                      reenableLinks ? 'left-6' : 'left-1'
                    }`}
                  />
                </div>
              </button>
              {/* Status indicator */}
              {!reenableLinks && (
                <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-yellow-200 text-xs">
                      Links will remain disabled. The user will need an admin to manually re-enable
                      them later.
                    </p>
                  </div>
                </div>
              )}
              {reenableLinks && (
                <p className="text-xs mt-2 text-center text-green-400">
                  ✓ Links will be re-enabled when activated
                </p>
              )}
            </div>
          )}

          {/* If links were not disabled, show info */}
          {!hadLinksDisabled && (
            <div className="mb-6 bg-gray-800/50 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700/50 rounded-lg">
                  <LinkIcon className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-300 text-sm font-medium">Links were not disabled</p>
                  <p className="text-gray-500 text-xs">
                    This user's links were kept active during the ban
                  </p>
                </div>
              </div>
            </div>
          )}

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
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Activate User
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnbanUserModal;
