import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ExternalLink, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Youtube, 
  Github,
  Globe,
  Mail,
  MessageCircle,
  BadgeCheck,
  Loader2,
  QrCode,
  Share2,
  Copy,
  Check,
  Crown,
  Download,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

// Theme configurations with modern gradients
const THEMES = {
  default: {
    bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    card: 'bg-white/5 backdrop-blur-xl',
    button: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-slate-400',
    border: 'border-white/10'
  },
  dark: {
    bg: 'bg-gradient-to-br from-zinc-950 via-neutral-900 to-zinc-950',
    card: 'bg-white/5 backdrop-blur-xl',
    button: 'bg-white/10 hover:bg-white/20 border border-white/20',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-zinc-500',
    border: 'border-white/10'
  },
  midnight: {
    bg: 'bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950',
    card: 'bg-white/5 backdrop-blur-xl',
    button: 'bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-blue-300/70',
    border: 'border-blue-400/20'
  },
  ocean: {
    bg: 'bg-gradient-to-br from-cyan-900 via-teal-900 to-emerald-900',
    card: 'bg-white/5 backdrop-blur-xl',
    button: 'bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-500 hover:to-emerald-500',
    buttonText: 'text-slate-900',
    text: 'text-white',
    subtext: 'text-teal-300/70',
    border: 'border-teal-400/20'
  },
  forest: {
    bg: 'bg-gradient-to-br from-green-950 via-emerald-950 to-teal-950',
    card: 'bg-white/5 backdrop-blur-xl',
    button: 'bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-600 hover:to-emerald-500',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-green-300/70',
    border: 'border-green-400/20'
  },
  sunset: {
    bg: 'bg-gradient-to-br from-orange-950 via-rose-950 to-pink-950',
    card: 'bg-white/5 backdrop-blur-xl',
    button: 'bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 hover:from-orange-600 hover:via-rose-600 hover:to-pink-600',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-orange-300/70',
    border: 'border-orange-400/20'
  }
};

// Social icon mapping
const SOCIAL_ICONS = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  github: Github,
  discord: MessageCircle,
  email: Mail,
  website: Globe,
  tiktok: () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  )
};

