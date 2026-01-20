import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Rocket,
  Shield,
  Zap,
  BarChart3,
  Link as LinkIcon,
  Bell,
  Bug,
  Star,
  Gift,
  Flame,
  Heart,
  Loader2,
  AlertCircle,
  Clock,
  Target,
  CheckCircle2,
  Lightbulb,
  FlaskConical,
  MessageSquare,
  ChevronLeft,
} from 'lucide-react';
import LazyPullToRefresh from '../components/LazyPullToRefresh';
const FeedbackModal = lazy(() => import('../components/FeedbackModal'));
import api from '../api/axios';
import { formatDate } from '../utils/dateUtils';

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

// Status configuration
const statusConfig = {
  idea: {
    label: 'Ideas',
    emoji: '💡',
    icon: Lightbulb,
    color: 'from-gray-500 to-gray-600',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    textColor: 'text-gray-400',
    description: "Features we're considering",
  },
  planned: {
    label: 'Planned',
    emoji: '🎯',
    icon: Target,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    description: 'On the roadmap',
  },
  'in-progress': {
    label: 'In Progress',
    emoji: '🚧',
    icon: Clock,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    description: 'Currently being built',
  },
  testing: {
    label: 'Testing',
    emoji: '🧪',
    icon: FlaskConical,
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    description: 'In quality assurance',
  },
  'coming-soon': {
    label: 'Coming Soon',
    emoji: '🚀',
    icon: Rocket,
    color: 'from-green-500 to-teal-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400',
    description: 'Almost ready!',
  },
};

const changeTypeStyles = {
  feature: { emoji: '✨', label: 'Feature', color: 'text-emerald-400' },
  improvement: { emoji: '⬆️', label: 'Improvement', color: 'text-blue-400' },
  fix: { emoji: '🐛', label: 'Fix', color: 'text-amber-400' },
  note: { emoji: '📝', label: 'Note', color: 'text-purple-400' },
  breaking: { emoji: '⚠️', label: 'Breaking', color: 'text-red-400' },
  deprecated: { emoji: '🗑️', label: 'Removed', color: 'text-gray-400' },
};

