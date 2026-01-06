import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
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
  UserPlus
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
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);

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
      setIsOpen(false);
    }
  }, []);

  // Commands - simplified and working
  const commands = useMemo(() => [
    // Quick Actions
    { id: 'share-url', label: 'Copy Page URL', icon: Share2, action: () => { navigator.clipboard.writeText(window.location.href); toast.success('URL copied!'); }, category: 'Quick', keywords: 'copy link share' },
    { id: 'create-link', label: 'Create New Link', icon: Link2, action: () => navigate('/dashboard'), category: 'Quick', keywords: 'shorten url' },
    { id: 'qr-code', label: 'Copy Page URL (QR)', icon: Share2, action: () => { navigator.clipboard.writeText(window.location.href); toast.success('URL copied! Use any QR generator.'); }, category: 'Quick', keywords: 'qrcode scan share' },
    
    // Navigation
    { id: 'admin-console', label: 'Admin Console', icon: Shield, action: () => navigate('/admin-console'), category: 'Navigation', keywords: 'admin panel' },
    { id: 'legacy-admin', label: 'Legacy Admin', icon: Terminal, action: () => navigate('/admin'), category: 'Navigation', keywords: 'old admin' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard'), category: 'Navigation', keywords: 'home' },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => navigate('/dashboard/settings'), category: 'Navigation', keywords: 'config' },
    { id: 'sessions', label: 'Sessions', icon: Users, action: () => navigate('/dashboard/settings'), category: 'Navigation', keywords: 'devices' },
    { id: 'changelog', label: 'Changelog', icon: FileJson, action: () => navigate('/changelog'), category: 'Navigation', keywords: 'updates' },
    { id: 'roadmap', label: 'Roadmap', icon: Zap, action: () => navigate('/roadmap'), category: 'Navigation', keywords: 'plans' },
    { id: 'go-back', label: 'Go Back', icon: History, action: () => navigate(-1), category: 'Navigation', keywords: 'previous' },
    { id: 'go-forward', label: 'Go Forward', icon: History, action: () => navigate(1), category: 'Navigation', keywords: 'next' },
    { id: 'go-home', label: 'Go Home', icon: LayoutDashboard, action: () => navigate('/'), category: 'Navigation', keywords: 'landing' },
    
    // Dev Actions
    { 
      id: 'reload', 
      label: 'Empty Cache & Hard Reload', 
      icon: RefreshCw, 
      action: async () => {
        const toastId = toast.loading('Cleaning caches...');
        
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

          toast.success('Clean! Reloading...', { id: toastId });
          
          // 4. Force Reload
          setTimeout(() => window.location.reload(), 500);
        } catch (error) {
          console.error('Cache clear failed:', error);
          // Fallback to simple reload
          window.location.reload();
        }
      }, 
      category: 'Dev', 
      keywords: 'refresh clean hard' 
    },
    { id: 'clear-local', label: 'Clear Local Storage', icon: Trash2, action: () => { localStorage.clear(); toast.loading('Cleared! Reloading...'); setTimeout(() => window.location.reload(), 1000); }, category: 'Dev', danger: true, keywords: 'reset' },
    { id: 'clear-session', label: 'Clear Session Storage', icon: Database, action: () => { sessionStorage.clear(); toast.loading('Cleared! Reloading...'); setTimeout(() => window.location.reload(), 1000); }, category: 'Dev', danger: true, keywords: 'reset' },
    { id: 'force-logout', label: 'Force Logout', icon: LogOut, action: () => { localStorage.clear(); document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")); window.location.href = '/login'; }, category: 'Dev', danger: true, keywords: 'signout' },
    { id: 'clear-recent', label: 'Clear Recent', icon: XCircle, action: () => { localStorage.removeItem('dev_recent_commands'); setRecentCommands([]); toast.success('Recent commands cleared'); }, category: 'Dev', keywords: 'history' },
    { id: 'fullscreen', label: 'Toggle Fullscreen', icon: MonitorSmartphone, action: () => { try { if (document.fullscreenElement) { document.exitFullscreen(); } else { document.documentElement.requestFullscreen().catch(() => toast.error('Fullscreen not supported')); } } catch { toast.error('Fullscreen not supported'); } }, category: 'Dev', keywords: 'full screen maximize' },
    
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
      category: 'Debug', 
      keywords: 'debug' 
    },
    { 
      id: 'log-time', 
      label: 'Log Timestamp', 
      icon: Clock, 
      action: () => showLog('Timestamp', new Date().toISOString()), 
      category: 'Debug', 
      keywords: 'time' 
    },
    { id: 'copy-token', label: 'Copy Auth Token', icon: Copy, action: () => { const token = document.cookie.match(/jwt=([^;]+)/)?.[1] || localStorage.getItem('token') || 'No token'; navigator.clipboard.writeText(token); toast(token !== 'No token' ? 'Token copied!' : 'No token found', { icon: token !== 'No token' ? '🔑' : '❌' }); }, category: 'Debug', keywords: 'jwt auth' },
    { 
      id: 'viewport-info', 
      label: 'Show Viewport Info', 
      icon: MonitorSmartphone, 
      action: () => showLog('Viewport Info', `Viewport: ${window.innerWidth}x${window.innerHeight}\nScreen: ${screen.width}x${screen.height}\nPixel Ratio: ${window.devicePixelRatio}\nMobile: ${isMobile}`), 
      category: 'Debug', 
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
          toast.success('Dev: Upgraded to Pro');
          setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
          toast.error(e.response?.data?.message || 'Failed. Is server in Dev mode?');
        }
      }, 
      category: 'Dev', 
      keywords: 'upgrade sub pro boost' 
    },
    { 
      id: 'delete-sub-full', 
      label: 'Reset Subs (Full Wipe)', 
      icon: UserX, 
      action: async () => {
        try {
          await api.post('/dev/subscription/reset');
          toast.success('Dev: Reset + Wiped History');
          setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
          toast.error(e.response?.data?.message || 'Failed. Is server in Dev mode?');
        }
      }, 
      category: 'Dev', 
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
          toast.success('Dev: Reset (History Kept)');
          setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
          toast.error(e.response?.data?.message || 'Failed. Is server in Dev mode?');
        }
      }, 
      category: 'Dev', 
      keywords: 'cancel remove sub free reset soft' 
    },
    { 
      id: 'recycle-code', 
      label: 'Recycle Codes (Keep Tier)', 
      icon: RefreshCw, 
      action: async () => {
        try {
          await api.post('/dev/subscription/clear-history');
          toast.success('Dev: Codes Recycled (Tier Kept)');
        } catch (e) {
          toast.error(e.response?.data?.message || 'Failed. Is server in Dev mode?');
        }
      }, 
      category: 'Dev', 
      keywords: 'recycle clear history reuse code' 
    },
    {  
      id: 'network-info', 
      label: 'Network Info', 
      icon: Server, 
      action: () => { 
        const conn = navigator.connection || {}; 
        showLog('Network Info', `Online: ${navigator.onLine}\nType: ${conn.effectiveType || 'unknown'}\nDownlink: ${conn.downlink || 'unknown'} Mbps\nRTT: ${conn.rtt}ms`);
      }, 
      category: 'Debug', 
      keywords: 'connection speed' 
    },
    { id: 'perf-timing', label: 'Page Load Time', icon: Clock, action: () => { const perf = performance.getEntriesByType('navigation')[0]; const loadTime = perf ? Math.round(perf.loadEventEnd - perf.startTime) : 'N/A'; toast.success(`Page load: ${loadTime}ms`, { icon: '⚡' }); }, category: 'Debug', keywords: 'performance speed' },
    { id: 'scroll-top', label: 'Scroll to Top', icon: CornerDownLeft, action: () => window.scrollTo({ top: 0, behavior: 'smooth' }), category: 'Debug', keywords: 'up' },
    { id: 'scroll-bottom', label: 'Scroll to Bottom', icon: CornerDownLeft, action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), category: 'Debug', keywords: 'down' },
    
    // External
    { id: 'api-health', label: 'API Health', icon: Server, action: () => window.open('/api/health', '_blank'), category: 'External', keywords: 'server status' },
    { id: 'vite-server', label: 'Vite Server', icon: Zap, action: () => window.open('http://localhost:5173', '_blank'), category: 'External', keywords: 'frontend' },
    { id: 'backend', label: 'Backend Server', icon: Server, action: () => window.open('http://localhost:5000', '_blank'), category: 'External', keywords: 'api' },
    { id: 'github', label: 'GitHub', icon: ExternalLink, action: () => window.open('https://github.com/tanaymondal56/Link-Snap', '_blank'), category: 'External', keywords: 'repo code' },
    
    // Help
    { 
      id: 'help-shortcuts', 
      label: 'Keyboard Help', 
      icon: HelpCircle, 
      action: () => showLog('Shortcuts', 'Ctrl+Shift+D - Open\n↑/↓ - Navigate\nEnter - Execute\nEscape - Close\nType to search'), 
      category: 'Help', 
      keywords: 'keys' 
    },
    { id: 'help-about', label: 'About', icon: Info, action: () => { toast('Dev Command Center v2.1', { icon: '🛠️' }); }, category: 'Help', keywords: 'info' },
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

  // Filter commands
  const filteredCommands = useMemo(() => commandsWithRecent.filter(cmd =>
    cmd.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cmd.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cmd.keywords && cmd.keywords.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [commandsWithRecent, searchTerm]);

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
      setIsOpen(false);
      setSearchTerm('');
    }
  }, [isOpen]);

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
        setIsOpen(false);
      }
    }
  }, [isOpen, filteredCommands, selectedIndex]);

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
          className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] md:pt-[12vh]"
          onKeyDown={handleModalKeyDown}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="relative w-full max-w-xl mx-2 md:mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 bg-gradient-to-r from-purple-900/50 to-blue-900/50">
              <Terminal size={20} className="text-purple-400" />
              <span className="font-semibold text-white">Dev Commands</span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">v2</span>
              <button onClick={() => setIsOpen(false)} className="ml-auto p-1.5 hover:bg-gray-700 rounded">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Search - NO autoFocus on mobile */}
            <div className="p-3 border-b border-gray-800">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleModalKeyDown}
                placeholder="Search commands..."
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                autoFocus={!isMobile}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>

            {/* Commands */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category}>
                  <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider sticky top-0 ${
                    category === 'Recent' ? 'text-purple-400 bg-purple-900/30' : 'text-gray-500 bg-gray-800/90'
                  }`}>
                    {category === 'Recent' && <History size={12} className="inline mr-1" />}
                    {category}
                  </div>
                  {cmds.map((cmd) => {
                    flatIndex++;
                    const isSelected = flatIndex === selectedIndex;
                    return (
                      <button
                        key={`${cmd.id}-${category}`}
                        data-index={flatIndex}
                        onClick={() => executeCommand(cmd)}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                          isSelected 
                            ? cmd.danger ? 'bg-red-900/40' : 'bg-purple-900/40'
                            : cmd.danger ? 'hover:bg-red-900/30' : 'hover:bg-gray-800'
                        }`}
                      >
                        <cmd.icon size={18} className={cmd.danger ? 'text-red-400' : isSelected ? 'text-purple-400' : 'text-gray-400'} />
                        <span className={`flex-1 ${cmd.danger ? 'text-red-300' : 'text-white'}`}>{cmd.label}</span>
                        {cmd.category === 'External' && <ExternalLink size={14} className="text-gray-600" />}
                        {isSelected && !isMobile && (
                          <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                            <CornerDownLeft size={12} />
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              
              {filteredCommands.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500">
                  No commands found
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/50 flex justify-between text-xs text-gray-600">
              <span>🛠️ Dev Only</span>
              <span>{filteredCommands.length} commands</span>
            </div>
          </div>
        </div>
      )}
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
                  onClick={() => { navigator.clipboard.writeText(logResult.content); toast.success('Copied!'); }}
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