const getSocialLink = (platform, value) => {
  if (!value) return null;
  
  // Clean the value - trim whitespace and remove @ if present
  const cleanValue = value.trim();
  
  switch (platform) {
    case 'twitter':
      return cleanValue.startsWith('http') ? cleanValue : `https://twitter.com/${cleanValue.replace(/^@/, '')}`;
    case 'instagram':
      return cleanValue.startsWith('http') ? cleanValue : `https://instagram.com/${cleanValue.replace(/^@/, '')}`;
    case 'linkedin': {
      // Handle both /in/username format and plain username
      if (cleanValue.startsWith('http')) return cleanValue;
      const linkedinHandle = cleanValue.replace(/^\/?(in\/)?/, '');
      return `https://linkedin.com/in/${linkedinHandle}`;
    }
    case 'youtube':
      if (cleanValue.startsWith('http')) return cleanValue;
      // Strip @ if present, add @ for youtube URL
      return `https://youtube.com/@${cleanValue.replace(/^@/, '')}`;
    case 'github':
      return cleanValue.startsWith('http') ? cleanValue : `https://github.com/${cleanValue.replace(/^@/, '')}`;
    case 'tiktok':
      if (cleanValue.startsWith('http')) return cleanValue;
      // Strip @ if present, add @ for tiktok URL
      return `https://tiktok.com/@${cleanValue.replace(/^@/, '')}`;
    case 'discord':
      // Handle discord.gg invite links properly
      if (cleanValue.startsWith('http') || cleanValue.startsWith('discord.gg')) {
        return cleanValue.startsWith('http') ? cleanValue : `https://${cleanValue}`;
      }
      return `https://discord.gg/${cleanValue}`;
    case 'email':
      return cleanValue.startsWith('mailto:') ? cleanValue : `mailto:${cleanValue}`;
    case 'website':
      return cleanValue.startsWith('http') ? cleanValue : `https://${cleanValue}`;
    default:
      return cleanValue;
  }
};

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        // Remove @ from username if present and normalize to lowercase
        const cleanUsername = username.replace('@', '').toLowerCase();
        const { data } = await api.get(`/bio/${cleanUsername}`);
        setProfile(data);
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Profile not found');
        } else {
          setError('Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  // Handle escape key to close QR modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showQR) {
        setShowQR(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showQR]);

  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('profile-qr-code');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      
      const link = document.createElement('a');
      link.download = `${profile?.username || 'profile'}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const theme = THEMES[profile?.theme] || THEMES.default;
  
  // Build custom styles if using custom theme
  const customStyles = profile?.theme === 'custom' && profile?.customTheme ? {
    background: profile.customTheme.background || undefined,
    color: profile.customTheme.textColor || undefined,
  } : {};
  
  const customButtonStyles = profile?.theme === 'custom' && profile?.customTheme ? {
    background: profile.customTheme.buttonColor || undefined,
    color: profile.customTheme.buttonTextColor || undefined,
    borderRadius: profile.customTheme.buttonStyle === 'pill' ? '9999px' : 
                  profile.customTheme.buttonStyle === 'square' ? '8px' : '16px',
  } : {};

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center p-4`}>
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
        <p className="text-slate-400 mb-6">This profile doesn't exist or is private.</p>
        <Link 
          to="/" 
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:opacity-90 transition"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const socials = Object.entries(profile?.socials || {}).filter(([, value]) => value);
  const displayName = profile?.displayName || profile?.username;

  return (
    <div 
      className={`min-h-screen ${profile?.theme !== 'custom' ? theme.bg : ''}`}
      style={profile?.theme === 'custom' ? { background: customStyles.background } : {}}
    >
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{displayName} | Link Snap</title>
        <meta name="description" content={profile?.bio || `Check out ${displayName}'s links on Link Snap`} />
        <meta property="og:title" content={`${displayName} | Link Snap`} />
        <meta property="og:description" content={profile?.bio || `Check out ${displayName}'s links`} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={window.location.href} />
        {profile?.avatar && <meta property="og:image" content={profile.avatar} />}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${displayName} | Link Snap`} />
        <meta name="twitter:description" content={profile?.bio || `Check out ${displayName}'s links`} />
      </Helmet>

      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Header Actions */}
        <div className="flex justify-end gap-2 mb-6">
          <button
            onClick={handleCopyLink}
            className={`p-2.5 rounded-xl ${theme.card} ${theme.border} border transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/30`}
            aria-label="Copy profile link"
          >
            {copied ? (
              <Check className={`w-5 h-5 ${theme.text}`} aria-hidden="true" />
            ) : (
              <Share2 className={`w-5 h-5 ${theme.text}`} aria-hidden="true" />
            )}
          </button>
          <button
            onClick={() => setShowQR(!showQR)}
            className={`p-2.5 rounded-xl ${theme.card} ${theme.border} border transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/30`}
            aria-label="Show QR Code"
            aria-expanded={showQR}
          >
            <QrCode className={`w-5 h-5 ${theme.text}`} aria-hidden="true" />
          </button>
        </div>

        {/* Profile Card */}
        <div className={`${theme.card} ${theme.border} border rounded-3xl p-6 mb-6`}>
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            {profile?.avatar && !avatarError ? (
              <img
                src={profile.avatar}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-white/10 mb-4"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white/10 mb-4">
                {displayName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}

            {/* Name & Badges */}
            <div className="flex items-center gap-2 mb-1 max-w-full">
              <h1 className={`text-xl font-bold ${theme.text} truncate max-w-[200px]`}>{displayName}</h1>
              {profile?.isVerified && (
                <BadgeCheck className="w-5 h-5 text-blue-400" />
              )}
              {profile?.eliteId && (
                <Crown className="w-5 h-5 text-amber-400" />
              )}
            </div>

            <p className={`text-sm ${theme.subtext}`}>@{profile?.username}</p>

            {/* Bio */}
            {profile?.bio && (
              <p className={`text-center mt-3 ${theme.subtext} max-w-xs break-words`}>
                {profile.bio}
              </p>
            )}
          </div>

          {/* Social Icons */}
          {socials.length > 0 && (
            <div className="flex justify-center gap-3 mb-6">
              {socials.map(([platform, value]) => {
                const Icon = SOCIAL_ICONS[platform];
                const link = getSocialLink(platform, value);
                if (!Icon || !link) return null;
                
                return (
                  <a
                    key={platform}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-2.5 rounded-xl ${theme.card} ${theme.border} border transition hover:scale-110 ${theme.text}`}
                    title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="flex-1 space-y-3">
          {profile?.links?.map((link, index) => (
            <a
              key={link.id || index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center justify-between w-full px-5 py-4 rounded-2xl ${profile?.theme !== 'custom' ? `${theme.button} ${theme.buttonText}` : ''} font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/30`}
              style={profile?.theme === 'custom' ? customButtonStyles : {}}
              aria-label={`Visit ${link.title}`}
            >
              <span className="truncate pr-3">{link.title}</span>
              <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 flex-shrink-0" aria-hidden="true" />
            </a>
          ))}

          {(!profile?.links || profile.links.length === 0) && (
            <div className={`text-center py-8 ${theme.subtext}`}>
              <p>No links added yet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link 
            to="/" 
            className={`inline-flex items-center gap-1.5 text-sm ${theme.subtext} hover:${theme.text} transition`}
          >
            <span>Powered by</span>
            <span className="font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Link Snap
            </span>
          </Link>
        </div>
      </div>

      {/* QR Modal */}
      {showQR && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowQR(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
        >
          <div 
            className={`${theme.card} ${theme.border} border rounded-3xl p-6 max-w-xs w-full relative`}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowQR(false)}
              className={`absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 ${theme.text} transition focus:outline-none focus:ring-2 focus:ring-white/30`}
              aria-label="Close QR code modal"
              autoFocus
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            
            <h3 id="qr-modal-title" className={`text-lg font-semibold ${theme.text} mb-4 text-center`}>
              Scan to visit profile
            </h3>
            <div className="bg-white rounded-2xl p-4 flex items-center justify-center">
              <QRCodeSVG
                id="profile-qr-code"
                value={window.location.href}
                size={192}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleDownloadQR}
                className={`px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 ${theme.text} font-medium flex items-center justify-center gap-2 transition focus:outline-none focus:ring-2 focus:ring-white/30`}
                aria-label="Download QR code as image"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Download
              </button>
              <button
                onClick={handleCopyLink}
                className={`px-4 py-3 rounded-xl ${theme.button} ${theme.buttonText} font-medium flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/30`}
                aria-label="Copy profile link to clipboard"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
