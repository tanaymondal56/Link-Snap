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
  Loader2,
  QrCode,
  Share2,
  Copy,
  Check,
  Download,
  X,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import PullToRefresh from '../components/PullToRefresh';
import showToast from '../utils/toastUtils';
import api from '../api/axios';

// Theme configurations with modern gradients
const THEMES = {
  default: {
    bg: 'from-slate-950 via-slate-900 to-slate-950',
    card: 'bg-white/5 backdrop-blur-2xl border-white/10',
    button: 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-slate-400',
    accent: 'from-violet-500 to-indigo-500',
  },
  dark: {
    bg: 'from-zinc-950 via-neutral-950 to-zinc-950',
    card: 'bg-white/5 backdrop-blur-2xl border-white/10',
    button: 'bg-white/10 hover:bg-white/20 border border-white/20',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-zinc-500',
    accent: 'from-zinc-400 to-zinc-300',
  },
  midnight: {
    bg: 'from-blue-950 via-indigo-950 to-violet-950',
    card: 'bg-white/5 backdrop-blur-2xl border-blue-400/20',
    button: 'bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-blue-300/70',
    accent: 'from-blue-500 to-cyan-400',
  },
  ocean: {
    bg: 'from-cyan-950 via-teal-950 to-emerald-950',
    card: 'bg-white/5 backdrop-blur-2xl border-teal-400/20',
    button: 'bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300',
    buttonText: 'text-slate-900',
    text: 'text-white',
    subtext: 'text-teal-300/70',
    accent: 'from-teal-400 to-emerald-400',
  },
  forest: {
    bg: 'from-green-950 via-emerald-950 to-teal-950',
    card: 'bg-white/5 backdrop-blur-2xl border-green-400/20',
    button: 'bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-green-300/70',
    accent: 'from-green-500 to-emerald-400',
  },
  sunset: {
    bg: 'from-orange-950 via-rose-950 to-pink-950',
    card: 'bg-white/5 backdrop-blur-2xl border-orange-400/20',
    button: 'bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 hover:from-orange-400 hover:via-rose-400 hover:to-pink-400',
    buttonText: 'text-white',
    text: 'text-white',
    subtext: 'text-orange-300/70',
    accent: 'from-orange-500 to-pink-500',
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
  const cleanValue = value.trim();
  
  switch (platform) {
    case 'twitter':
      return cleanValue.startsWith('http') ? cleanValue : `https://twitter.com/${cleanValue.replace(/^@/, '')}`;
    case 'instagram':
      return cleanValue.startsWith('http') ? cleanValue : `https://instagram.com/${cleanValue.replace(/^@/, '')}`;
    case 'linkedin': {
      if (cleanValue.startsWith('http')) return cleanValue;
      const linkedinHandle = cleanValue.replace(/^\/?(?:in\/)?/, '');
      return `https://linkedin.com/in/${linkedinHandle}`;
    }
    case 'youtube':
      if (cleanValue.startsWith('http')) return cleanValue;
      return `https://youtube.com/@${cleanValue.replace(/^@/, '')}`;
    case 'github':
      return cleanValue.startsWith('http') ? cleanValue : `https://github.com/${cleanValue.replace(/^@/, '')}`;
    case 'tiktok':
      if (cleanValue.startsWith('http')) return cleanValue;
      return `https://tiktok.com/@${cleanValue.replace(/^@/, '')}`;
    case 'discord':
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

// Helper to mask raw URLs in titles
const getMaskedTitle = (title) => {
  if (!title) return 'Visit Link';
  // If it looks like a domain (has dot and no spaces) or starts with http, it is raw URL data.
  if ((title.includes('.') && !title.includes(' ')) || title.startsWith('http')) {
    return 'Visit Link'; 
  }
  return title;
};

// Helper for Elite Badge Text/Tooltip
// Valid Tiers: admin, pioneer, torchbearer, dreamer, believer, wave
const getEliteBadgeConfig = (tier) => {
  const key = tier?.toLowerCase();
  
  const map = {
    admin: { 
      label: 'ADMIN', 
      tooltip: 'System Administrator',
      gradient: 'from-slate-900 to-slate-800',
      shadow: 'shadow-slate-900/25'
    },
    pioneer: { 
      label: 'PIONEER', 
      tooltip: 'Early Adopter - Pioneer Tier',
      gradient: 'from-violet-600 to-indigo-600',
      shadow: 'shadow-violet-600/25'
    },
    torchbearer: { 
      label: 'TORCHBEARER', 
      tooltip: 'Early Adopter - Torchbearer Tier',
      gradient: 'from-amber-500 to-yellow-500',
      shadow: 'shadow-amber-500/25'
    },
    dreamer: { 
      label: 'DREAMER', 
      tooltip: 'Early Adopter - Dreamer Tier',
      gradient: 'from-blue-400 to-cyan-400',
      shadow: 'shadow-blue-400/25'
    },
    believer: { 
      label: 'BELIEVER', 
      tooltip: 'Early Adopter - Believer Tier',
      gradient: 'from-teal-400 to-emerald-400',
      shadow: 'shadow-teal-400/25'
    },
    wave: { 
      label: 'WAVE', 
      tooltip: 'Wave Member',
      gradient: 'from-cyan-500 to-blue-500',
      shadow: 'shadow-cyan-500/25'
    }
  };

  return map[key] || { 
    label: tier?.toUpperCase() || 'ELITE', 
    tooltip: 'Verified Elite Status',
    gradient: 'from-purple-500 to-pink-500',
    shadow: 'shadow-purple-500/25'
  };
};

// Helper for Pro Badge Text/Tooltip
const getProBadgeConfig = (subTier) => {
  if (subTier === 'business') {
    return { 
      label: 'BUSINESS', 
      tooltip: 'Active Business Subscription', 
      gradient: 'from-blue-600 to-indigo-600', 
      shadow: 'shadow-blue-600/25' 
    };
  }
  // Default Pro
  return { 
    label: 'PRO', 
    tooltip: 'Active Pro Subscription', 
    gradient: 'from-orange-500 to-amber-500', 
    shadow: 'shadow-orange-500/25' 
  };
};



// Badge component with tooltip (Hover + Touch)
const Badge = ({ children, tooltip, gradient, shadowColor }) => {
  const [show, setShow] = useState(false);
  
  return (
    <div 
      className="relative group cursor-pointer inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShow(!show);
      }}
    >
      <span className={`px-2.5 py-0.5 text-xs font-bold bg-gradient-to-r ${gradient} text-white rounded-full shadow-lg ${shadowColor} transition-transform active:scale-95 select-none`}>
        {children}
      </span>
      
      {/* Tooltip */}
      <div 
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200 z-50 shadow-xl border border-white/10 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}
      >
        {tooltip}
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
};

// Helper to download SVG as PNG
const downloadSvgAsPng = (elementId, filename) => {
  const svg = document.getElementById(elementId);
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
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
};

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [linkQR, setLinkQR] = useState(null); // For per-link QR modal
  const [avatarError, setAvatarError] = useState(false);
  
  // Dynamic domain for short URL display
  const shortDomain = window.location.hostname;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
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
      showToast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast.error('Failed to copy link');
    }
  };

  const handleDownloadQR = () => {
    downloadSvgAsPng('profile-qr-code', `${profile?.username || 'profile'}-qr.png`);
  };

  const theme = THEMES[profile?.theme] || THEMES.default;
  
  // Custom styles for custom theme
  const customStyles = profile?.theme === 'custom' && profile?.customTheme ? {
    background: profile.customTheme.background || undefined,
    color: profile.customTheme.textColor || undefined,
  } : {};
  
  const customButtonStyles = profile?.theme === 'custom' && profile?.customTheme ? {
    background: profile.customTheme.buttonColor || undefined,
    color: profile.customTheme.buttonTextColor || undefined,
    borderRadius: profile.customTheme.buttonStyle === 'pill' ? '9999px' : 
                  profile.customTheme.buttonStyle === 'square' ? '12px' : '20px',
  } : {};

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center animate-pulse">
            <LinkIcon className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mb-6">
          <span className="text-4xl">🔍</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
        <p className="text-slate-400 mb-8 text-center">This profile doesn't exist or is private.</p>
        <Link 
          to="/" 
          className="px-8 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition-all shadow-lg shadow-violet-500/25"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const socials = Object.entries(profile?.socials || {}).filter(([, value]) => value);
  const displayName = profile?.displayName || profile?.username;

  return (
    <PullToRefresh onRefresh={() => window.location.reload()}>
    <div 
      className={`min-h-screen bg-gradient-to-br ${profile?.theme !== 'custom' ? theme.bg : ''}`}
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

      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
        {/* Floating particles */}
        <div className="absolute top-20 left-10 w-2 h-2 bg-violet-400/30 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute top-40 right-20 w-1.5 h-1.5 bg-indigo-400/30 rounded-full animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
        <div className="absolute bottom-40 left-20 w-2 h-2 bg-purple-400/30 rounded-full animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Header Actions */}
        <div className="flex justify-end gap-2 mb-8">
          <button
            onClick={handleCopyLink}
            className={`p-3 rounded-2xl ${theme.card} border transition-all hover:scale-105 active:scale-95`}
            aria-label="Copy profile link"
          >
            {copied ? (
              <Check className={`w-5 h-5 ${theme.text}`} />
            ) : (
              <Share2 className={`w-5 h-5 ${theme.text}`} />
            )}
          </button>
          <button
            onClick={() => setShowQR(!showQR)}
            className={`p-3 rounded-2xl ${theme.card} border transition-all hover:scale-105 active:scale-95`}
            aria-label="Show QR Code"
          >
            <QrCode className={`w-5 h-5 ${theme.text}`} />
          </button>
        </div>

        {/* Profile Card */}
        <div className={`${theme.card} border rounded-[2rem] p-8 mb-8 relative overflow-hidden`}>
          {/* Gradient accent line */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r ${theme.accent} rounded-full`} />
          
          {/* Avatar with glow */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              {/* Glow effect */}
              <div className={`absolute inset-0 bg-gradient-to-r ${theme.accent} rounded-full blur-xl opacity-50 scale-110`} />
              {profile?.avatar && !avatarError ? (
                <img
                  src={profile.avatar}
                  alt={displayName}
                  className="relative w-28 h-28 rounded-full object-cover ring-4 ring-white/10"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className={`relative w-28 h-28 rounded-full bg-gradient-to-br ${theme.accent} flex items-center justify-center text-4xl font-bold text-white ring-4 ring-white/10`}>
                  {displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>

            {/* Name & Badges */}
            <div className="flex items-center gap-2 mb-1 flex-wrap justify-center">
              <h1 className={`text-2xl font-bold ${theme.text}`}>{displayName}</h1>
              
              {profile?.eliteId && (() => {
                // Pass idTier (e.g. 'admin', 'pioneer') to config
                const config = getEliteBadgeConfig(profile.idTier);
                return (
                  <Badge 
                    gradient={config.gradient}
                    shadowColor={config.shadow}
                    tooltip={config.tooltip}
                  >
                    {config.label}
                  </Badge>
                );
              })()}

              {profile?.isPro && (() => {
                // Pass subscriptionTier (e.g. 'business') to config
                const config = getProBadgeConfig(profile.subscriptionTier);
                return (
                  <Badge 
                    gradient={config.gradient}
                    shadowColor={config.shadow}
                    tooltip={config.tooltip}
                  >
                    {config.label}
                  </Badge>
                );
              })()}
            </div>

            <p className={`text-sm ${theme.subtext}`}>@{profile?.username}</p>

            {/* Bio */}
            {profile?.bio && (
              <p className={`text-center mt-4 ${theme.subtext} max-w-xs leading-relaxed`}>
                {profile.bio}
              </p>
            )}
          </div>

          {/* Social Icons */}
          {socials.length > 0 && (
            <div className="flex justify-center gap-2 flex-wrap">
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
                    className={`p-3 rounded-xl ${theme.card} border transition-all hover:scale-110 active:scale-95 ${theme.text}`}
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
            <div
              key={link.id || index}
              className={`relative rounded-2xl ${profile?.theme !== 'custom' ? `${theme.button} ${theme.buttonText}` : ''} font-medium transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-xl`}
              style={profile?.theme === 'custom' ? customButtonStyles : {}}
            >
              <a
                href={`${window.location.origin}/${link.shortCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-6 py-4 pr-28"
              >
                <span className="block truncate font-semibold">
                  {getMaskedTitle(link.title)}
                </span>
                {link.shortCode && (
                  <span className="block text-xs opacity-60 mt-0.5 font-mono">
                    {shortDomain}/{link.shortCode}
                  </span>
                )}
              </a>
              {/* Action Buttons - Always Visible */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                {/* QR Code Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLinkQR(link);
                  }}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all"
                  aria-label={`Show QR code for ${link.title}`}
                >
                  <QrCode className="w-4 h-4" />
                </button>
                {/* Redirect Button */}
                <a
                  href={`${window.location.origin}/${link.shortCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all"
                  aria-label={`Open ${link.title}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}

          {(!profile?.links || profile.links.length === 0) && (
            <div className={`text-center py-12 ${theme.card} border rounded-2xl`}>
              <LinkIcon className={`w-10 h-10 mx-auto mb-3 ${theme.subtext} opacity-50`} />
              <p className={theme.subtext}>No links added yet</p>
            </div>
          )}
        </div>

        {/* Expired Subscription Ad - Subtle */}
        {profile?.isExpired && (
          <div className="mt-6 px-5 py-4 rounded-2xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-violet-300">Want a page like this?</span>
              <Link to="/" className="text-violet-400 font-semibold hover:underline">
                Create yours free →
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link 
            to="/" 
            className={`inline-flex items-center gap-2 text-sm ${theme.subtext} hover:text-white transition-colors`}
          >
            <span>Powered by</span>
            <span className={`font-bold bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
              Link Snap
            </span>
          </Link>
        </div>
      </div>

      {/* QR Modal */}
      {showQR && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowQR(false)}
        >
          <div 
            className={`${theme.card} border rounded-3xl p-8 max-w-sm w-full relative`}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className={`text-xl font-bold ${theme.text} mb-6 text-center`}>
              Scan to visit
            </h3>
            <div className="bg-white rounded-2xl p-6 flex items-center justify-center">
              <QRCodeSVG
                id="profile-qr-code"
                value={window.location.href}
                size={200}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={handleDownloadQR}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCopyLink}
                className={`px-4 py-3 rounded-xl ${theme.button} ${theme.buttonText} font-medium flex items-center justify-center gap-2`}
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link QR Modal */}
      {linkQR && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setLinkQR(null)}
        >
          <div 
            className={`${theme.card} border rounded-3xl p-8 max-w-sm w-full relative`}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setLinkQR(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className={`text-xl font-bold ${theme.text} mb-2 text-center truncate`}>
              {getMaskedTitle(linkQR.title)}
            </h3>
            <p className="text-center text-sm text-slate-400 mb-4 font-mono">
              {shortDomain}/{linkQR.shortCode}
            </p>
            <div className="bg-white rounded-2xl p-6 flex items-center justify-center">
              <QRCodeSVG
                id="link-qr-code"
                value={`${window.location.origin}/${linkQR.shortCode}`}
                size={200}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => downloadSvgAsPng('link-qr-code', `${linkQR.shortCode}-qr.png`)}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={async () => {
                  try {
                    const shortUrl = `${window.location.origin}/${linkQR.shortCode}`;
                    await navigator.clipboard.writeText(shortUrl);
                    showToast.success('Short URL copied!');
                  } catch {
                    showToast.error('Failed to copy');
                  }
                }}
                className={`px-4 py-3 rounded-xl ${theme.button} ${theme.buttonText} font-medium flex items-center justify-center gap-2`}
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