const Roadmap = () => {
  const [roadmapData, setRoadmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const fetchRoadmap = async (page = 1) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const { data } = await api.get(`/changelog/roadmap?page=${page}&limit=20`);

      setRoadmapData((prev) => {
        if (page === 1) return data;
        // Merge items for pagination
        return {
          ...data,
          items: [...(prev?.items || []), ...data.items],
          // Keep the new counts/pagination info
          counts: data.counts,
          pagination: data.pagination,
        };
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch roadmap:', err);
      setError('Failed to load roadmap');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchRoadmap(1);
  }, []);

  const handleLoadMore = () => {
    if (roadmapData?.pagination?.hasMore) {
      fetchRoadmap(roadmapData.pagination.page + 1);
    }
  };

  // Filter items based on search and status
  const getFilteredItems = () => {
    if (!roadmapData) return [];

    let items = roadmapData.items || [];

    // Filter by status
    if (selectedStatus !== 'all') {
      items = items.filter((item) => item.roadmapStatus === selectedStatus);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.changes?.some((c) => c.text.toLowerCase().includes(query))
      );
    }

    return items;
  };

  const filteredItems = getFilteredItems();

  // Group filtered items by status for column view
  const groupedItems = {
    'coming-soon': filteredItems.filter((i) => i.roadmapStatus === 'coming-soon'),
    'in-progress': filteredItems.filter((i) => i.roadmapStatus === 'in-progress'),
    testing: filteredItems.filter((i) => i.roadmapStatus === 'testing'),
    planned: filteredItems.filter((i) => i.roadmapStatus === 'planned'),
    idea: filteredItems.filter((i) => i.roadmapStatus === 'idea'),
  };

  return (
    <LazyPullToRefresh onRefresh={() => fetchRoadmap(1)}>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-green-600/5 rounded-full blur-[100px]" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link
              to="/changelog"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Changelog</span>
            </Link>
            <Link
              to="/"
              className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
            >
              Link Snap
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 py-12">
          {/* Page Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
              <Rocket className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium">Public Roadmap</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                What's Coming Next
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              See what we're working on and what's planned for Link Snap. Features move from ideas
              to reality.
            </p>
          </div>

          {/* Search & Filter Bar */}
          {!loading &&
            !error &&
            roadmapData &&
            (roadmapData.total > 0 || roadmapData.items.length > 0) && (
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-10">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search roadmap..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => setSelectedStatus('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedStatus === 'all'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    All ({roadmapData.pagination?.totalItems || roadmapData.total || 0})
                  </button>
                  {Object.entries(statusConfig).map(([key, config]) => {
                    // Use new GLOBAL counts if available, fallback to grouped length (legacy/fallback)
                    const count = roadmapData.counts
                      ? roadmapData.counts[key]
                      : roadmapData.grouped[key]?.length || 0;

                    if (count === 0) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedStatus(key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                          selectedStatus === key
                            ? `${config.bgColor} ${config.textColor} border ${config.borderColor}`
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{config.emoji}</span>
                        <span>{config.label}</span>
                        <span className="opacity-60">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
              <p className="text-gray-400">Loading roadmap...</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
              <p className="text-gray-400 mb-4">{error}</p>
              <button
                onClick={() => fetchRoadmap(1)}
                className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading &&
            !error &&
            (!roadmapData ||
              (roadmapData.items.length === 0 && roadmapData.pagination?.totalItems === 0)) && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="p-4 rounded-full bg-purple-500/10 mb-4">
                  <CheckCircle2 className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
                <p className="text-gray-400 text-center max-w-md">
                  No upcoming features on the roadmap right now. Check back soon or view our
                  changelog to see what we've already shipped!
                </p>
                <Link
                  to="/changelog"
                  className="mt-6 px-5 py-2.5 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors font-medium"
                >
                  View Changelog
                </Link>
              </div>
            )}

          {/* No Search Results */}
          {!loading &&
            !error &&
            roadmapData &&
            roadmapData.items.length > 0 &&
            filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <svg
                  className="w-10 h-10 text-gray-500 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-gray-400 mb-2">No items match your search</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedStatus('all');
                  }}
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  Clear filters
                </button>
              </div>
            )}

          {/* Roadmap Items - Kanban Style */}
          {!loading && !error && filteredItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Show columns for non-empty statuses */}
              {Object.entries(groupedItems).map(([status, items]) => {
                if (items.length === 0) return null;
                const config = statusConfig[status];

                return (
                  <div key={status} className="flex flex-col">
                    {/* Column Header */}
                    <div
                      className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${config.bgColor} border ${config.borderColor}`}
                    >
                      <span className="text-lg">{config.emoji}</span>
                      <div>
                        <h3 className={`font-bold ${config.textColor}`}>{config.label}</h3>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                      {/* Show loaded count vs total count if distinct? For now just loaded items in column */}
                      <span
                        className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${config.bgColor} ${config.textColor}`}
                      >
                        {items.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-4">
                      {items.map((item) => {
                        const IconComponent = iconMap[item.icon] || Star;

                        return (
                          <div
                            key={item._id}
                            className="group bg-gray-900/40 backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:border-white/20 hover:bg-gray-900/60 hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-black/20"
                          >
                            {/* Header */}
                            <div className="flex items-start gap-3 mb-4">
                              <div
                                className={`p-2.5 rounded-xl bg-gradient-to-br ${config.color} shrink-0 shadow-lg`}
                              >
                                <IconComponent className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-gradient-to-r ${config.color} text-white shadow-sm`}
                                  >
                                    v{item.version}
                                  </span>

                                  {item.estimatedRelease && (
                                    <span className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                      <Clock className="w-3 h-3" />
                                      {/* Estimated release is usually text like "Q1 2025" or a date? Backend schema said 'String', so sticking to it unless it looks like a date. 
                                        Wait, the user sees text currently. If it IS a date string, format it. If it is free text "Q1", keep it. 
                                        Let's assume it might be a date string if the user entered one.
                                        Actually, let's play it safe and try to format IF it's a valid date, else show string. 
                                        formatDate handles invalid dates by returning original string. */}
                                      {formatDate(item.estimatedRelease) || item.estimatedRelease}
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-bold text-white text-base leading-snug group-hover:text-purple-200 transition-colors">
                                  {item.title}
                                </h4>
                              </div>
                            </div>

                            {/* Description */}
                            {item.description && (
                              <p className="text-gray-400/90 text-sm mb-4 leading-relaxed line-clamp-3 ml-1">
                                {item.description}
                              </p>
                            )}

                            {/* Changes Preview */}
                            <div className="space-y-2 bg-black/20 rounded-xl p-3 border border-white/5">
                              {item.changes?.slice(0, 4).map((change, idx) => {
                                const changeStyle =
                                  changeTypeStyles[change.type] || changeTypeStyles.note;
                                return (
                                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                                    <span className="shrink-0 mt-0.5 text-base">
                                      {changeStyle.emoji}
                                    </span>
                                    <span className="text-gray-300 leading-relaxed font-medium">
                                      {change.text}
                                    </span>
                                  </div>
                                );
                              })}
                              {item.changes?.length > 4 && (
                                <div className="pt-1 pl-1">
                                  <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
                                    +{item.changes.length - 4} more updates
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Button */}
          {!loading &&
            !error &&
            roadmapData?.pagination?.hasMore &&
            selectedStatus === 'all' &&
            !searchQuery && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Load More Items</span>
                      <div className="px-2 py-0.5 rounded-full bg-white/10 text-xs">
                        {(roadmapData.pagination.totalItems || 0) -
                          (roadmapData.items?.length || 0)}{' '}
                        remaining
                      </div>
                    </>
                  )}
                </button>
              </div>
            )}

          {/* Footer Note with Feedback Button */}
          <div className="mt-16 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <Sparkles size={16} className="text-purple-400" />
              <span className="text-sm text-gray-400">Your feedback shapes our roadmap!</span>
            </div>

            {/* Request Feature Button */}
            <div>
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-medium transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 group"
              >
                <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
                <span>Request a Feature</span>
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/5 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
            <Link
              to="/changelog"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← View Changelog
            </Link>
            <span className="mx-3">•</span>
            <span className="group cursor-pointer">
              <span className="font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent inline group-hover:hidden">
                Link Snap
              </span>
              <span className="hidden group-hover:inline font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent animate-pulse">
                Tanay&apos;s Creation 🚀
              </span>
            </span>
          </div>
        </footer>

        {/* Feedback Modal */}
        {showFeedbackModal && (
          <Suspense fallback={null}>
            <FeedbackModal
              isOpen={showFeedbackModal}
              onClose={() => setShowFeedbackModal(false)}
              defaultType="feature_request"
            />
          </Suspense>
        )}
      </div>
    </LazyPullToRefresh>
  );
};

export default Roadmap;
