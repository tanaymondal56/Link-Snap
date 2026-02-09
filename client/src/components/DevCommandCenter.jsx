import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import showToast from '../utils/toastUtils';
import { useNavigate } from 'react-router-dom';
import {
  Terminal,
  Settings,
  LayoutDashboard,
  Shield,
  Users,
  LogOut,
  RefreshCw,
  Database,
  Zap,
  X,
  Command,
  ExternalLink,
  Trash2,
  Bug,
  Clock,
  Server,
  Copy,
  FileJson,
  MonitorSmartphone,
  CornerDownLeft,
  History,
  XCircle,
  Info,
  HelpCircle,
  Link2,
  Share2,
  UserX,
  UserPlus,
  Bell,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Loader2
} from 'lucide-react';
import api from '../api/axios';

// Only render in development mode
const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV;

// Detect mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
);

const DevCommandCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dev_recent_commands') || '[]');
    } catch {
      return [];
    }
  });
  const [logResult, setLogResult] = useState(null); // { title, content }
  const [categoryFilter, setCategoryFilter] = useState(() => {
    try {
      return sessionStorage.getItem('dev_category_filter') || 'All';
    } catch {
      return 'All';
    }
  });
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const chipsRef = useRef(null);
  const savedScrollRef = useRef(0);

  // Persist category filter to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('dev_category_filter', categoryFilter);
    } catch { /* sessionStorage may not be available */ }
  }, [categoryFilter]);

  // Restore scroll position when opening
  useEffect(() => {
    if (isOpen && listRef.current && savedScrollRef.current) {
      requestAnimationFrame(() => {
        listRef.current.scrollTop = savedScrollRef.current;
      });
    }
  }, [isOpen]);

  // Save scroll position when closing
  const handleClose = useCallback(() => {
    if (listRef.current) {
      savedScrollRef.current = listRef.current.scrollTop;
    }
    setIsOpen(false);
  }, []);

  // Helper to show logs on mobile and desktop
  const showLog = (title, data) => {
    const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    console.log(`[${title}]`, data);
    setLogResult({ title, content });
  };

  // Execute command and track in recent
  const executeCommand = useCallback((cmd) => {
    // Track in recent commands
    if (!cmd.id.startsWith('console') && !cmd.id.startsWith('log')) {
      setRecentCommands(prev => {
        const newRecent = [cmd.id, ...prev.filter(id => id !== cmd.id)].slice(0, 5);
        localStorage.setItem('dev_recent_commands', JSON.stringify(newRecent));
        return newRecent;
      });
    }
    
    cmd.action();
    
    // Keep open for specific commands or if a log was triggered
    const keepOpen = ['console', 'log', 'copy', 'viewport', 'help', 'network'].some(k => cmd.id.startsWith(k));
    if (!keepOpen) {
      handleClose();
    }
  }, [handleClose]);

  // Commands - simplified and working
  const commands = useMemo(() => [
    // Quick Actions
    { id: 'share-url', label: 'Copy Page URL', icon: Share2, action: () => { navigator.clipboard.writeText(window.location.href); showToast.success('URL copied!'); }, category: '⚡ Actions', keywords: 'copy link share' },
    { id: 'create-link', label: 'Create New Link', icon: Link2, action: () => navigate('/dashboard'), category: '⚡ Actions', keywords: 'shorten url' },
    { id: 'qr-code', label: 'Copy Page URL (QR)', icon: Share2, action: () => { navigator.clipboard.writeText(window.location.href); showToast.success('URL copied! Use any QR generator.'); }, category: '⚡ Actions', keywords: 'qrcode scan share' },
    
    // Navigation
    { id: 'admin-console', label: 'Admin Console', icon: Shield, action: () => navigate('/admin-console'), category: '🧭 Navigate', keywords: 'admin panel' },
    { id: 'legacy-admin', label: 'Legacy Admin', icon: Terminal, action: () => navigate('/admin'), category: '🧭 Navigate', keywords: 'old admin' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard'), category: '🧭 Navigate', keywords: 'home' },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => navigate('/dashboard/settings'), category: '🧭 Navigate', keywords: 'config' },
    { id: 'sessions', label: 'Sessions', icon: Users, action: () => navigate('/dashboard/settings'), category: '🧭 Navigate', keywords: 'devices' },
    { id: 'changelog', label: 'Changelog', icon: FileJson, action: () => navigate('/changelog'), category: '🧭 Navigate', keywords: 'updates' },
    { id: 'roadmap', label: 'Roadmap', icon: Zap, action: () => navigate('/roadmap'), category: '🧭 Navigate', keywords: 'plans' },
    { id: 'go-back', label: 'Go Back', icon: History, action: () => navigate(-1), category: '🧭 Navigate', keywords: 'previous' },
    { id: 'go-forward', label: 'Go Forward', icon: History, action: () => navigate(1), category: '🧭 Navigate', keywords: 'next' },
    { id: 'go-home', label: 'Go Home', icon: LayoutDashboard, action: () => navigate('/'), category: '🧭 Navigate', keywords: 'landing' },
    
    // Dev Actions
    { 
      id: 'reload', 
      label: 'Empty Cache & Hard Reload', 
      icon: RefreshCw, 
      action: async () => {
        const toastId = showToast.loading('Cleaning caches...');
        
        try {
          // 1. Clear Cache Storage API (Service Worker caches)
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('Caches cleared');
          }

          // 2. Unregister Service Workers
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
            console.log('Service Workers unregistered');
          }

          // 3. Clear Local Forage (if used) or standard storages if requested (preserving for now as this is "Cache" reload)
          // We don't clear localStorage/sessionStorage here as that's separate commands.

          showToast.dismiss(toastId);
          showToast.success('Clean! Reloading...');
          
          // 4. Force Reload
          setTimeout(() => window.location.reload(), 500);
        } catch (error) {
          console.error('Cache clear failed:', error);
          // Fallback to simple reload
          window.location.reload();
        }
      }, 
      category: '⚙️ Dev Tools', 
      keywords: 'refresh clean hard' 
    },
    { id: 'clear-local', label: 'Clear Local Storage', icon: Trash2, action: () => { localStorage.clear(); showToast.loading('Cleared! Reloading...'); setTimeout(() => window.location.reload(), 1000); }, category: '⚙️ Dev Tools', danger: true, keywords: 'reset' },
    { id: 'clear-session', label: 'Clear Session Storage', icon: Database, action: () => { sessionStorage.clear(); showToast.loading('Cleared! Reloading...'); setTimeout(() => window.location.reload(), 1000); }, category: '⚙️ Dev Tools', danger: true, keywords: 'reset' },
    { id: 'force-logout', label: 'Force Logout', icon: LogOut, action: () => { localStorage.clear(); document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")); window.location.href = '/login'; }, category: '⚙️ Dev Tools', danger: true, keywords: 'signout' },
    { id: 'clear-recent', label: 'Clear Recent', icon: XCircle, action: () => { localStorage.removeItem('dev_recent_commands'); setRecentCommands([]); showToast.success('Recent commands cleared'); }, category: '⚙️ Dev Tools', keywords: 'history' },
    { id: 'fullscreen', label: 'Toggle Fullscreen', icon: MonitorSmartphone, action: () => { try { if (document.fullscreenElement) { document.exitFullscreen(); } else { document.documentElement.requestFullscreen().catch(() => showToast.error('Fullscreen not supported')); } } catch { showToast.error('Fullscreen not supported'); } }, category: '⚙️ Dev Tools', keywords: 'full screen maximize' },
    { 
      id: 'simulate-pwa-update', 
      label: 'Simulate PWA Update', 
      icon: Sparkles, 
      action: () => {
        showToast.loading('Simulating PWA Update...', 'Dev Tools');
        setTimeout(() => {
          window.dispatchEvent(new Event('pwa-update-manual-trigger'));
        }, 800);
      }, 
      category: '⚙️ Dev Tools',
      keywords: 'pwa service worker update prompt test'
    },
    
    // Debug
    { 
      id: 'console-state', 
      label: 'Log App State', 
      icon: Bug, 
      action: () => showLog('App State', {
        LocalStorage: {...localStorage},
        SessionStorage: {...sessionStorage},
        Cookies: document.cookie,
        URL: window.location.href,
        UserAgent: navigator.userAgent
      }), 
      category: '🔍 Debug', 
      keywords: 'debug' 
    },
    { 
      id: 'log-time', 
      label: 'Log Timestamp', 
      icon: Clock, 
      action: () => showLog('Timestamp', new Date().toISOString()), 
      category: '🔍 Debug', 
      keywords: 'time' 
    },
    { id: 'copy-token', label: 'Copy Auth Token', icon: Copy, action: () => { const token = document.cookie.match(/jwt=([^;]+)/)?.[1] || localStorage.getItem('token') || 'No token'; navigator.clipboard.writeText(token); showToast.info(token !== 'No token' ? 'Token copied!' : 'No token found', { icon: token !== 'No token' ? '🔑' : '❌' }); }, category: '🔍 Debug', keywords: 'jwt auth' },
    { 
      id: 'viewport-info', 
      label: 'Show Viewport Info', 
      icon: MonitorSmartphone, 
      action: () => showLog('Viewport Info', `Viewport: ${window.innerWidth}x${window.innerHeight}\nScreen: ${screen.width}x${screen.height}\nPixel Ratio: ${window.devicePixelRatio}\nMobile: ${isMobile}`), 
      category: '🔍 Debug', 
      keywords: 'size screen' 
    },
    // Subscription Dev Tools (Self)
    { 
      id: 'add-sub', 
      label: 'Add Pro Subs (Self)', 
      icon: UserPlus, 
      action: async () => {
        try {
          await api.post('/dev/subscription/upgrade');
          showToast.success('Dev: Upgraded to Pro');
          setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
          showToast.error(e.response?.data?.message || 'Failed. Is server in Dev mode?');
        }
      }, 
      category: '⚙️ Dev Tools', 
      keywords: 'upgrade sub pro boost' 
    },
    { 
      id: 'delete-sub-full', 
      label: 'Reset Subs (Full Wipe)', 
      icon: UserX, 
      action: async () => {
        try {
          await api.post('/dev/subscription/reset');
          showToast.success('Dev: Reset + Wiped History');
          setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
          showToast.error(e.response?.data?.message || 'Failed. Is server in Dev mode?');
        }
      }, 
      category: '⚙️ Dev Tools', 
      danger: true,
      keywords: 'cancel remove sub free reset clear wipe' 
    },
    { 
      id: 'delete-sub-soft', 
      label: 'Reset Subs (Keep History)', 
      icon: UserX, 
      action: async () => {
        try {
          await api.post('/dev/subscription/reset?keepHistory=true');
          showToast.success('Dev: Reset (History Kept)');
          setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
          showToast.error(e.response?.data?.message || 'Failed. Is server in Dev mode?');
        }
      }, 
      category: '⚙️ Dev Tools', 
      keywords: 'cancel remove sub free reset soft' 
    },
    { 
      id: 'recycle-code', 
      label: 'Recycle Codes (Keep Tier)', 
      icon: RefreshCw, 
      action: async () => {
        try {
          await api.post('/dev/subscription/clear-history');
          showToast.success('Dev: Codes Recycled (Tier Kept)');
        } catch (e) {
          showToast.error(e.response?.data?.message || 'Failed. Is server in Dev mode?');
        }
      }, 
      category: '⚙️ Dev Tools', 
      keywords: 'recycle clear history reuse code' 
    },
    // Test Link Commands
    { 
      id: 'test-link-single', 
      label: 'Create Test Link (1)', 
      icon: Link2, 
      action: async () => {
        const toastId = showToast.loading('Creating test link...');
        try {
          const { data } = await api.post('/dev/links', { count: 1 });
          showToast.dismiss(toastId);
          showToast.success(`Created: ${data.links[0].alias}`);
        } catch (e) {
          showToast.dismiss(toastId);
          showToast.error(e.response?.data?.message || 'Failed');
        }
      }, 
      category: '⚙️ Dev Tools', 
      keywords: 'test link create single' 
    },
    { 
      id: 'test-link-bulk', 
      label: 'Create Test Links (10)', 
      icon: Database, 
      action: async () => {
        const toastId = showToast.loading('Creating 10 test links...');
        try {
          const { data } = await api.post('/dev/links', { count: 10 });
          showToast.dismiss(toastId);
          showToast.success(`Created ${data.links.length} test links`);
        } catch (e) {
          showToast.dismiss(toastId);
          showToast.error(e.response?.data?.message || 'Failed');
        }
      }, 
      category: '⚙️ Dev Tools', 
      keywords: 'test link create bulk many' 
    },
    { 
      id: 'test-link-custom', 
      label: 'Create Test Links (Custom)', 
      icon: Sparkles, 
      action: async () => {
        const countStr = prompt('How many test links? (1-2000)', '50');
        if (!countStr) return;
        const count = Math.min(Math.max(parseInt(countStr) || 1, 1), 2000);
        const toastId = showToast.loading(`Creating ${count} test links...`);
        try {
          const { data } = await api.post('/dev/links', { count });
          showToast.dismiss(toastId);
          showToast.success(`Created ${data.links.length} test links in ${data.duration || '?'}ms`);
        } catch (e) {
          showToast.dismiss(toastId);
          showToast.error(e.response?.data?.message || 'Failed');
        }
      }, 
      category: '⚙️ Dev Tools', 
      keywords: 'test link create custom amount number' 
    },
    { 
      id: 'test-link-view', 
      label: 'View Test Links', 
      icon: FileJson, 
      action: async () => {
        try {
          const { data } = await api.get('/dev/links');
          if (data.count === 0) {
            showToast.info('No test links found');
            return;
          }
          showLog('Test Links', data.links.map(l => `${l.customAlias} | ${l.title}`).join('\n'));
        } catch (e) {
          showToast.error(e.response?.data?.message || 'Failed');
        }
      }, 
      category: '⚙️ Dev Tools', 
      keywords: 'test link view list show' 
    },
    { 
      id: 'test-link-clear', 
      label: 'Delete All Test Links', 
      icon: Trash2, 
      action: async () => {
        const toastId = showToast.loading('Deleting test links...');
        try {
          const { data } = await api.delete('/dev/links');
          showToast.dismiss(toastId);
          showToast.success(`Deleted ${data.deletedCount} test links`);
        } catch (e) {
          showToast.dismiss(toastId);
          showToast.error(e.response?.data?.message || 'Failed');
        }
      }, 
      category: '⚙️ Dev Tools', 
      danger: true,
      keywords: 'test link delete remove clear' 
    },
    {  
      id: 'network-info', 
      label: 'Network Info', 
      icon: Server, 
      action: () => { 
        const conn = navigator.connection || {}; 
        showLog('Network Info', `Online: ${navigator.onLine}\nType: ${conn.effectiveType || 'unknown'}\nDownlink: ${conn.downlink || 'unknown'} Mbps\nRTT: ${conn.rtt}ms`);
      }, 
      category: '🔍 Debug', 
      keywords: 'connection speed' 
    },
    { id: 'perf-timing', label: 'Page Load Time', icon: Clock, action: () => { const perf = performance.getEntriesByType('navigation')[0]; const loadTime = perf ? Math.round(perf.loadEventEnd - perf.startTime) : 'N/A'; showToast.success(`Page load: ${loadTime}ms`, { icon: '⚡' }); }, category: '🔍 Debug', keywords: 'performance speed' },
    { id: 'scroll-top', label: 'Scroll to Top', icon: CornerDownLeft, action: () => window.scrollTo({ top: 0, behavior: 'smooth' }), category: '🔍 Debug', keywords: 'up' },
    { id: 'scroll-bottom', label: 'Scroll to Bottom', icon: CornerDownLeft, action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), category: '🔍 Debug', keywords: 'down' },
    
    // External
    { id: 'api-health', label: 'API Health', icon: Server, action: () => window.open('/api/health', '_blank'), category: '🔗 Links', keywords: 'server status' },
    { id: 'vite-server', label: 'Vite Server', icon: Zap, action: () => window.open('http://localhost:5173', '_blank'), category: '🔗 Links', keywords: 'frontend' },
    { id: 'backend', label: 'Backend Server', icon: Server, action: () => window.open('http://localhost:5000', '_blank'), category: '🔗 Links', keywords: 'api' },
    { id: 'github', label: 'GitHub', icon: ExternalLink, action: () => window.open('https://github.com/tanaymondal56/Link-Snap', '_blank'), category: '🔗 Links', keywords: 'repo code' },
    
    // Help
    { 
      id: 'help-shortcuts', 
      label: 'Keyboard Help', 
      icon: HelpCircle, 
      action: () => showLog('Shortcuts', 'Ctrl+Shift+D - Open\n↑/↓ - Navigate\nEnter - Execute\nEscape - Close\nType to search'), 
      category: '❓ Help', 
      keywords: 'keys' 
    },
    { id: 'help-about', label: 'About', icon: Info, action: () => { showToast.info('Dev Command Center v2.1', 'About'); }, category: '❓ Help', keywords: 'info' },
    
    // Toast Demo
    { 
      id: 'toast-success', 
      label: 'Toast: Success', 
      icon: CheckCircle, 
      action: () => showToast.success('Your link was created successfully!', 'Link Created'), 
      category: '🎨 Toast Demo', 
      keywords: 'notification alert' 
    },
    { 
      id: 'toast-error', 
      label: 'Toast: Error', 
      icon: XCircle, 
      action: () => showToast.error('Failed to create link. Please try again.', 'Creation Failed'), 
      category: '🎨 Toast Demo', 
      keywords: 'notification alert' 
    },
    { 
      id: 'toast-warning', 
      label: 'Toast: Warning', 
      icon: AlertTriangle, 
      action: () => showToast.warning("You're approaching your monthly limit (80/100).", 'Usage Warning'), 
      category: '🎨 Toast Demo', 
      keywords: 'notification alert' 
    },
    { 
      id: 'toast-info', 
      label: 'Toast: Info', 
      icon: Info, 
      action: () => showToast.info('Your links will expire in 7 days.', 'Good to Know'), 
      category: '🎨 Toast Demo', 
      keywords: 'notification alert' 
    },
    { 
      id: 'toast-loading', 
      label: 'Toast: Loading', 
      icon: Loader2, 
      action: () => { 
        const id = showToast.loading('Creating your short link...', 'Please Wait');
        setTimeout(() => {
          showToast.dismiss(id);
          showToast.success('Link created!', 'Done');
        }, 2500);
      }, 
      category: '🎨 Toast Demo', 
      keywords: 'notification spinner' 
    },
    { 
      id: 'toast-upgrade', 
      label: 'Toast: Upgrade Prompt', 
      icon: Sparkles, 
      action: () => showToast.upgrade(
        'Unlock custom aliases, advanced analytics, and more!', 
        'Upgrade to Pro ✨',
        [{ label: 'View Plans', icon: 'arrow', onClick: () => console.log('Navigate to pricing') }]
      ), 
      category: '🎨 Toast Demo', 
      keywords: 'notification premium' 
    },
    { 
      id: 'toast-limit', 
      label: 'Toast: Limit Reached', 
      icon: Zap, 
      action: () => showToast.limit(
        'You have 25 active links. Delete some to create more.', 
        'Active Limit Reached 📊',
        [
          { label: 'Manage Links', icon: 'arrow', onClick: () => console.log('Navigate to dashboard') },
          { label: 'Upgrade', onClick: () => console.log('Navigate to pricing') }
        ]
      ), 
      category: '🎨 Toast Demo', 
      keywords: 'notification quota' 
    },
    { 
      id: 'toast-all', 
      label: 'Toast: Show All Types', 
      icon: Bell, 
      action: () => {
        showToast.success('Success notification', 'Success');
        setTimeout(() => showToast.error('Error notification', 'Error'), 300);
        setTimeout(() => showToast.warning('Warning notification', 'Warning'), 600);
        setTimeout(() => showToast.info('Info notification', 'Info'), 900);
        setTimeout(() => showToast.upgrade('Upgrade prompt', 'Upgrade'), 1200);
      }, 
      category: '🎨 Toast Demo', 
      keywords: 'notification demo all' 
    },
  ], [navigate]);

  // Add recent commands to top
  const commandsWithRecent = useMemo(() => {
    if (searchTerm || recentCommands.length === 0) return commands;
    
    const recentCmds = recentCommands
      .slice(0, 3)
      .map(id => commands.find(c => c.id === id))
      .filter(Boolean)
      .map(cmd => ({ ...cmd, category: 'Recent' }));
    
    return [...recentCmds, ...commands];
  }, [commands, recentCommands, searchTerm]);

  // Extract unique categories for filter chips (excluding Recent which is auto-added)
  const categories = useMemo(() => {
    const cats = [...new Set(commands.map(c => c.category))];
    return ['All', ...cats];
  }, [commands]);

  // Filter commands by search AND category
  const filteredCommands = useMemo(() => {
    let filtered = commandsWithRecent;
    
    // Category filter (skip if 'All')
    if (categoryFilter !== 'All') {
      filtered = filtered.filter(cmd => cmd.category === categoryFilter);
    }
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(cmd =>
        cmd.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cmd.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cmd.keywords && cmd.keywords.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return filtered;
  }, [commandsWithRecent, searchTerm, categoryFilter]);

  // Reset selection on search change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Group by category
  const groupedCommands = useMemo(() => filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {}), [filteredCommands]);

  // Global keyboard shortcut
  const handleGlobalKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      setIsOpen(prev => !prev);
      setSearchTerm('');
      setSelectedIndex(0);
    }
    if (e.key === 'Escape' && isOpen) {
      handleClose();
      setSearchTerm('');
    }
  }, [isOpen, handleClose]);

  // Modal keyboard navigation
  const handleModalKeyDown = useCallback((e) => {
    if (!isOpen || filteredCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => prev < filteredCommands.length - 1 ? prev + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredCommands.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        cmd.action();
        handleClose();
      }
    }
  }, [isOpen, filteredCommands, selectedIndex, handleClose]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, isOpen]);

  // Add keyboard listeners
  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  // Lock body scroll when open (NO auto-focus on mobile)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Only auto-focus on desktop
      if (!isMobile) {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Don't render in production
  if (!isDev) return null;

  let flatIndex = -1;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setIsOpen(true); setSearchTerm(''); setSelectedIndex(0); }}
        className={`fixed z-40 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-full shadow-lg transition-all hover:scale-110 ${
          isMobile ? 'bottom-20 right-4 p-4' : 'bottom-4 right-4 p-3'
        }`}
        aria-label="Dev Commands"
      >
        <Command size={isMobile ? 24 : 20} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div 
          className={`fixed inset-0 z-50 ${isMobile ? 'flex flex-col' : 'flex items-start justify-center pt-[8vh] px-4'}`}
          onKeyDown={handleModalKeyDown}
        >
          {/* Backdrop with subtle gradient */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-black/90 to-purple-900/30 backdrop-blur-xl" 
            onClick={handleClose} 
          />

          {/* Animated glow behind panel - desktop only */}
          {!isMobile && (
            <div className="absolute inset-0 flex items-start justify-center pt-[8vh] pointer-events-none">
              <div 
                className="w-[500px] h-[400px] rounded-full opacity-30 blur-3xl"
                style={{
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(59, 130, 246, 0.3) 50%, transparent 70%)',
                  animation: 'pulse 4s ease-in-out infinite'
                }}
              />
            </div>
          )}

          {/* Panel - Mobile Full Screen / Desktop Centered */}
          <div 
            className={`relative overflow-hidden ${
              isMobile 
                ? 'flex-1 w-full mt-auto rounded-t-3xl max-h-[85vh]' 
                : 'w-full max-w-lg rounded-3xl'
            }`}
            style={{ 
              animation: isMobile ? 'slideUpMobile 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined
            }}
          >
            {/* Noise texture overlay */}
            <div 
              className="absolute inset-0 opacity-[0.015] pointer-events-none z-10"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%" height="100%" filter="url(%23noise)"/%3E%3C/svg%3E")' }}
            />
            
            {/* Glass container */}
            <div className={`relative bg-gray-900/95 backdrop-blur-2xl border-t border-x border-white/10 shadow-2xl shadow-purple-900/30 ${isMobile ? 'h-full flex flex-col' : ''}`}>
              {/* Mobile drag handle */}
              {isMobile && (
                <div className="flex justify-center pt-3 pb-1" onClick={handleClose}>
                  <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
                </div>
              )}
              
              {/* Animated gradient border at top - desktop only */}
              {!isMobile && (
                <div 
                  className="h-1 relative overflow-hidden"
                  style={{ background: 'linear-gradient(90deg, #8b5cf6, #3b82f6, #06b6d4, #8b5cf6)', backgroundSize: '200% 100%', animation: 'shimmer 3s linear infinite' }}
                />
              )}
              
              {/* Search */}
              <div className="p-4 md:p-5">
                <div className="relative group">
                  <Command size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors duration-200" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleModalKeyDown}
                    placeholder="Type a command..."
                    className="w-full pl-11 pr-12 py-3.5 bg-gray-800/50 border border-gray-700/40 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-gray-800/80 focus:shadow-lg focus:shadow-purple-500/10 transition-all duration-300"
                    autoFocus={!isMobile}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  {searchTerm ? (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white hover:scale-110 transition-all duration-200"
                    >
                      <XCircle size={18} />
                    </button>
                  ) : (
                    <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 px-2 py-1 bg-gray-700/50 border border-gray-600/30 rounded-lg text-[10px] text-gray-500 font-mono">
                      ⌘ D
                    </kbd>
                  )}
                </div>
              </div>

              {/* Category Filter Chips */}
              <div 
                ref={chipsRef}
                className="flex gap-2 px-4 md:px-5 pb-4 overflow-x-auto"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setSelectedIndex(0); }}
                    className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-100 ${
                      categoryFilter === cat
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30 scale-[1.02]'
                        : 'bg-gray-800/40 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200 hover:scale-[1.02] border border-gray-700/30'
                    }`}
                  >
                    {cat === 'All' ? '✨ All' : cat.replace(/^[^\s]+\s/, '')}
                  </button>
                ))}
              </div>

              {/* Soft divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

              {/* Commands */}
              <div ref={listRef} className="max-h-[45vh] md:max-h-[50vh] overflow-y-auto overscroll-contain">
                {Object.entries(groupedCommands).map(([category, cmds]) => (
                  <div key={category}>
                    {/* Category headers only when no filter (showing all) */}
                    {categoryFilter === 'All' && (
                      <div className={`px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] sticky top-0 z-10 backdrop-blur-md ${
                        category === 'Recent' 
                          ? 'text-purple-400 bg-purple-900/30' 
                          : 'text-gray-500 bg-gray-900/70'
                      }`}>
                        {category === 'Recent' && <History size={10} className="inline mr-1.5 -mt-0.5" />}
                        {category.replace(/^[^\s]+\s/, '')}
                      </div>
                    )}
                    {cmds.map((cmd) => {
                      flatIndex++;
                      const isSelected = flatIndex === selectedIndex;
                      return (
                        <button
                          key={`${cmd.id}-${category}`}
                          data-index={flatIndex}
                          onClick={() => executeCommand(cmd)}
                          className={`relative w-full flex items-center gap-4 px-5 py-3 text-left min-h-[52px] group transition-colors duration-75 ${
                            isSelected 
                              ? 'bg-gradient-to-r from-purple-600/20 via-blue-600/15 to-transparent'
                              : 'hover:bg-gradient-to-r hover:from-gray-800/50 hover:to-transparent'
                          }`}
                        >
                          {/* Selection indicator */}
                          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full transition-opacity duration-75 ${
                            isSelected ? 'bg-gradient-to-b from-purple-400 to-blue-400 opacity-100' : 'opacity-0'
                          }`} />
                          
                          {/* Icon with glow */}
                          <div className={`relative p-2.5 rounded-xl transition-colors duration-75 ${
                            cmd.danger 
                              ? 'bg-red-500/10 group-hover:bg-red-500/20' 
                              : isSelected 
                                ? 'bg-purple-500/20 shadow-lg shadow-purple-500/20' 
                                : 'bg-gray-800/60 group-hover:bg-gray-700/60'
                          }`}>
                            <cmd.icon size={16} className={`transition-all duration-200 ${
                              cmd.danger ? 'text-red-400' : isSelected ? 'text-purple-300' : 'text-gray-400 group-hover:text-gray-300'
                            }`} />
                          </div>
                          
                          {/* Label */}
                          <span className={`flex-1 text-sm font-medium truncate transition-colors duration-200 ${
                            cmd.danger ? 'text-red-300' : isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'
                          }`}>
                            {cmd.label}
                          </span>
                          
                          {/* External link indicator */}
                          {cmd.category === '🔗 Links' && (
                            <ExternalLink size={12} className="text-gray-600 shrink-0 group-hover:text-gray-400 transition-colors" />
                          )}
                          
                          {/* Keyboard hint */}
                          {isSelected && !isMobile && (
                            <div className="shrink-0 flex items-center gap-1">
                              <kbd className="px-2 py-1 bg-purple-500/20 border border-purple-400/30 rounded-lg text-[10px] text-purple-300 font-mono shadow-sm">
                                ↵
                              </kbd>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              
              {filteredCommands.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <div className="text-gray-600 text-4xl mb-2">🔍</div>
                  <div className="text-gray-500 text-sm">No commands found</div>
                  <div className="text-gray-600 text-xs mt-1">Try a different search</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-800/30 bg-gradient-to-r from-gray-900/90 to-gray-800/50 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-4 text-gray-500">
                {!isMobile && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 bg-gray-800/80 border border-gray-700/50 rounded text-[9px] font-mono">↑↓</kbd>
                      <span className="text-gray-600">navigate</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 bg-gray-800/80 border border-gray-700/50 rounded text-[9px] font-mono">↵</kbd>
                      <span className="text-gray-600">select</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 bg-gray-800/80 border border-gray-700/50 rounded text-[9px] font-mono">esc</kbd>
                      <span className="text-gray-600">close</span>
                    </span>
                  </>
                )}
                {isMobile && <span className="text-gray-600">Swipe down or tap outside</span>}
              </div>
              <span className="flex items-center gap-2 text-gray-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {filteredCommands.length} commands
              </span>
            </div>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideUpMobile {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Log Modal */}
      {logResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setLogResult(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-blue-400" />
                <h3 className="font-mono text-sm font-bold text-white uppercase">{logResult.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { navigator.clipboard.writeText(logResult.content); showToast.success('Copied!'); }}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={16} />
                </button>
                <button 
                  onClick={() => setLogResult(null)}
                  className="p-1.5 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-[#0d1117]">
              <pre className="font-mono text-xs md:text-sm text-green-400 whitespace-pre-wrap break-all">
                {logResult.content}
              </pre>
            </div>
            <div className="px-4 py-2 border-t border-gray-800 bg-gray-800/50 text-xs text-gray-500 flex justify-between">
              <span>{logResult.content.length} chars</span>
              <span>JSON / Text</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DevCommandCenter;
