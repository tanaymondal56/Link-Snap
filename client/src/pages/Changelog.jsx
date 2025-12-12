import { useState, useEffect } from 'react';
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
import PullToRefresh from '../components/PullToRefresh';
import FeedbackModal from '../components/FeedbackModal';
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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  useEffect(() => {
    const fetchChangelogs = async () => {
      try {
        setLoading(true);
        // Fetch all changelogs (max 50 per page - sufficient for most cases)
        const { data } = await api.get('/changelog?limit=50');
        // Handle new paginated response format
        const changelogsData = data.changelogs || data;
        // Map icon strings to components
        const processed = changelogsData.map(release => ({
          ...release,
          icon: iconMap[release.icon] || Star,
        }));
        setReleases(processed);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch changelogs:', err);
        setError('Failed to load changelog');
      } finally {
        setLoading(false);
      }
    };

    fetchChangelogs();
  }, []);

  // Filter releases based on search query
  const filteredReleases = releases.filter(release => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      release.version.toLowerCase().includes(query) ||
      release.title.toLowerCase().includes(query) ||
      release.changes.some(c => c.text.toLowerCase().includes(query))
    );
  });

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

  return (
    <PullToRefresh onRefresh={() => window.location.reload()}>
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
            Follow the evolution of Link Snap. Every feature, improvement, and milestone documented.
          </p>
        </div>
        
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
                <h3 className="font-semibold text-white">See What's Coming Next</h3>
                <p className="text-sm text-gray-400">Check out our public roadmap</p>
              </div>
            </div>
            <ArrowLeft size={20} className="text-gray-400 rotate-180 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Search Bar */}
        {!loading && !error && releases.length > 0 && (
          <div className="max-w-md mx-auto mb-12">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search versions, features..."
                className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                {filteredReleases.length} result{filteredReleases.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500 via-blue-500 to-transparent" />

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
                onClick={() => window.location.reload()}
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
              <svg className="w-10 h-10 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-400 mb-2">No releases match "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Releases */}
          {!loading && !error && filteredReleases.length > 0 && (
          <div className="space-y-12">
            {filteredReleases.map((release) => (
              <div key={release._id || release.version} className="relative pl-20">
                {/* Timeline Dot */}
                <div
                  className={`absolute left-6 w-5 h-5 rounded-full bg-gradient-to-r ${getVersionBadgeColor(release.type)} transform -translate-x-1/2 ring-4 ring-gray-950`}
                />

                {/* Release Card */}
                <div className="bg-gray-900/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all duration-300">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div
                      className={`p-2 rounded-xl bg-gradient-to-r ${getVersionBadgeColor(release.type)}`}
                    >
                      <release.icon size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">

                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${getVersionBadgeColor(release.type)} text-white`}
                        >
                          v{release.version}
                        </span>
                        <span className="text-gray-500 text-sm">{formatDate(release.date)}</span>
                      </div>
                      <h2 className="text-xl font-semibold text-white mt-1">{release.title}</h2>
                    </div>
                  </div>

                  {/* Changes List */}
                  <ul className="space-y-3">
                    {release.changes.map((change, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(change.type)} shrink-0 mt-0.5`}
                        >
                          {getTypeLabel(change.type)}
                        </span>
                        <span className="text-gray-300">{change.text}</span>
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
      <FeedbackModal 
        isOpen={showFeedbackModal} 
        onClose={() => setShowFeedbackModal(false)} 
      />
    </div>
    </PullToRefresh>
  );
};

export default Changelog;
