import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
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
  MessageSquare,
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

const Changelog = () => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, major, minor, patch, initial
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const searchInputRef = useRef(null);

  // Fetch changelogs (reusable — avoids full page reload)
  const fetchChangelogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all changelogs (max 50 per page - sufficient for most cases)
      const { data } = await api.get('/changelog?limit=50');
      // Handle new paginated response format
      const changelogsData = data.changelogs || data;
      // Map icon strings to components
      const processed = changelogsData.map((release) => ({
        ...release,
        icon: iconMap[release.icon] || Star,
      }));
      setReleases(processed);
    } catch (err) {
      console.error('Failed to fetch changelogs:', err);
      setError('Failed to load changelog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChangelogs();
  }, [fetchChangelogs]);

  // SEO: Set document title
  useEffect(() => {
    document.title = 'Changelog — Link Snap';
    // Set meta description
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', 'Follow the evolution of Link Snap. Every feature, improvement, and milestone documented.');
    }
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === '/' &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA' &&
        e.target.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter releases based on search query AND release type
  const filteredReleases = releases.filter((release) => {
    // Apply type filter
    if (filterType !== 'all' && release.type !== filterType) return false;

    // Apply search filter
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      release.version.toLowerCase().includes(query) ||
      release.title.toLowerCase().includes(query) ||
      (release.description && release.description.toLowerCase().includes(query)) ||
      release.changes.some((c) => c.text.toLowerCase().includes(query))
    );
  });

  // Stats
  const totalChanges = releases.reduce((sum, r) => sum + r.changes.length, 0);
  const totalFeatures = releases.reduce(
    (sum, r) => sum + r.changes.filter((c) => c.type === 'feature').length,
    0
  );
  const totalFixes = releases.reduce(
    (sum, r) => sum + r.changes.filter((c) => c.type === 'fix').length,
    0
  );

  // Release type counts (for filter chips)
  const typeCounts = {
    all: releases.length,
    major: releases.filter((r) => r.type === 'major').length,
    minor: releases.filter((r) => r.type === 'minor').length,
    patch: releases.filter((r) => r.type === 'patch').length,
    initial: releases.filter((r) => r.type === 'initial').length,
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'feature':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'improvement':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'fix':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'note':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'breaking':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'deprecated':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'feature':
        return 'New';
      case 'improvement':
        return 'Improved';
      case 'fix':
        return 'Fixed';
      case 'note':
        return 'Note';
      case 'breaking':
        return 'Breaking';
      case 'deprecated':
        return 'Removed';
      default:
        return type;
    }
  };

  const getVersionBadgeColor = (type) => {
    switch (type) {
      case 'major':
        return 'from-purple-500 to-pink-500';
      case 'minor':
        return 'from-blue-500 to-cyan-500';
      case 'initial':
        return 'from-amber-500 to-orange-500';
      case 'patch':
        return 'from-green-500 to-teal-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  // Filter chip styles
  const filterChipColors = {
    all: 'from-gray-500 to-gray-600',
    major: 'from-purple-500 to-pink-500',
    minor: 'from-blue-500 to-cyan-500',
    patch: 'from-green-500 to-teal-500',
    initial: 'from-amber-500 to-orange-500',
  };

  return (
    <LazyPullToRefresh onRefresh={fetchChangelogs}>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Home</span>
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
        <main className="relative z-10 max-w-4xl mx-auto px-4 py-12">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Changelog
              </span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Follow the evolution of Link Snap. Every feature, improvement, and milestone
              documented.
            </p>
          </div>

          {/* Stats Strip — only when loaded */}
          {!loading && !error && releases.length > 0 && (
            <div className="flex items-center justify-center gap-6 sm:gap-10 mb-8">
              <div className="text-center">
                <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{releases.length}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Releases</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{totalFeatures}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Features</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">{totalFixes}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Fixes</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{totalChanges}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Changes</p>
              </div>
            </div>
          )}

          {/* Roadmap Link Banner */}
          <div className="max-w-2xl mx-auto mb-8">
            <Link
              to="/roadmap"
              className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl hover:border-blue-500/40 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Rocket size={20} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">See What&apos;s Coming Next</h3>
                  <p className="text-sm text-gray-400">Check out our public roadmap</p>
                </div>
              </div>
              <ArrowLeft
                size={20}
                className="text-gray-400 rotate-180 group-hover:translate-x-1 transition-transform"
              />
            </Link>
          </div>

          {/* Search Bar + Filter Chips */}
          {!loading && !error && releases.length > 0 && (
            <div className="max-w-2xl mx-auto mb-12 space-y-4">
              {/* Search */}
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search versions, features..."
                  aria-label="Search changelog"
                  className="w-full pl-10 pr-16 py-3 bg-gray-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    aria-label="Clear search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                ) : (
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 font-mono pointer-events-none">
                    /
                  </kbd>
                )}
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {Object.entries(filterChipColors).map(([type, gradient]) => {
                  const count = typeCounts[type];
                  if (type !== 'all' && count === 0) return null; // Hide empty types
                  return (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        filterType === type
                          ? `bg-gradient-to-r ${gradient} text-white shadow-lg`
                          : 'bg-gray-800/50 text-gray-400 border border-white/5 hover:border-white/20 hover:text-gray-300'
                      }`}
                    >
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}{' '}
                      <span className={filterType === type ? 'text-white/70' : 'text-gray-600'}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Search results count */}
              {(searchQuery || filterType !== 'all') && (
                <p className="text-sm text-gray-500 text-center">
                  {filteredReleases.length} result{filteredReleases.length !== 1 ? 's' : ''} found
                  {searchQuery && filterType !== 'all' && (
                    <button
                      onClick={() => { setSearchQuery(''); setFilterType('all'); }}
                      className="ml-2 text-purple-400 hover:text-purple-300"
                    >
                      Clear all
                    </button>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="relative">
            {/* Timeline Line - hidden on mobile */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500 via-blue-500 to-transparent hidden sm:block" />

            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
                <p className="text-gray-400">Loading changelog...</p>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-20">
                <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
                <p className="text-gray-400 mb-4">{error}</p>
                <button
                  onClick={fetchChangelogs}
                  className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && releases.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <Sparkles className="w-10 h-10 text-purple-400 mb-4" />
                <p className="text-gray-400">No releases yet. Check back soon!</p>
              </div>
            )}

            {/* Search No Results */}
            {!loading && !error && releases.length > 0 && filteredReleases.length === 0 && (
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
                <p className="text-gray-400 mb-2">
                  No releases match{searchQuery && ` "${searchQuery}"`}
                  {filterType !== 'all' && ` in ${filterType}`}
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setFilterType('all'); }}
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Releases */}
            {!loading && !error && filteredReleases.length > 0 && (
              <div className="space-y-12">
                {filteredReleases.map((release, index) => (
                  <div
                    key={release._id || release.version}
                    className="relative pl-0 sm:pl-20"
                    style={{
                      animation: `fadeSlideUp 0.4s ease-out ${index * 0.06}s both`,
                    }}
                  >
                    {/* Timeline Dot - hidden on mobile */}
                    <div
                      className={`absolute left-6 w-5 h-5 rounded-full bg-gradient-to-r ${getVersionBadgeColor(release.type)} transform -translate-x-1/2 ring-4 ring-gray-950 hidden sm:block`}
                    />

                    {/* Release Card */}
                    <div className="bg-gray-900/50 backdrop-blur-sm border border-white/5 rounded-2xl p-4 sm:p-6 hover:border-white/10 transition-all duration-300">
                      {/* Header */}
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <div
                          className={`p-2 rounded-xl bg-gradient-to-r ${getVersionBadgeColor(release.type)}`}
                        >
                          <release.icon size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${getVersionBadgeColor(release.type)} text-white`}
                            >
                              v{release.version}
                            </span>
                            <span className="text-gray-500 text-sm">
                              {formatDate(release.date)}
                            </span>
                            {/* Latest badge on the first (newest) release */}
                            {index === 0 && filterType === 'all' && !searchQuery && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-cyan-500 text-white animate-pulse">
                                Latest
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl font-semibold text-white mt-1">{release.title}</h2>
                          {release.description && (
                            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
                              {release.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Changes List */}
                      <ul className="space-y-3">
                        {release.changes.map((change, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span
                              className={`w-20 px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(change.type)} shrink-0 mt-0.5 text-center flex justify-center`}
                            >
                              {getTypeLabel(change.type)}
                            </span>
                            <span className="text-gray-300 flex-1">{change.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Note with Feedback Button */}
          <div className="mt-16 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <Sparkles size={16} className="text-purple-400" />
              <span className="text-sm text-gray-400">More features coming soon! Stay tuned.</span>
            </div>

            {/* Feedback Button */}
            <div>
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-full text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/20 transition-all group"
              >
                <MessageSquare size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Share Your Feedback</span>
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/5 py-8 mt-12">
          <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
            <span className="group cursor-pointer">
              <span className="font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent inline group-hover:hidden">
                Link Snap
              </span>
              <span className="hidden group-hover:inline font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent animate-pulse">
                Tanay&apos;s Creation 🚀
              </span>
            </span>{' '}
            • Built with passion since November 2025
          </div>
        </footer>

        {/* Feedback Modal */}
        {showFeedbackModal && (
          <Suspense fallback={null}>
            <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
          </Suspense>
        )}

        {/* Entrance animation keyframes */}
        <style>{`
          @keyframes fadeSlideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </LazyPullToRefresh>
  );
};

export default Changelog;
