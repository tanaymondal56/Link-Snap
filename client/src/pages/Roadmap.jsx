import { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router';
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
  LayoutGrid,
  List,
  Users,
  Maximize2
} from 'lucide-react';
import LazyPullToRefresh from '../components/LazyPullToRefresh';
import RoadmapCardModal from '../components/RoadmapCardModal';
const FeedbackModal = lazy(() => import('../components/FeedbackModal'));
import api from '../api/axios';
import { formatDate } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Map icon names to actual Lucide components
const iconMap = {
  Sparkles, Rocket, Shield, Zap, BarChart3, LinkIcon, Bell, Bug, Star, Gift, Flame, Heart,
};

// Status configuration
const statusConfig = {
  idea: {
    label: 'Ideas', emoji: '💡', icon: Lightbulb,
    color: 'from-gray-500 to-gray-600', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30', textColor: 'text-gray-400',
    description: "Features we're considering",
  },
  planned: {
    label: 'Planned', emoji: '🎯', icon: Target,
    color: 'from-purple-500 to-pink-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', textColor: 'text-purple-400',
    description: 'On the roadmap',
  },
  'in-progress': {
    label: 'In Progress', emoji: '🚧', icon: Clock,
    color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', textColor: 'text-blue-400',
    description: 'Currently being built',
  },
  testing: {
    label: 'Testing', emoji: '🧪', icon: FlaskConical,
    color: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', textColor: 'text-amber-400',
    description: 'In quality assurance',
  },
  'coming-soon': {
    label: 'Coming Soon', emoji: '🚀', icon: Rocket,
    color: 'from-green-500 to-teal-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', textColor: 'text-green-400',
    description: 'Almost ready!',
  },
};

