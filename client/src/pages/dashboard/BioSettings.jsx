import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Globe, 
  Eye, 
  EyeOff, 
  Save, 
  Loader2, 
  Link as LinkIcon,
  Pin,
  PinOff,
  ExternalLink,
  Palette,
  User,
  Share2,
  Copy,
  Check,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Github,
  MessageCircle,
  Mail,
  X,
  RefreshCw,
  Lock,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// Custom TikTok icon (not available in lucide-react)
const TikTokIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Theme options
const THEMES = [
  { id: 'default', name: 'Default', gradient: 'from-slate-900 via-slate-800 to-slate-900', accent: 'from-indigo-500 to-purple-500' },
  { id: 'dark', name: 'Dark', gradient: 'from-zinc-950 via-neutral-900 to-zinc-950', accent: 'from-white/20 to-white/10' },
  { id: 'midnight', name: 'Midnight', gradient: 'from-blue-950 via-indigo-950 to-purple-950', accent: 'from-blue-500 to-cyan-400' },
  { id: 'ocean', name: 'Ocean', gradient: 'from-cyan-900 via-teal-900 to-emerald-900', accent: 'from-teal-400 to-emerald-400' },
  { id: 'forest', name: 'Forest', gradient: 'from-green-950 via-emerald-950 to-teal-950', accent: 'from-green-500 to-emerald-400' },
  { id: 'sunset', name: 'Sunset', gradient: 'from-orange-950 via-rose-950 to-pink-950', accent: 'from-orange-500 to-pink-500' },
];

const SOCIAL_FIELDS = [
  { id: 'twitter', label: 'Twitter/X', icon: Twitter, placeholder: 'username' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'username' },
  { id: 'tiktok', label: 'TikTok', icon: TikTokIcon, placeholder: '@handle' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'username' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, placeholder: '@handle' },
  { id: 'github', label: 'GitHub', icon: Github, placeholder: 'username' },
  { id: 'discord', label: 'Discord', icon: MessageCircle, placeholder: 'discord.gg/invite' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'email@example.com' },
  { id: 'website', label: 'Website', icon: Globe, placeholder: 'yoursite.com' },
];

import { getEffectiveTier } from '../../utils/subscriptionUtils';

