import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, AlertCircle, Info, Calendar, X, Loader2 } from 'lucide-react';
import api from '../../api/axios';

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-500'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500'
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-500'
  },
  summary: {
    icon: Calendar,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    dot: 'bg-purple-500'
  }
};

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const dropdownRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    try {
      const { data } = await api.get('/admin/notifications/count');
      setUnreadCount(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/notifications?limit=15');
      setNotifications(data.notifications || []);
      setUnreadCount(data.totalUnread || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    setMarkingRead(true);
    try {
      await api.patch('/admin/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setMarkingRead(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-gray-900/40 border border-white/5 hover:bg-white/5 text-gray-400 hover:text-white transition-all"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full px-1 animate-in zoom-in duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-400">{unreadCount} unread</p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingRead}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
              >
                {markingRead ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCheck size={14} />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 flex items-center justify-center text-gray-400">
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => {
                  const config = severityConfig[notification.severity] || severityConfig.info;
                  const Icon = config.icon;

                  return (
                    <div
                      key={notification._id}
                      className={`p-4 hover:bg-white/5 transition-colors ${!notification.isRead ? 'bg-white/[0.02]' : ''}`}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`shrink-0 w-9 h-9 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center`}>
                          <Icon size={18} className={config.color} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium text-white truncate">
                              {notification.title}
                              {!notification.isRead && (
                                <span className={`inline-block w-2 h-2 rounded-full ${config.dot} ml-2`} />
                              )}
                            </h4>
                            <span className="text-xs text-gray-500 shrink-0">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          {notification.count > 1 && (
                            <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/10 text-gray-300">
                              {notification.count} events
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-white/5 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