const Roadmap = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('ls_roadmap_tab') || 'kanban';
  }); // kanban, timeline, ideas
  
  useEffect(() => {
    localStorage.setItem('ls_roadmap_tab', activeTab);
  }, [activeTab]);
  
  // Roadmap State
  const [roadmapData, setRoadmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  
  // Ideas State
  const [ideasData, setIdeasData] = useState(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasLoadingMore, setIdeasLoadingMore] = useState(false);
  const [ideasError, setIdeasError] = useState(null);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [votingId, setVotingId] = useState(null);

  const fetchRoadmap = async (page = 1) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const { data } = await api.get(`/changelog/roadmap?page=${page}&limit=20`);

      setRoadmapData((prev) => {
        if (page === 1) return data;
        return {
          ...data,
          items: [...(prev?.items || []), ...data.items],
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

  const fetchIdeas = async (page = 1) => {
    try {
      if (page === 1) setIdeasLoading(true);
      else setIdeasLoadingMore(true);
      
      const { data } = await api.get(`/feedback/public?page=${page}&limit=20&sort=newest`);
      
      setIdeasData((prev) => {
        if (page === 1) return data;
        return {
          ...data,
          items: [...(prev?.items || []), ...data.items],
          pagination: data.pagination,
        };
      });
      setIdeasError(null);
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      setIdeasError('Failed to load community ideas');
    } finally {
      setIdeasLoading(false);
      setIdeasLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchRoadmap(1);
    fetchIdeas(1);
  }, []);

  const handleLoadMore = () => {
    if (activeTab === 'ideas' && ideasData?.pagination?.hasMore) {
      fetchIdeas(ideasData.pagination.page + 1);
    } else if (roadmapData?.pagination?.hasMore) {
      fetchRoadmap(roadmapData.pagination.page + 1);
    }
  };
  
  const handleRefresh = async () => {
    if (activeTab === 'ideas') await fetchIdeas(1);
    else await fetchRoadmap(1);
  };

  const handleUpvoteRoadmap = async (id, currentVoted) => {
    if (!user) {
        return toast.error("Please log in to upvote features", {
            icon: '🔒',
            style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
    }
    if (votingId) return;
    try {
      setVotingId(id);
      const method = currentVoted ? 'delete' : 'post';
      const { data } = await api[method](`/changelog/roadmap/${id}/vote`);
      
      // Update local state for roadmap list
      setRoadmapData(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item._id === id 
            ? { ...item, voteCount: data.voteCount, hasVoted: data.hasVoted }
            : item
        )
      }));
      
      // Update modal state if open
      if (selectedItem && selectedItem._id === id) {
        setSelectedItem(prev => ({
          ...prev, voteCount: data.voteCount, hasVoted: data.hasVoted
        }));
      }
      
      toast.success(data.message);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update vote';
      toast.error(msg);
      // Ensure user is logged in check
      if (err.response?.status === 401) {
          // handled by axios interceptor usually, but good to have
      }
    } finally {
      setVotingId(null);
    }
  };
  
  const handleUpvoteIdea = async (id, currentVoted) => {
    if (!user) {
        return toast.error("Please log in to upvote ideas", {
            icon: '🔒',
            style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
    }
    if (votingId) return;
    try {
      setVotingId(id);
      const method = currentVoted ? 'delete' : 'post';
      const { data } = await api[method](`/feedback/${id}/vote`);
      
      // Update local state for ideas list
      setIdeasData(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item._id === id 
            ? { ...item, voteCount: data.voteCount, hasVoted: data.hasVoted }
            : item
        )
      }));
      
      toast.success(data.message);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update vote';
      toast.error(msg);
    } finally {
      setVotingId(null);
    }
  };

  // Filter roadmap items based on search and status
  const getFilteredItems = () => {
    if (!roadmapData) return [];
    let items = roadmapData.items || [];
    if (selectedStatus !== 'all') {
      items = items.filter((item) => item.roadmapStatus === selectedStatus);
    }
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

  // Group filtered items by status for Kanban view
  const groupedItems = {
    'coming-soon': filteredItems.filter((i) => i.roadmapStatus === 'coming-soon'),
    'in-progress': filteredItems.filter((i) => i.roadmapStatus === 'in-progress'),
    testing: filteredItems.filter((i) => i.roadmapStatus === 'testing'),
    planned: filteredItems.filter((i) => i.roadmapStatus === 'planned'),
    idea: filteredItems.filter((i) => i.roadmapStatus === 'idea'),
  };
  
  // Total upvotes for metrics header
  const totalVotes = roadmapData?.items?.reduce((acc, item) => acc + (item.voteCount || 0), 0) || 0;
  const shippedFeatures = 142; // Example static metric, could come from API in future

  // UI rendering helpers
  const renderKanban = () => {
    // Put non-empty columns first so mobile/desktop users immediately see content
    const sortedEntries = Object.entries(groupedItems).sort(([, itemsA], [, itemsB]) => {
      if (itemsA.length > 0 && itemsB.length === 0) return -1;
      if (itemsA.length === 0 && itemsB.length > 0) return 1;
      return 0;
    });

    return (
      <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar snap-x">
        {sortedEntries.map(([status, items]) => {
          const config = statusConfig[status];
          return (
            <div key={status} className="flex-none w-[320px] sm:w-[350px] snap-center flex flex-col h-full bg-gray-900/20 rounded-3xl p-4 border border-white/5">
              {/* Column Header */}
              <div className={`flex items-center gap-3 mb-5 p-3 rounded-2xl ${config.bgColor} border ${config.borderColor} backdrop-blur-md`}>
                <span className="text-2xl">{config.emoji}</span>
                <div>
                  <h3 className={`font-bold ${config.textColor} tracking-wide`}>{config.label}</h3>
                  <p className="text-xs text-gray-500 font-medium">{config.description}</p>
                </div>
                <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-bold ${config.bgColor} ${config.textColor} shadow-inner`}>
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[200px]">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50 py-10">
                    <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center border border-dashed ${config.borderColor}`}>
                       <config.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">No items yet</span>
                  </div>
                ) : (
                    items.map((item) => {
                      const IconComponent = iconMap[item.icon] || Star;
                      return (
                        <div
                          key={item._id}
                          onClick={() => setSelectedItem(item)}
                          className="group relative bg-gray-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-purple-500/30 hover:bg-gray-800/80 transition-all duration-300 shadow-lg shadow-black/20 cursor-pointer overflow-hidden active:scale-[0.99]"
                        >
                          <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${config.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
                          
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`p-2 rounded-xl bg-gradient-to-br ${config.color} shrink-0 shadow-lg`}>
                              <IconComponent className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <h4 className="font-bold text-white text-base leading-snug group-hover:text-purple-200 transition-colors line-clamp-2">
                                {item.title}
                              </h4>
                            </div>
                            {/* Visual Affordance Badge */}
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 opacity-80 group-hover:opacity-100 group-hover:text-purple-300 transition-all bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md shrink-0">
                              <span>Details</span>
                              <Maximize2 className="w-3 h-3" />
                            </div>
                          </div>

                          {item.description && (
                            <p className="text-gray-400 text-xs mb-4 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                              <div className="flex items-center gap-2">
                                  <button 
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpvoteRoadmap(item._id, item.hasVoted);
                                      }}
                                      disabled={votingId === item._id}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                          item.hasVoted 
                                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                                          : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white'
                                      } ${(!user) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                      title={!user ? "Login required to upvote" : "Upvote"}
                                  >
                                      <Flame className={`w-3.5 h-3.5 ${item.hasVoted ? 'fill-orange-400 animate-pulse' : ''} ${!user ? 'opacity-50' : ''}`} />
                                      {item.voteCount || 0}
                                  </button>
                              </div>
                              
                              {item.estimatedRelease && (
                                  <span className="text-[10px] text-gray-500 flex items-center gap-1 font-medium bg-gray-950 px-2 py-1 rounded-md">
                                      <Clock className="w-3 h-3" />
                                      {formatDate(item.estimatedRelease) || item.estimatedRelease}
                                  </span>
                              )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTimeline = () => (
    <div className="max-w-4xl mx-auto relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
        {filteredItems.map((item) => {
            const config = statusConfig[item.roadmapStatus] || statusConfig['planned'];
            const IconComponent = iconMap[item.icon] || Star;
            
            return (
                <div key={item._id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-12`}>
                    
                    {/* Icon / Marker */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-gray-950 bg-gradient-to-br ${config.color} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl shadow-black/50 z-10 cursor-pointer hover:scale-110 transition-transform`} onClick={() => setSelectedItem(item)}>
                        <IconComponent className="w-4 h-4 text-white" />
                    </div>
                    
                    {/* Content */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl bg-gray-900/50 backdrop-blur-sm border border-white/5 hover:border-white/20 transition-colors shadow-lg cursor-pointer group-hover:-translate-y-1 duration-300" onClick={() => setSelectedItem(item)}>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
                                {config.label}
                            </span>
                            {item.estimatedRelease && (
                                <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                                    {formatDate(item.estimatedRelease) || item.estimatedRelease}
                                </span>
                            )}
                        </div>
                        <h4 className="font-bold text-white text-lg mb-2 group-hover:text-purple-400 transition-colors">{item.title}</h4>
                        {item.description && (
                          <p className="text-gray-400 text-sm line-clamp-2 mb-4">{item.description}</p>
                        )}
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpvoteRoadmap(item._id, item.hasVoted);
                                }}
                                disabled={votingId === item._id}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                                    item.hasVoted 
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                                    : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white'
                                } ${(!user) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title={!user ? "Login required to upvote" : "Upvote"}
                            >
                                <Flame className={`w-4 h-4 ${item.hasVoted ? 'fill-orange-400 animate-pulse' : ''} ${!user ? 'opacity-50' : ''}`} />
                                {item.voteCount || 0}
                            </button>
                        </div>
                    </div>
                </div>
            );
        })}
    </div>
  );

  const renderCommunityIdeas = () => {
    if (ideasLoading && !ideasData) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
                <p className="text-gray-400">Loading community ideas...</p>
            </div>
        );
    }
    
    if (ideasError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
                <p className="text-gray-400 mb-4">{ideasError}</p>
                <button onClick={() => fetchIdeas(1)} className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">Retry</button>
            </div>
        )
    }
    
    if (!ideasData || ideasData.items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 rounded-full bg-purple-500/10 mb-4">
                  <Lightbulb className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Ideas Yet</h3>
                <p className="text-gray-400 max-w-md mx-auto mb-6">Be the first to suggest a new feature or improvement for Link Snap!</p>
                <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                >
                    Submit an Idea
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {ideasData.items.map(idea => (
                <div key={idea._id} className="flex flex-col sm:flex-row gap-4 p-5 rounded-2xl bg-gray-900/50 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex flex-row sm:flex-col items-center gap-2 sm:min-w-[80px]">
                        <button 
                            onClick={() => handleUpvoteIdea(idea._id, idea.hasVoted)}
                            disabled={votingId === idea._id}
                            className={`flex flex-row sm:flex-col items-center justify-center gap-1.5 w-full py-2 px-4 sm:px-2 rounded-xl transition-all border ${
                                idea.hasVoted 
                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
                                : 'bg-gray-950 text-gray-400 border-white/5 hover:border-white/20 hover:text-white'
                            } ${(votingId === idea._id || !user) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={!user ? "Login required to upvote" : "Upvote"}
                        >
                            <span className="text-sm font-bold">{idea.voteCount || 0}</span>
                            <Flame className={`w-4 h-4 ${idea.hasVoted ? 'fill-orange-400' : ''} ${!user ? 'opacity-50' : ''}`} />
                        </button>
                    </div>
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">{idea.type.replace('_', ' ')}</span>
                            {idea.status !== 'new' && (
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md">{idea.status}</span>
                            )}
                        </div>
                        <h4 className="text-xl font-bold text-white mb-2">{idea.title}</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">{idea.message}</p>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  return (
    <LazyPullToRefresh onRefresh={handleRefresh}>
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
              <span className="hidden sm:inline">Back to Changelog</span>
            </Link>
            <Link
              to="/"
              className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
            >
              Link Snap
            </Link>
            <button
                onClick={() => setShowFeedbackModal(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
                <Lightbulb size={16} />
                Submit Idea
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 py-12">
          {/* Page Title & Metrics Header */}
          <div className="mb-12">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-10">
                <div className="text-center lg:text-left">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                        <Rocket className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-400 font-medium">Public Roadmap</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                            What's Coming Next
                        </span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto lg:mx-0">
                        See what we're working on, track our progress, and help shape the future of Link Snap by upvoting ideas.
                    </p>
                    <div className="mt-5 flex justify-center lg:justify-start sm:hidden">
                        <button
                            onClick={() => setShowFeedbackModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white text-sm font-semibold shadow-lg shadow-purple-500/25 active:scale-95 transition-all"
                        >
                            <Lightbulb size={16} />
                            Submit an Idea
                        </button>
                    </div>
                </div>
                
                {/* Metrics Cards */}
                <div className="flex gap-4 w-full lg:w-auto">
                    <div className="flex-1 bg-gray-900/50 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center mb-2">
                            <Flame size={20} />
                        </div>
                        <span className="text-3xl font-bold text-white mb-1">{totalVotes}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Total Upvotes</span>
                    </div>
                    <div className="flex-1 bg-gray-900/50 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center mb-2">
                            <Rocket size={20} />
                        </div>
                        <span className="text-3xl font-bold text-white mb-1">{shippedFeatures}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Features Shipped</span>
                    </div>
                </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center justify-center mb-10">
                <div className="inline-flex p-1.5 bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl">
                    <button
                        onClick={() => setActiveTab('kanban')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${
                            activeTab === 'kanban' 
                            ? 'bg-white/10 text-white shadow-sm' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <LayoutGrid size={18} />
                        <span className="hidden sm:inline">Kanban</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${
                            activeTab === 'timeline' 
                            ? 'bg-white/10 text-white shadow-sm' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <List size={18} />
                        <span className="hidden sm:inline">Timeline</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('ideas')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${
                            activeTab === 'ideas' 
                            ? 'bg-white/10 text-white shadow-sm' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Users size={18} />
                        <span className="hidden sm:inline">Community Ideas</span>
                    </button>
                </div>
            </div>
          </div>

          {/* Search & Status Filters (Only for Kanban/Timeline) */}
          {(activeTab === 'kanban' || activeTab === 'timeline') && !loading && !error && (
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-10">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search roadmap..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-900/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => setSelectedStatus('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedStatus === 'all'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    All ({roadmapData?.pagination?.totalItems || 0})
                  </button>
                  {Object.entries(statusConfig).map(([key, config]) => {
                    const count = roadmapData?.counts ? roadmapData.counts[key] : 0;
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
                        <span className="hidden sm:inline">{config.label}</span>
                        <span className="opacity-60">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
          )}

          {/* Loading State */}
          {((activeTab !== 'ideas' && loading) || (activeTab === 'ideas' && ideasLoading && !ideasData)) && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
              <p className="text-gray-400">Loading...</p>
            </div>
          )}

          {/* Error State */}
          {activeTab !== 'ideas' && !loading && error && (
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

          {/* Views */}
          {activeTab === 'kanban' && !loading && !error && renderKanban()}
          {activeTab === 'timeline' && !loading && !error && renderTimeline()}
          {activeTab === 'ideas' && renderCommunityIdeas()}

          {/* Load More Button */}
          {!loading && !error && (
            (activeTab === 'ideas' && ideasData?.pagination?.hasMore) || 
            (activeTab !== 'ideas' && roadmapData?.pagination?.hasMore && selectedStatus === 'all' && !searchQuery)
          ) && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore || ideasLoadingMore}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all disabled:opacity-50"
                >
                  {loadingMore || ideasLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span className="font-medium">Load More</span>
                  )}
                </button>
              </div>
          )}
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/5 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
            <Link to="/changelog" className="text-purple-400 hover:text-purple-300 transition-colors">
              ← View Changelog
            </Link>
          </div>
        </footer>

        {/* Modals */}
        {showFeedbackModal && (
          <Suspense fallback={null}>
            <FeedbackModal
              isOpen={showFeedbackModal}
              onClose={() => setShowFeedbackModal(false)}
              defaultType="feature_request"
            />
          </Suspense>
        )}
        
        {selectedItem && (
            <RoadmapCardModal
                item={selectedItem}
                config={statusConfig[selectedItem.roadmapStatus] || statusConfig['planned']}
                onClose={() => setSelectedItem(null)}
                onUpvote={handleUpvoteRoadmap}
                isVoting={votingId === selectedItem._id}
            />
        )}
      </div>
    </LazyPullToRefresh>
  );
};

export default Roadmap;