export default function BioSettings() {
  const { user, refreshUser } = useAuth();
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const initialDataRef = useRef(null);
  
  // Form state
  const [isEnabled, setIsEnabled] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [theme, setTheme] = useState('default');
  const [socials, setSocials] = useState({});
  const [pinnedLinks, setPinnedLinks] = useState([]);
  const [allLinks, setAllLinks] = useState([]);

  // Tier check - Use effective API-safe tier logic
  const effectiveTier = getEffectiveTier(user);
  const isLocked = effectiveTier === 'free';

  const profileUrl = `${window.location.origin}/u/${user?.username}`;

  // Instant Unlock Logic
  // 1. Poll user status if locked (in case they upgrade in another tab)
  useEffect(() => {
    let interval;
    if (isLocked) {
      interval = setInterval(() => {
        refreshUser();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isLocked, refreshUser]);



  const handleManualRefresh = async () => {
    setCheckingStatus(true);
    await refreshUser();
    setTimeout(() => setCheckingStatus(false), 1000);
  };

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Track changes
  useEffect(() => {
    if (!initialDataRef.current || loading) return;
    const current = JSON.stringify({ isEnabled, displayName, bio, theme, socials, pinnedLinks });
    const initial = JSON.stringify(initialDataRef.current);
    setHasChanges(current !== initial);
  }, [isEnabled, displayName, bio, theme, socials, pinnedLinks, loading]);

  const fetchSettings = useCallback(async () => {
    // If user is Free tier, don't call API (it will 403)
    // Just set loading to false so the blurred preview shows
    if (isLocked) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setFetchError(false);
      const { data } = await api.get('/bio/me');
      
      const initialEnabled = data.bioPage?.isEnabled ?? true;
      const initialDisplayName = data.bioPage?.displayName || '';
      const initialBio = data.bioPage?.bio || '';
      const initialTheme = data.bioPage?.theme || 'default';
      const initialSocials = data.bioPage?.socials || {};
      const initialPinned = data.bioPage?.pinnedLinks?.map(l => l._id) || [];
      
      setIsEnabled(initialEnabled);
      setDisplayName(initialDisplayName);
      setBio(initialBio);
      setTheme(initialTheme);
      setSocials(initialSocials);
      setPinnedLinks(initialPinned);
      setAllLinks(data.allLinks || []);
      
      // Store initial state for change tracking
      initialDataRef.current = {
        isEnabled: initialEnabled,
        displayName: initialDisplayName,
        bio: initialBio,
        theme: initialTheme,
        socials: initialSocials,
        pinnedLinks: initialPinned
      };
      setHasChanges(false);
    } catch {
      setFetchError(true);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [isLocked]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      // Filter out empty social values before saving
      const filteredSocials = Object.fromEntries(
        Object.entries(socials).filter(([, v]) => v && v.trim())
      );
      
      await api.put('/bio/me', {
        isEnabled,
        displayName,
        bio,
        theme,
        socials: filteredSocials,
        pinnedLinks
      });
      toast.success('Bio page saved!');
      // Update initial state and socials to mark current state as saved
      setSocials(filteredSocials);
      initialDataRef.current = { isEnabled, displayName, bio, theme, socials: filteredSocials, pinnedLinks };
      setHasChanges(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    try {
      setToggling(true);
      const { data } = await api.patch('/bio/me/toggle');
      setIsEnabled(data.isEnabled);
      // Sync initialDataRef to prevent false "unsaved changes"
      if (initialDataRef.current) {
        initialDataRef.current.isEnabled = data.isEnabled;
      }
      toast.success(data.message);
    } catch {
      toast.error('Failed to toggle visibility');
    } finally {
      setToggling(false);
    }
  };

  const handleTogglePin = (linkId) => {
    setPinnedLinks(prev => {
      if (prev.includes(linkId)) {
        return prev.filter(id => id !== linkId);
      } else {
        // Check tier limits
        const maxLinks = effectiveTier === 'free' ? 10 : 25;
        if (prev.length >= maxLinks) {
          toast.error(`Maximum ${maxLinks} links allowed`);
          return prev;
        }
        return [...prev, linkId];
      }
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleSocialChange = (field, value) => {
    setSocials(prev => ({ ...prev, [field]: value }));
  };

  // Handle keyboard for pinned links
  const handleLinkKeyDown = (e, linkId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTogglePin(linkId);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-white/5 rounded-xl w-1/3" />
        <div className="h-24 bg-white/5 rounded-2xl" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-48 bg-white/5 rounded-2xl" />
          <div className="h-48 bg-white/5 rounded-2xl" />
        </div>
        <div className="h-32 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  if (fetchError && !isLocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-red-400 text-4xl">⚠️</div>
        <p className="text-white font-medium">Failed to load bio settings</p>
        <button
          onClick={fetchSettings}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Pro/Business Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 flex items-start justify-center pt-20">
          <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center max-w-md mx-4 shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Bio Page is a Pro Feature</h2>
            <p className="text-slate-400 text-sm mb-6">
              Upgrade to Pro to create your personalized link-in-bio page with custom themes, social links, and pinned content.
            </p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:opacity-90 transition"
            >
              <Sparkles className="w-5 h-5" />
              Upgrade to Pro
            </a>
            
            <button
              onClick={handleManualRefresh}
              disabled={checkingStatus}
              className="block mx-auto mt-4 text-sm text-slate-400 hover:text-white transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
              {checkingStatus ? 'Checking...' : 'Already upgraded? Check Again'}
            </button>
          </div>
        </div>
      )}

      {/* Content - Blurred for Free users */}
      <div className={isLocked ? 'blur-sm pointer-events-none select-none' : ''}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Link-in-Bio</h1>
          <p className="text-slate-400 text-sm mt-1">
            Customize your public profile page
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Preview Link */}
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Preview
          </a>
          
          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition text-sm"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copy Link
          </button>
          
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50 relative`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
            {hasChanges && !saving && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse" title="Unsaved changes" />
            )}
          </button>
        </div>
      </div>

      {/* Visibility Toggle */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isEnabled ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {isEnabled ? (
                <Eye className="w-5 h-5 text-green-400" />
              ) : (
                <EyeOff className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-white">Profile Visibility</h3>
              <p className="text-sm text-slate-400">
                {isEnabled ? 'Your profile is public' : 'Your profile is private'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleToggleVisibility}
            disabled={toggling}
            aria-pressed={isEnabled}
            aria-label={isEnabled ? 'Disable public profile' : 'Enable public profile'}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              isEnabled ? 'bg-green-500' : 'bg-slate-600'
            } ${toggling ? 'opacity-50' : ''}`}
          >
            {toggling ? (
              <Loader2 className="w-4 h-4 animate-spin absolute top-1.5 left-1/2 -translate-x-1/2 text-white" />
            ) : (
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                  isEnabled ? 'translate-x-7' : ''
                }`}
              />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-white font-medium">
            <User className="w-5 h-5" />
            Profile Details
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user?.username || 'Your name'}
                maxLength={50}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Bio <span className="text-slate-600">({bio.length}/160)</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the world about yourself..."
                maxLength={160}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Theme Picker */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-white font-medium">
            <Palette className="w-5 h-5" />
            Theme
          </div>

          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme selection">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                aria-label={`${t.name} theme`}
                aria-pressed={theme === t.id}
                className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  theme === t.id ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient}`} />
                <div className={`absolute bottom-2 left-2 right-2 h-2 rounded-full bg-gradient-to-r ${t.accent}`} />
                {theme === t.id && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" aria-hidden="true" />
                  </div>
                )}
              </button>
            ))}
          </div>
          
          <p className="text-xs text-slate-500 text-center">
            Selected: {THEMES.find(t => t.id === theme)?.name}
          </p>
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2 text-white font-medium">
          <Share2 className="w-5 h-5" />
          Social Links
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SOCIAL_FIELDS.map((field) => {
            const Icon = field.icon;
            const hasValue = socials[field.id]?.trim();
            return (
              <div key={field.id} className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={socials[field.id] || ''}
                  onChange={(e) => handleSocialChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className={`w-full pl-10 ${hasValue ? 'pr-9' : 'pr-4'} py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm`}
                />
                {hasValue && (
                  <button
                    type="button"
                    onClick={() => handleSocialChange(field.id, '')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
                    aria-label={`Clear ${field.label}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pinned Links */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-medium">
            <LinkIcon className="w-5 h-5" />
            Pinned Links
          </div>
          <span className="text-sm text-slate-400">
            {pinnedLinks.length}/{effectiveTier === 'free' ? 10 : 25} selected
          </span>
        </div>

        {allLinks.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No links yet. Create some links first!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {allLinks.map((link) => {
              const isPinned = pinnedLinks.includes(link._id);
              return (
                <div
                  key={link._id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isPinned}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                    isPinned 
                      ? 'bg-indigo-500/10 border-indigo-500/30' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  onClick={() => handleTogglePin(link._id)}
                  onKeyDown={(e) => handleLinkKeyDown(e, link._id)}
                >
                  <span
                    className={`p-1.5 rounded-lg transition ${
                      isPinned ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {link.title || link.shortId}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {link.originalUrl}
                    </p>
                  </div>
                  
                  <span className="text-xs text-slate-500">
                    {link.clicks?.toLocaleString() || 0} clicks
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
