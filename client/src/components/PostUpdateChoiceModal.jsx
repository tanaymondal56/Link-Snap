import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Home, FileText, PartyPopper } from 'lucide-react';
import {
  APP_VERSION,
  shouldShowChangelog,
  setShowChangelogAfterUpdate,
  markChangelogAsSeen,
} from '../config/version';

// Check once on module load to avoid effect-based setState
const shouldShowOnLoad = shouldShowChangelog();
if (shouldShowOnLoad) {
  // Clear the flag immediately so it doesn't show again on refresh
  setShowChangelogAfterUpdate(false);
}

const PostUpdateChoiceModal = () => {
  const [show, setShow] = useState(shouldShowOnLoad);
  const navigate = useNavigate();

  const handleOpenApp = () => {
    // User chose to continue to app - mark changelog as seen
    markChangelogAsSeen();
    setShow(false);
  };

  const handleSeeChangelog = () => {
    // User chose to see changelog
    setShow(false);
    navigate('/changelog');
  };

  if (!show) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]" />

      {/* Choice modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999]">
        <div className="w-full max-w-sm bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl shadow-2xl shadow-emerald-500/30 border border-emerald-400/20 overflow-hidden animate-in zoom-in-95 duration-300">
          {/* Confetti decoration */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
            <div
              className="absolute top-2 left-4 w-2 h-2 bg-yellow-400 rounded-full opacity-60 animate-bounce"
              style={{ animationDelay: '0.1s' }}
            />
            <div
              className="absolute top-6 right-8 w-1.5 h-1.5 bg-pink-400 rounded-full opacity-60 animate-bounce"
              style={{ animationDelay: '0.3s' }}
            />
            <div
              className="absolute top-4 left-1/3 w-1 h-1 bg-blue-400 rounded-full opacity-60 animate-bounce"
              style={{ animationDelay: '0.5s' }}
            />
            <div
              className="absolute top-8 right-1/4 w-2 h-2 bg-purple-400 rounded-full opacity-60 animate-bounce"
              style={{ animationDelay: '0.2s' }}
            />
          </div>

          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 border-b border-white/10 relative">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <PartyPopper className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Update Complete!</h2>
              <p className="text-white/60 text-xs">You&apos;re now on v{APP_VERSION}</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-5 relative">
            {/* Success message */}
            <div className="bg-white/10 rounded-xl p-4 mb-5 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <p className="text-white/90 text-sm leading-relaxed">
                Link Snap has been updated successfully with new features and improvements!
              </p>
            </div>

            {/* Choice buttons */}
            <div className="space-y-3">
              <button
                onClick={handleOpenApp}
                className="w-full px-4 py-3.5 rounded-xl bg-white text-teal-600 text-sm font-bold hover:bg-white/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-black/20"
              >
                <Home className="w-4 h-4" />
                Continue to App
              </button>

              <button
                onClick={handleSeeChangelog}
                className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 border border-white/20"
              >
                <FileText className="w-4 h-4" />
                See What&apos;s New
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PostUpdateChoiceModal;
