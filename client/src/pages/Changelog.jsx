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
} from 'lucide-react';

const Changelog = () => {
  const releases = [
    {
      version: '0.5.1-beta',
      date: 'December 3, 2025',
      title: 'Web App & Security Improvements 🚀',
      type: 'minor',
      icon: Rocket,
      changes: [
        { type: 'feature', text: 'Install as app on any device (PWA support)' },
        { type: 'feature', text: 'Enhanced account security features' },
        { type: 'improvement', text: 'Faster page load times' },
        { type: 'improvement', text: 'Better mobile experience' },
      ],
    },
    {
      version: '0.5.0-beta',
      date: 'November 28, 2025',
      title: 'Custom Aliases & QR Codes',
      type: 'minor',
      icon: Sparkles,
      changes: [
        { type: 'feature', text: 'Create custom branded short links' },
        { type: 'feature', text: 'Real-time alias availability check' },
        { type: 'feature', text: 'QR code generation for every link' },
        { type: 'feature', text: 'Download QR codes as images' },
      ],
    },
    {
      version: '0.3.0-beta',
      date: 'November 25, 2025',
      title: 'Analytics Dashboard',
      type: 'minor',
      icon: BarChart3,
      changes: [
        { type: 'feature', text: 'Track clicks on your links' },
        { type: 'feature', text: 'See where your visitors come from' },
        { type: 'feature', text: 'Device & browser breakdown' },
        { type: 'feature', text: 'Beautiful interactive charts' },
      ],
    },
    {
      version: '0.1.0-alpha',
      date: 'November 20, 2025',
      title: 'User Accounts',
      type: 'minor',
      icon: Zap,
      changes: [
        { type: 'feature', text: 'Create your personal account' },
        { type: 'feature', text: 'Email verification for security' },
        { type: 'feature', text: 'Manage your profile settings' },
      ],
    },
    {
      version: '0.0.1-alpha',
      date: 'November 15, 2025',
      title: 'The Beginning 🌟',
      type: 'initial',
      icon: Star,
      changes: [
        { type: 'feature', text: 'Link Snap is born!' },
        { type: 'feature', text: 'Basic URL shortening' },
        { type: 'feature', text: 'Clean, modern interface' },
        { type: 'note', text: 'The journey begins! 🚀' },
      ],
    },
  ];

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
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
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
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Changelog
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Follow the evolution of Link Snap. Every feature, improvement, and milestone documented.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500 via-blue-500 to-transparent" />

          {/* Releases */}
          <div className="space-y-12">
            {releases.map((release) => (
              <div key={release.version} className="relative pl-20">
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
                        <span className="text-gray-500 text-sm">{release.date}</span>
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
        </div>

        {/* Footer Note */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <Sparkles size={16} className="text-purple-400" />
            <span className="text-sm text-gray-400">More features coming soon! Stay tuned.</span>
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
    </div>
  );
};

export default Changelog;
