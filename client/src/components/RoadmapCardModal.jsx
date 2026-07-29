import { useEffect } from 'react';
import {
  X,
  Clock,
  ThumbsUp,
  Tag,
  Star,
  Sparkles,
  Rocket,
  Shield,
  Zap,
  BarChart3,
  Link as LinkIcon,
  Bell,
  Bug,
  Gift,
  Flame,
  Heart,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Map icon names to actual Lucide components
const iconMap = {
  Sparkles,
  Rocket,
  Shield,
  Zap,
  BarChart3,
  LinkIcon,
  Bell,
  Bug,
  Star,
  Gift,
  Flame,
  Heart,
};

const changeTypeStyles = {
  feature: { emoji: '✨', label: 'Feature', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  improvement: { emoji: '⬆️', label: 'Improvement', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  fix: { emoji: '🐛', label: 'Fix', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  note: { emoji: '📝', label: 'Note', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  breaking: { emoji: '⚠️', label: 'Breaking', color: 'text-red-400', bg: 'bg-red-400/10' },
  deprecated: { emoji: '🗑️', label: 'Removed', color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const statusProgress = {
  idea: 10,
  planned: 30,
  'in-progress': 65,
  testing: 90,
  'coming-soon': 95
};

const RoadmapCardModal = ({ item, config, onClose, onUpvote, isVoting }) => {
  const { user } = useAuth();
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  if (!item) return null;

  const IconComponent = iconMap[item.icon] || Star;
  const progress = statusProgress[item.roadmapStatus] || 50;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Background Gradient */}
        <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${config.color} opacity-10 pointer-events-none`} />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-4 sm:p-8 sm:pb-6 overflow-y-auto custom-scrollbar relative z-10">
          
          {/* Status & Version Header */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${config.bgColor} border ${config.borderColor} ${config.textColor}`}>
              <span>{config.emoji}</span>
              {config.label}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/10">
              v{item.version}
            </span>
            {item.estimatedRelease && (
              <span className="px-3 py-1 rounded-full text-xs text-gray-300 flex items-center gap-1.5 bg-white/5 border border-white/10">
                <Clock className="w-3.5 h-3.5" />
                Target: {item.estimatedRelease}
              </span>
            )}
          </div>

          {/* Title & Icon */}
          <div className="flex items-start gap-4 mb-6">
            <div className={`p-3 sm:p-4 rounded-2xl bg-gradient-to-br ${config.color} shrink-0 shadow-lg`}>
              <IconComponent className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight">
                {item.title}
              </h2>
              {item.description && (
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-xs text-gray-400 mb-2 font-medium">
              <span>Estimated Progress</span>
              <span className={config.textColor}>{progress}%</span>
            </div>
            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${config.color} transition-all duration-1000 ease-out`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Upvote & Action Bar */}
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 mb-8 p-4 bg-white/5 border border-white/5 rounded-2xl">
            <button
              onClick={() => onUpvote(item._id, item.hasVoted)}
              disabled={isVoting || !user}
              className={`flex-1 sm:flex-none w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                item.hasVoted 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              } ${(isVoting || !user) ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <Flame className={`w-5 h-5 ${item.hasVoted ? 'animate-pulse' : ''}`} />
              <span>{item.hasVoted ? 'Upvoted!' : 'Upvote'}</span>
              <span className="ml-1 px-2 py-0.5 rounded-md bg-black/20 text-sm">
                {item.voteCount || 0}
              </span>
            </button>
            <div className="text-sm text-gray-400 flex-1 min-w-[200px]">
              {!user ? (
                <span className="text-amber-400/90 flex items-center gap-1.5"><Shield className="w-4 h-4" /> Login required to upvote</span>
              ) : (
                `Join ${item.voteCount || 0} others who want this feature!`
              )}
            </div>
          </div>

          {/* Changes / Updates List */}
          {item.changes && item.changes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-400" />
                Planned Updates
              </h3>
              <div className="space-y-3">
                {item.changes.map((change, idx) => {
                  const changeStyle = changeTypeStyles[change.type] || changeTypeStyles.note;
                  return (
                    <div 
                      key={idx} 
                      className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-gray-900/50 border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className={`mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg ${changeStyle.bg} shrink-0`}>
                        <span className="text-lg">{changeStyle.emoji}</span>
                      </div>
                      <div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${changeStyle.color} mb-1 block`}>
                          {changeStyle.label}
                        </span>
                        <span className="text-gray-300 text-sm sm:text-base leading-relaxed">
                          {change.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoadmapCardModal;
