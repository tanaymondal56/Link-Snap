import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Globe,
  Smartphone,
  Monitor,
  Link as LinkIcon,
  AlertCircle,
} from 'lucide-react';
import api from '../api/axios';
const ClickChart = lazy(() => import('../components/charts/ClickChart'));
const DeviceChart = lazy(() => import('../components/charts/DeviceChart'));
const LocationChart = lazy(() => import('../components/charts/LocationChart'));

const AnalyticsPage = () => {
  const { shortId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/analytics/${shortId}`);
        setData(response.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (shortId) {
      fetchAnalytics();
    } else {
      // No shortId provided - show empty state instead of loading
      setLoading(false);
    }
  }, [shortId]);

  // No link selected - show prompt to select a link
  if (!shortId && !loading) {
    return (
      <div className="max-w-4xl mx-auto mt-10 px-4">
        <div className="glass-dark p-8 rounded-2xl border border-white/10 text-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-400">
            <LinkIcon size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Select a Link</h3>
          <p className="text-gray-400 mb-6">
            Choose a link from your dashboard to view its analytics
          </p>
          <Link
            to="/dashboard/links"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-colors"
          >
            Go to Links
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-10 px-4">
        <div className="glass-dark p-8 rounded-2xl border border-red-500/20 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Analytics Not Found</h3>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { url, analytics } = data;
  const totalClicks = url.clicks;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Analytics for <span className="text-blue-400">/{url.shortId}</span>
          </h1>
          <a
            href={url.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-300 truncate max-w-md block mt-1"
          >
            {url.originalUrl}
          </a>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass-dark px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <LinkIcon size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                Total Clicks
              </p>
              <p className="text-xl font-bold text-white">{totalClicks}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-dark p-6 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="text-blue-400" size={20} />
          <h3 className="text-lg font-semibold text-white">Clicks Over Time</h3>
        </div>
        <Suspense
          fallback={
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          }
        >
          <ClickChart data={analytics.clicksByDate} />
        </Suspense>
      </div>

      {/* Secondary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devices */}
        <div className="glass-dark p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Smartphone className="text-purple-400" size={20} />
            <h3 className="text-lg font-semibold text-white">Devices & Browsers</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-4 text-center">Device Type</h4>
              <Suspense
                fallback={
                  <div className="h-48 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                  </div>
                }
              >
                <DeviceChart data={analytics.clicksByDevice} />
              </Suspense>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-4 text-center">Browser</h4>
              <Suspense
                fallback={
                  <div className="h-48 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                  </div>
                }
              >
                <DeviceChart data={analytics.clicksByBrowser} />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Locations */}
        <div className="glass-dark p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <Globe className="text-green-400" size={20} />
            <h3 className="text-lg font-semibold text-white">Top Locations</h3>
          </div>
          <Suspense
            fallback={
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            }
          >
            <LocationChart data={analytics.clicksByLocation} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
