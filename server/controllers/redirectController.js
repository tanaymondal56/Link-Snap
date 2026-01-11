import User from '../models/User.js';
import Url from '../models/Url.js';
import { trackVisit } from '../services/analyticsService.js';
import { getFromCache, setInCache, getSubscriptionCache, setSubscriptionCache } from '../services/cacheService.js';
import { checkAndIncrementClickUsage } from '../middleware/subscriptionMiddleware.js';
import { getDeviceRedirectUrl } from '../services/deviceDetector.js';
import { isLinkActive, getTimeBasedDestination } from '../services/timeService.js';
import { hasFeature } from '../services/subscriptionService.js';

// Helper to escape HTML to prevent XSS
const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Helper to escape regex special characters from user input
// Prevents regex injection attacks when using user input in RegExp
const escapeRegex = (str) => {
    if (!str) return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Beautiful HTML page for link preview (when user adds + or / at end)
const getLinkPreviewPage = (url, shortUrl, randomUrl, customUrl, viewingViaCustom) => {
    const safeTitle = escapeHtml(url.title || url.shortId);
    const safeOriginalUrl = escapeHtml(url.originalUrl);
    // Escape user-controllable URLs to prevent XSS
    const safeShortUrl = escapeHtml(shortUrl);
    const safeRandomUrl = escapeHtml(randomUrl || '');
    const safeCustomUrl = escapeHtml(customUrl || '');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Preview - ${safeTitle} | Link Snap</title>
    <meta name="description" content="Preview for ${safeOriginalUrl}">
    <link rel="icon" href="/favicon.ico">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
            color: #fff;
            padding: 20px;
            overflow-x: hidden;
        }
        
        /* Animated background orbs */
        .orb {
            position: fixed;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.4;
            animation: float 8s ease-in-out infinite;
        }
        
        .orb-1 {
            width: 500px;
            height: 500px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            top: -150px;
            left: -150px;
            animation-delay: 0s;
        }
        
        .orb-2 {
            width: 400px;
            height: 400px;
            background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);
            bottom: -100px;
            right: -100px;
            animation-delay: -4s;
        }
        
        .orb-3 {
            width: 300px;
            height: 300px;
            background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
            top: 60%;
            left: 20%;
            animation-delay: -2s;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-30px) scale(1.05); }
        }
        
        .container {
            position: relative;
            z-index: 10;
            max-width: 600px;
            width: 100%;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 28px;
            padding: 40px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        
        .header {
            text-align: center;
            margin-bottom: 32px;
        }
        
        .logo {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 100px;
            margin-bottom: 24px;
        }
        
        .logo svg {
            width: 20px;
            height: 20px;
        }
        
        .logo span {
            font-weight: 600;
            font-size: 0.9rem;
            background: linear-gradient(135deg, #6366f1, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            border-radius: 100px;
            font-size: 0.8rem;
            color: #22c55e;
            margin-bottom: 20px;
        }
        
        .badge.inactive {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.3);
            color: #ef4444;
        }
        
        .badge svg {
            width: 14px;
            height: 14px;
        }
        
        h1 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 8px;
            color: #fff;
        }
        
        .short-url {
            font-size: 1.1rem;
            color: #818cf8;
            font-family: 'SF Mono', Monaco, monospace;
        }
        
        .destination-section {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 24px;
        }
        
        .destination-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 12px;
        }
        
        .destination-label svg {
            width: 14px;
            height: 14px;
        }
        
        .destination-url {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 16px;
            word-break: break-all;
        }
        
        .favicon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        
        .favicon img {
            width: 20px;
            height: 20px;
            border-radius: 4px;
        }
        
        .favicon svg {
            width: 16px;
            height: 16px;
            stroke: #64748b;
        }
        
        .url-text {
            flex: 1;
            font-size: 0.95rem;
            color: #e2e8f0;
            line-height: 1.5;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 16px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .stat-label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-top: 4px;
        }
        
        .warning-box {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            background: rgba(251, 191, 36, 0.1);
            border: 1px solid rgba(251, 191, 36, 0.2);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
        }
        
        .warning-box svg {
            width: 20px;
            height: 20px;
            stroke: #fbbf24;
            flex-shrink: 0;
            margin-top: 2px;
        }
        
        .warning-box p {
            font-size: 0.85rem;
            color: #fcd34d;
            line-height: 1.5;
        }
        
        .cta-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 16px 24px;
            border-radius: 14px;
            font-size: 1rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
            background-size: 200% 200%;
            animation: gradient-shift 3s ease infinite;
            color: #fff;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        }
        
        @keyframes gradient-shift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(99, 102, 241, 0.5);
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #e2e8f0;
        }
        
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
        }
        
        .btn svg {
            width: 20px;
            height: 20px;
        }
        
        .footer {
            text-align: center;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .footer p {
            color: #475569;
            font-size: 0.8rem;
        }
        
        .footer a {
            color: #818cf8;
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .copy-toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(34, 197, 94, 0.9);
            color: #fff;
            padding: 12px 24px;
            border-radius: 100px;
            font-size: 0.9rem;
            font-weight: 500;
            opacity: 0;
            transition: all 0.3s ease;
            z-index: 100;
        }
        
        .copy-toast.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        
        .alternate-link {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 12px;
            padding: 10px 16px;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 10px;
        }
        
        .alternate-link-label {
            font-size: 0.75rem;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .alternate-link-url {
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.9rem;
            color: #a78bfa;
            cursor: pointer;
            transition: color 0.2s;
        }
        
        .alternate-link-url:hover {
            color: #c4b5fd;
        }
        
        .alternate-link-copy {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 6px;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .alternate-link-copy:hover {
            background: rgba(99, 102, 241, 0.2);
        }
        
        .alternate-link-copy svg {
            width: 14px;
            height: 14px;
            stroke: #a78bfa;
        }
        
        @media (max-width: 480px) {
            .card {
                padding: 28px 20px;
            }
            
            .stats-grid {
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
            }
            
            .stat-card {
                padding: 12px 8px;
            }
            
            .stat-value {
                font-size: 1.2rem;
            }
        }
    </style>
</head>
<body>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    
    <div class="container">
        <div class="card">
            <div class="header">
                <div class="logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <span>Link Snap</span>
                </div>
                
                <div class="badge ${url.isActive ? '' : 'inactive'}">
                    ${url.isActive ? `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        Active Link
                    ` : `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Inactive Link
                    `}
                </div>
                
                <h1>${safeTitle}</h1>
                <p class="short-url">${safeShortUrl}</p>
                ${viewingViaCustom && randomUrl ? `
                    <div class="alternate-link">
                        <span class="alternate-link-label">Also available at:</span>
                        <span class="alternate-link-url" onclick="copyAlternateLink()">${safeRandomUrl}</span>
                        <button class="alternate-link-copy" onclick="copyAlternateLink()" title="Copy random link">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                    </div>
                ` : ''}
                ${!viewingViaCustom && customUrl ? `
                    <div class="alternate-link">
                        <span class="alternate-link-label">Custom alias:</span>
                        <span class="alternate-link-url" onclick="copyCustomLink()">${safeCustomUrl}</span>
                        <button class="alternate-link-copy" onclick="copyCustomLink()" title="Copy custom link">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                    </div>
                ` : ''}
            </div>
            
            <div class="destination-section">
                <div class="destination-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Destination URL
                </div>
                <div class="destination-url">
                    <div class="favicon">
                        <img src="https://www.google.com/s2/favicons?domain=${new URL(url.originalUrl).hostname}&sz=64" 
                             onerror="this.style.display='none';this.nextElementSibling.style.display='block';" alt="">
                        <svg style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                    </div>
                    <span class="url-text">${safeOriginalUrl}</span>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${url.clicks.toLocaleString()}</div>
                    <div class="stat-label">Total Clicks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formatDate(url.createdAt)}</div>
                    <div class="stat-label">Created</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${getDaysAgo(url.createdAt)}</div>
                    <div class="stat-label">Days Active</div>
                </div>
            </div>
            
            <div class="warning-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p>
                    <strong>You're about to leave Link Snap.</strong><br>
                    Make sure you trust this destination before proceeding. We're not responsible for external content.
                </p>
            </div>
            
            <div class="cta-section">
                ${url.isActive ? `
                    <a href="${url.originalUrl}" class="btn btn-primary" rel="noopener noreferrer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        Continue to Destination
                    </a>
                ` : `
                    <button class="btn btn-primary" disabled style="opacity: 0.5; cursor: not-allowed;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Link is Disabled
                    </button>
                `}
                <button class="btn btn-secondary" onclick="copyLink()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy Short Link
                </button>
            </div>
            
            <div class="footer">
                <p>Powered by <a href="/">Link Snap</a> — Fast, secure URL shortening</p>
            </div>
        </div>
    </div>
    
    <div class="copy-toast" id="copyToast">✓ Link copied to clipboard!</div>
    
    <script>
        function copyLink() {
            navigator.clipboard.writeText('${safeShortUrl}').then(() => {
                showToast();
            });
        }
        
        function copyAlternateLink() {
            navigator.clipboard.writeText('${safeRandomUrl}').then(() => {
                showToast();
            });
        }
        
        function copyCustomLink() {
            navigator.clipboard.writeText('${safeCustomUrl}').then(() => {
                showToast();
            });
        }
        
        function showToast() {
            const toast = document.getElementById('copyToast');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }
    </script>
</body>
</html>
`;
};

// Helper functions for preview page
const formatDate = (date) => {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
};

const getDaysAgo = (date) => {
    const now = new Date();
    const created = new Date(date);
    const diffTime = Math.abs(now - created);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Beautiful HTML page for inactive links
const getInactiveLinkPage = () => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Unavailable - Link Snap</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
            color: #fff;
            padding: 20px;
            overflow: hidden;
        }
        
        /* Animated background orbs */
        .orb {
            position: fixed;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.5;
            animation: float 8s ease-in-out infinite;
        }
        
        .orb-1 {
            width: 400px;
            height: 400px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            top: -100px;
            left: -100px;
            animation-delay: 0s;
        }
        
        .orb-2 {
            width: 300px;
            height: 300px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            bottom: -50px;
            right: -50px;
            animation-delay: -4s;
        }
        
        .orb-3 {
            width: 200px;
            height: 200px;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            animation-delay: -2s;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-30px) scale(1.05); }
        }
        
        .container {
            position: relative;
            z-index: 10;
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 48px 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        
        .icon-container {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid rgba(239, 68, 68, 0.3);
        }
        
        .icon {
            width: 40px;
            height: 40px;
            stroke: #ef4444;
            stroke-width: 2;
            fill: none;
        }
        
        h1 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 12px;
            background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .subtitle {
            color: #94a3b8;
            font-size: 1rem;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        
        .info-box {
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
        }
        
        .info-box p {
            color: #a5b4fc;
            font-size: 0.875rem;
            line-height: 1.5;
        }
        
        .link-id {
            display: inline-block;
            background: rgba(255, 255, 255, 0.1);
            padding: 4px 12px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 0.875rem;
            color: #e2e8f0;
            margin-top: 8px;
        }
        
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            margin: 24px 0;
        }
        
        .cta-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px 24px;
            border-radius: 12px;
            font-size: 0.95rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: #fff;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #e2e8f0;
        }
        
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        .footer-text {
            margin-top: 32px;
            color: #64748b;
            font-size: 0.8rem;
        }
        
        .footer-text a {
            color: #818cf8;
            text-decoration: none;
        }
        
        .footer-text a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    
    <div class="container">
        <div class="card">
            <div class="icon-container">
                <svg class="icon" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            </div>
            
            <h1>Link Unavailable</h1>
            <p class="subtitle">
                This shortened link has been deactivated and is no longer redirecting to its destination.
            </p>
            
            <div class="info-box">
                <p>
                    <strong>Why am I seeing this?</strong><br>
                    This link has been deactivated by the owner or an administrator. It may be due to a violation of our terms of service or a manual deactivation.
                </p>
            </div>
            
            <div class="divider"></div>
            
            <div class="cta-section">
                <a href="/" class="btn btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    Go to Homepage
                </a>
                <a href="/dashboard" class="btn btn-secondary">
                    Create Your Own Links
                </a>
            </div>
            
            <p class="footer-text">
                Powered by <a href="/">Link Snap</a> — Fast, secure URL shortening
            </p>
        </div>
    </div>
</body>
</html>
`;

// HTML page for expired links
const getExpiredLinkPage = (shortId, expiresAt) => {
    const expiredDate = expiresAt ? new Date(expiresAt).toLocaleString() : '';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Expired - Link Snap</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
            color: #fff;
            padding: 20px;
        }
        .orb { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.5; animation: float 8s ease-in-out infinite; }
        .orb-1 { width: 400px; height: 400px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); top: -100px; left: -100px; }
        .orb-2 { width: 300px; height: 300px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); bottom: -50px; right: -50px; animation-delay: -4s; }
        @keyframes float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-30px) scale(1.05); } }
        .container { position: relative; z-index: 10; max-width: 500px; width: 100%; text-align: center; }
        .card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 48px 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .icon-container { width: 80px; height: 80px; margin: 0 auto 24px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(245, 158, 11, 0.3); }
        .icon { width: 40px; height: 40px; stroke: #f59e0b; stroke-width: 2; fill: none; }
        h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 12px; background: linear-gradient(135deg, #fff 0%, #fcd34d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .subtitle { color: #94a3b8; font-size: 1rem; line-height: 1.6; margin-bottom: 32px; }
        .info-box { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 16px; padding: 24px; margin-bottom: 32px; text-align: left; }
        .info-box p { color: #fbbf24; font-size: 1.1rem; line-height: 1.6; font-weight: 500; }
        .info-box strong { display: block; margin-bottom: 8px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: #d97706; }
        .link-id { display: inline-block; background: rgba(255, 255, 255, 0.1); padding: 4px 12px; border-radius: 6px; font-family: monospace; color: #f59e0b; margin: 8px 0; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 28px; border-radius: 14px; font-size: 1rem; font-weight: 600; text-decoration: none; transition: all 0.3s ease; cursor: pointer; border: none; width: 100%; margin-bottom: 12px; }
        .btn-primary { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(245, 158, 11, 0.5); }
        .btn-secondary { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #e2e8f0; }
        .footer-text { color: #475569; font-size: 0.8rem; margin-top: 32px; }
        .footer-text a { color: #818cf8; text-decoration: none; }
    </style>
</head>
<body>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="container">
        <div class="card">
            <div class="icon-container">
                <svg class="icon" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
            </div>
            <h1>Link Expired</h1>
            <p class="subtitle">The secure link you are trying to access is no longer active as its designated validity period has lapsed.</p>
            <div class="info-box">
                <p>
                    <strong>Reason for Deactivation</strong><br>
                    This link was configured with an automatic expiration timer which has now reached its conclusion. Access to the destination URL is permanently disabled for this link.
                </p>
                ${expiredDate ? `<p style="font-size: 0.75rem; margin-top: 8px; color: #94a3b8;">Expiration Timestamp: ${expiredDate}</p>` : ''}
            </div>
            <div class="cta-section">
                <a href="/" class="btn btn-primary">Go to Homepage</a>
                <a href="/dashboard" class="btn btn-secondary">Create Your Own Links</a>
            </div>
            <p class="footer-text">Powered by <a href="/">Link Snap</a> — Fast, secure URL shortening</p>
        </div>
    </div>
</body>
</html>
`;
};

// HTML page for scheduled/pending links (not yet active)
const getScheduledLinkPage = (shortId, activeStartTime) => {
    const safeShortId = escapeHtml(shortId);
    const activateDate = new Date(activeStartTime);
    const isoDate = activateDate.toISOString();
    // Get base URL for display (short link only, no real destination exposed)
    const baseUrl = (process.env.BASE_URL || process.env.CLIENT_URL || 'https://linksnap.io').replace(/\/$/, '');
    const shortLink = `${baseUrl}/${safeShortId}`;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Activates Soon - Link Snap</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
            color: #fff;
            padding: 20px;
        }
        .orb { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.5; animation: float 8s ease-in-out infinite; }
        .orb-1 { width: 400px; height: 400px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); top: -100px; left: -100px; }
        .orb-2 { width: 300px; height: 300px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); bottom: -50px; right: -50px; animation-delay: -4s; }
        @keyframes float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-30px) scale(1.05); } }
        .container { position: relative; z-index: 10; max-width: 500px; width: 100%; text-align: center; }
        .card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 48px 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .icon-container { width: 80px; height: 80px; margin: 0 auto 24px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.2) 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(34, 197, 94, 0.3); }
        .icon { width: 40px; height: 40px; stroke: #22c55e; stroke-width: 2; fill: none; }
        h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 12px; background: linear-gradient(135deg, #fff 0%, #86efac 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .subtitle { color: #94a3b8; font-size: 1rem; line-height: 1.6; margin-bottom: 24px; }
        .countdown-box { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 24px; margin-bottom: 24px; }
        .countdown-label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #22c55e; margin-bottom: 12px; }
        .countdown { display: flex; justify-content: center; gap: 12px; margin-bottom: 16px; }
        .countdown-item { background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 12px 16px; min-width: 60px; }
        .countdown-value { font-size: 1.75rem; font-weight: 700; color: #fff; }
        .countdown-unit { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; }
        .activate-date { font-size: 0.9rem; color: #86efac; font-weight: 500; }
        .short-link { display: inline-block; background: rgba(255, 255, 255, 0.1); padding: 8px 16px; border-radius: 8px; font-family: monospace; font-size: 0.9rem; color: #a78bfa; margin-top: 12px; word-break: break-all; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 28px; border-radius: 14px; font-size: 1rem; font-weight: 600; text-decoration: none; transition: all 0.3s ease; cursor: pointer; border: none; width: 100%; margin-top: 8px; }
        .btn-primary { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #fff; box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(34, 197, 94, 0.5); }
        .btn-secondary { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #e2e8f0; margin-top: 12px; }
        .footer-text { color: #475569; font-size: 0.8rem; margin-top: 24px; }
        .footer-text a { color: #818cf8; text-decoration: none; }
        .ready { display: none; }
        .ready.show { display: block; }
        .pending.hide { display: none; }
    </style>
</head>
<body>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="container">
        <div class="card">
            <div class="icon-container">
                <svg class="icon" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
            </div>
            
            <div class="pending">
                <h1>Link Activates Soon</h1>
                <p class="subtitle">This link is scheduled to go live shortly. The countdown below shows when it will become available.</p>
                
                <div class="countdown-box">
                    <div class="countdown-label">Activates in</div>
                    <div class="countdown" id="countdown">
                        <div class="countdown-item">
                            <div class="countdown-value" id="days">--</div>
                            <div class="countdown-unit">Days</div>
                        </div>
                        <div class="countdown-item">
                            <div class="countdown-value" id="hours">--</div>
                            <div class="countdown-unit">Hours</div>
                        </div>
                        <div class="countdown-item">
                            <div class="countdown-value" id="mins">--</div>
                            <div class="countdown-unit">Mins</div>
                        </div>
                        <div class="countdown-item">
                            <div class="countdown-value" id="secs">--</div>
                            <div class="countdown-unit">Secs</div>
                        </div>
                    </div>
                    <div class="activate-date" id="localDate">Loading...</div>
                </div>
                
                <div class="short-link">${shortLink}</div>
            </div>
            
            <div class="ready" id="readySection">
                <h1>Link is Now Live!</h1>
                <p class="subtitle">The link is ready to use. Click below to continue.</p>
                <a href="/${safeShortId}" class="btn btn-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14"/>
                        <path d="m12 5 7 7-7 7"/>
                    </svg>
                    Go to ${shortLink}
                </a>
            </div>
            
            <a href="/" class="btn btn-secondary">Go to Homepage</a>
            
            <p class="footer-text">Powered by <a href="/">Link Snap</a> — Fast, secure URL shortening</p>
        </div>
    </div>
    
    <script>
        const targetDate = new Date('${isoDate}');
        
        // Display date in user's local timezone
        document.getElementById('localDate').textContent = targetDate.toLocaleString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        
        function updateCountdown() {
            const now = new Date();
            const diff = targetDate - now;
            
            if (diff <= 0) {
                // Link is now active - show ready section
                document.querySelector('.pending').classList.add('hide');
                document.getElementById('readySection').classList.add('show');
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);
            
            document.getElementById('days').textContent = days.toString().padStart(2, '0');
            document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
            document.getElementById('mins').textContent = mins.toString().padStart(2, '0');
            document.getElementById('secs').textContent = secs.toString().padStart(2, '0');
        }
        
        updateCountdown();
        setInterval(updateCountdown, 1000);
    </script>
</body>
</html>
`;
};

// HTML page for password-protected links
const getPasswordEntryPage = (shortId, title) => {
    const safeTitle = escapeHtml(title || shortId);
    // Escape shortId for use in JavaScript string to prevent XSS
    // Must escape backslashes first, then quotes to prevent breaking out of string
    const safeShortId = escapeHtml(shortId).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle} - Link Snap</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
            color: #fff;
            padding: 20px;
        }
        .orb { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.5; animation: float 8s ease-in-out infinite; }
        .orb-1 { width: 400px; height: 400px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); top: -100px; left: -100px; }
        .orb-2 { width: 300px; height: 300px; background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); bottom: -50px; right: -50px; animation-delay: -4s; }
        @keyframes float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-30px) scale(1.05); } }
        .container { position: relative; z-index: 10; max-width: 450px; width: 100%; text-align: center; }
        .card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 48px 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .icon-container { width: 80px; height: 80px; margin: 0 auto 24px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(139, 92, 246, 0.3); }
        .icon { width: 40px; height: 40px; stroke: #a78bfa; stroke-width: 2; fill: none; }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; background: linear-gradient(135deg, #fff 0%, #c4b5fd 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .link-title { color: #818cf8; font-size: 0.9rem; margin-bottom: 8px; font-weight: 500; }
        .subtitle { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 24px; }
        .form-group { margin-bottom: 20px; text-align: left; }
        .form-group label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 8px; }
        .password-wrapper { position: relative; }
        .password-input { width: 100%; padding: 14px 48px 14px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 0, 0, 0.2); color: #fff; font-size: 1rem; outline: none; transition: border-color 0.2s; }
        .password-input:focus { border-color: #8b5cf6; }
        .toggle-password { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; }
        .toggle-password svg { width: 20px; height: 20px; stroke: #64748b; }
        .toggle-password:hover svg { stroke: #94a3b8; }
        .error-msg { color: #f87171; font-size: 0.8rem; margin-top: 8px; display: none; }
        .error-msg.show { display: block; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 24px; border-radius: 12px; font-size: 1rem; font-weight: 600; text-decoration: none; transition: all 0.3s ease; cursor: pointer; border: none; width: 100%; }
        .btn-primary { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #fff; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4); }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(139, 92, 246, 0.5); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn svg { width: 18px; height: 18px; }
        .loading { display: none; }
        .loading.show { display: flex; }
        .btn-text.hide { display: none; }
        .footer-text { color: #475569; font-size: 0.75rem; margin-top: 24px; }
        .footer-text a { color: #818cf8; text-decoration: none; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .shake { animation: shake 0.3s ease; }
    </style>
</head>
<body>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="container">
        <div class="card" id="card">
            <div class="icon-container">
                <svg class="icon" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>
            <h1>Password Protected</h1>
            <p class="subtitle">This link is protected. Enter the password to continue.</p>
            <form id="passwordForm">
                <div class="form-group">
                    <label for="password">Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="password" class="password-input" placeholder="Enter password" autocomplete="off" required />
                        <button type="button" class="toggle-password" onclick="togglePassword()">
                            <svg id="eyeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                    </div>
                    <p class="error-msg" id="errorMsg"></p>
                </div>
                <button type="submit" class="btn btn-primary" id="submitBtn">
                    <span class="btn-text" id="btnText">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                            <polyline points="10 17 15 12 10 7"/>
                            <line x1="15" y1="12" x2="3" y2="12"/>
                        </svg>
                        Access Link
                    </span>
                    <span class="loading" id="loading">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        Verifying...
                    </span>
                </button>
            </form>
            <p class="footer-text">Powered by <a href="/">Link Snap</a></p>
        </div>
    </div>
    <style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
    <script>
        const form = document.getElementById('passwordForm');
        const passwordInput = document.getElementById('password');
        const errorMsg = document.getElementById('errorMsg');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const loading = document.getElementById('loading');
        const card = document.getElementById('card');
        
        function togglePassword() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            const eyeIcon = document.getElementById('eyeIcon');
            eyeIcon.innerHTML = type === 'password' 
                ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = passwordInput.value;
            if (!password) return;
            
            submitBtn.disabled = true;
            btnText.classList.add('hide');
            loading.classList.add('show');
            errorMsg.classList.remove('show');
            
            try {
                const res = await fetch('/api/url/${safeShortId}/verify-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                
                if (res.ok && data.success) {
                    window.location.href = data.originalUrl;
                } else {
                    throw new Error(data.message || 'Incorrect password');
                }
            } catch (err) {
                errorMsg.textContent = err.message;
                errorMsg.classList.add('show');
                card.classList.add('shake');
                setTimeout(() => card.classList.remove('shake'), 300);
                passwordInput.value = '';
                passwordInput.focus();
            } finally {
                submitBtn.disabled = false;
                btnText.classList.remove('hide');
                loading.classList.remove('show');
            }
        });
        
        passwordInput.focus();
    </script>
</body>
</html>
`;
};

// HTML page for limit exceeded
const getLimitReachedPage = () => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Unavailable - Link Snap</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, system-ui, sans-serif;
            background: #0f172a;
            color: #fff;
        }
        .card {
            background: rgba(30, 41, 59, 0.7);
            padding: 2rem;
            border-radius: 1rem;
            text-align: center;
            max-width: 400px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        h1 { margin-bottom: 1rem; color: #f87171; }
        p { color: #94a3b8; margin-bottom: 1.5rem; line-height: 1.5; }
        .btn {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>Link Temporarily Unavailable</h1>
        <p>This link has reached its monthly traffic limit. Please contact the link owner or try again next month.</p>
        <a href="/" class="btn">Go to Link Snap</a>
    </div>
</body>
</html>
`;

export const redirectUrl = async (req, res, next) => {
    const { shortId } = req.params;

    try {
        // 1. Check cache first (fast path)
        const cached = getFromCache(shortId);
        if (cached) {
            if (!cached.isActive) {
                return res.status(410).send(getInactiveLinkPage(shortId));
            }

            // check cached ban status FIRST to avoid DB hit
            if (cached.ownerBanned && cached.disableLinksOnBan) {
                return res.status(410).send(getInactiveLinkPage(shortId));
            }

            // If we have ownerId but no ban status in cache, we might need to check (once) 
            // and then update cache. But ideally, we should have stored it.
            // For safety during migration, if 'ownerBanned' is undefined, we could check DB
            // OR strictly trust the cache if we ensure cache invalidation on ban works.
            // Given the 'invalidateMultiple' called in AdminController, cache should be fresh.
            // However, to be robust:
            if (cached.ownerId && cached.ownerBanned === undefined) {
                 const owner = await User.findById(cached.ownerId).select('isActive disableLinksOnBan');
                 if (owner) {
                     // Update cache with this info to prevent future lookups
                     const isBanned = !owner.isActive;
                     cached.ownerBanned = isBanned;
                     cached.disableLinksOnBan = owner.disableLinksOnBan;
                     setInCache(shortId, cached);

                     if (isBanned && owner.disableLinksOnBan) {
                         return res.status(410).send(getInactiveLinkPage(shortId));
                     }
                 }
            }

            // Check if link is ready to go live (activeStartTime)
            if (cached.activeStartTime && !isLinkActive(cached.activeStartTime)) {
                // Show countdown page until link activates
                return res.status(200).send(getScheduledLinkPage(shortId, cached.activeStartTime));
            }

            // Check if link has expired
            if (cached.expiresAt && new Date() > new Date(cached.expiresAt)) {
                return res.status(410).send(getExpiredLinkPage(shortId, cached.expiresAt));
            }

            // Check if link is password protected
            if (cached.isPasswordProtected) {
                return res.send(getPasswordEntryPage(shortId, cached.title));
            }

            // CHECK & INCREMENT USER USAGE (Atomic)
            if (cached.ownerId) {
                const usageCheck = await checkAndIncrementClickUsage(cached.ownerId);
                if (!usageCheck.allowed) {
                     return res.status(403).send(getLimitReachedPage());
                }
            }

            // Async: Update clicks in DB (fire and forget)
            Url.findByIdAndUpdate(cached._id, { $inc: { clicks: 1 } }).exec();

            // Time-Based Redirect logic (Pro/Business feature)
            // Only apply if owner has time_redirects feature
            if (cached.timeRedirects?.enabled && cached.ownerId) {
                // Check subscription cache first (24h TTL)
                let ownerSub = getSubscriptionCache(cached.ownerId.toString());
                if (!ownerSub) {
                    // Cache miss - fetch from DB and cache
                    const owner = await User.findById(cached.ownerId).select('subscription role');
                    if (owner) {
                        ownerSub = { subscription: owner.subscription, role: owner.role };
                        setSubscriptionCache(cached.ownerId.toString(), ownerSub);
                    }
                }
                
                if (ownerSub && (ownerSub.role === 'admin' || hasFeature(ownerSub, 'time_redirects'))) {
                    const timeDestination = getTimeBasedDestination(cached.timeRedirects);
                    if (timeDestination) {
                        trackVisit(cached._id, req, { deviceMatchType: 'time_redirect' });
                        return res.redirect(timeDestination);
                    }
                }
            }

            // Device-based redirect logic
            const { targetUrl, deviceMatchType } = getDeviceRedirectUrl(cached, req.headers['user-agent']);

            // Async Analytics Tracking with device match type
            trackVisit(cached._id, req, { deviceMatchType });

            // Preserve query parameters (UTM tags, etc.)
            let finalUrl = targetUrl;
            if (Object.keys(req.query).length > 0) {
                try {
                    const urlObj = new URL(targetUrl);
                    for (const [key, value] of Object.entries(req.query)) {
                        urlObj.searchParams.append(key, value);
                    }
                    finalUrl = urlObj.toString();
                } catch {
                    // If targetUrl is relative or invalid, simplistic append (fallback)
                    const separator = targetUrl.includes('?') ? '&' : '?';
                    const queryString = new URLSearchParams(req.query).toString();
                    finalUrl = `${targetUrl}${separator}${queryString}`;
                }
            }

            return res.redirect(finalUrl);
        }

        // 2. Cache miss - query database
        let url = await Url.findOne({
            $or: [{ shortId }, { customAlias: shortId }],
        });

        // 2b. Fallback: Case-insensitive search if strict match fails
        if (!url) {
            url = await Url.findOne({
                $or: [
                    { shortId: { $regex: new RegExp(`^${escapeRegex(shortId)}$`, 'i') } },
                    { customAlias: { $regex: new RegExp(`^${escapeRegex(shortId)}$`, 'i') } }
                ]
            });
        }

        if (!url) {
            // Next middleware (frontend)
            return next();
        }

        // 3. Fetch owner status alongside URL
        let ownerBanned = false;
        let disableLinksOnBan = false;

        if (url.createdBy) {
            const owner = await User.findById(url.createdBy).select('isActive disableLinksOnBan');
            if (owner) {
                ownerBanned = !owner.isActive;
                disableLinksOnBan = owner.disableLinksOnBan;
            }
        }

        if (!url.isActive) {
            return res.status(410).send(getInactiveLinkPage(shortId));
        }

        if (ownerBanned && disableLinksOnBan) {
            return res.status(410).send(getInactiveLinkPage(shortId));
        }

        // Check if link is ready to go live (activeStartTime)
        if (url.activeStartTime && !isLinkActive(url.activeStartTime)) {
            // Show countdown page until link activates
            return res.status(200).send(getScheduledLinkPage(shortId, url.activeStartTime));
        }

        // Check if link has expired
        if (url.expiresAt && new Date() > new Date(url.expiresAt)) {
            return res.status(410).send(getExpiredLinkPage(shortId, url.expiresAt));
        }

        // Check if link is password protected
        if (url.isPasswordProtected) {
            return res.send(getPasswordEntryPage(shortId, url.title));
        }

        // CHECK & INCREMENT USER USAGE (Atomic)
        if (url.createdBy) {
            const usageCheck = await checkAndIncrementClickUsage(url.createdBy);
            if (!usageCheck.allowed) {
                 return res.status(403).send(getLimitReachedPage());
            }
        }

        // 4. Store in cache with ban status
        setInCache(shortId, { 
            ...url.toObject(), 
            ownerId: url.createdBy,
            ownerBanned,
            disableLinksOnBan
        });

        // Increment clicks
        Url.findByIdAndUpdate(url._id, { $inc: { clicks: 1 } }).exec();

        // Time-Based Redirect logic (Pro/Business feature)
        // Only apply if owner has time_redirects feature
        if (url.timeRedirects?.enabled && url.createdBy) {
            // Fetch owner subscription and cache it (24h TTL)
            const ownerFull = await User.findById(url.createdBy).select('subscription role');
            if (ownerFull) {
                // Cache for future requests
                setSubscriptionCache(url.createdBy.toString(), { 
                    subscription: ownerFull.subscription, 
                    role: ownerFull.role 
                });
                
                if (ownerFull.role === 'admin' || hasFeature(ownerFull, 'time_redirects')) {
                    const timeDestination = getTimeBasedDestination(url.timeRedirects);
                    if (timeDestination) {
                        trackVisit(url._id, req, { deviceMatchType: 'time_redirect' });
                        return res.redirect(timeDestination);
                    }
                }
            }
        }

        // Device-based redirect logic
        const { targetUrl, deviceMatchType } = getDeviceRedirectUrl(url, req.headers['user-agent']);

        // Async Analytics Tracking with device match type
        trackVisit(url._id, req, { deviceMatchType });

        // Preserve query parameters (UTM tags, etc.)
        let finalUrl = targetUrl;
        if (Object.keys(req.query).length > 0) {
            try {
                const urlObj = new URL(targetUrl);
                for (const [key, value] of Object.entries(req.query)) {
                    urlObj.searchParams.append(key, value);
                }
                finalUrl = urlObj.toString();
            } catch {
                // If targetUrl is relative or invalid, simplistic append (fallback)
                const separator = targetUrl.includes('?') ? '&' : '?';
                const queryString = new URLSearchParams(req.query).toString();
                finalUrl = `${targetUrl}${separator}${queryString}`;
            }
        }

        return res.redirect(finalUrl);
    } catch (error) {
        console.error('Redirect Error:', error);
        return res.status(500).send('Server Error');
    }
};

// Preview page handler (when user adds + at the end of URL)
export const previewUrl = async (req, res, next) => {
    // Extract shortId from regex match or params
    let shortId = req.params[0] || req.params.shortId;

    // Clean up: Remove any + or trailing slash using linear-time approach
    // Avoids ReDoS vulnerability from /[+/]+$/ regex
    while (shortId.length > 0 && (shortId.endsWith('+') || shortId.endsWith('/'))) {
        shortId = shortId.slice(0, -1);
    }

    try {
        // Query database for the URL
        let url = await Url.findOne({
            $or: [{ shortId }, { customAlias: shortId }],
        });

        // Fallback: Case-insensitive search
        if (!url) {
            url = await Url.findOne({
                $or: [
                    { shortId: { $regex: new RegExp(`^${escapeRegex(shortId)}$`, 'i') } },
                    { customAlias: { $regex: new RegExp(`^${escapeRegex(shortId)}$`, 'i') } }
                ]
            });
        }

        if (!url) {
            return next();
        }

        // Check if link is inactive
        if (!url.isActive) {
            return res.status(410).send(getInactiveLinkPage(shortId));
        }

        // Check if owner is banned and has links disabled
        if (url.createdBy) {
            const owner = await User.findById(url.createdBy).select('isActive disableLinksOnBan');
            if (owner && !owner.isActive && owner.disableLinksOnBan) {
                return res.status(410).send(getInactiveLinkPage(shortId));
            }
        }

        // Check if link has expired
        if (url.expiresAt && new Date() > new Date(url.expiresAt)) {
            return res.status(410).send(getExpiredLinkPage(shortId, url.expiresAt));
        }

        // Check if link is password protected - redirect to password page instead of preview
        if (url.isPasswordProtected) {
            return res.send(getPasswordEntryPage(shortId, url.title));
        }

        // Generate the short URL (use what was accessed)
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const accessedUrl = `${protocol}://${host}/${shortId}`;

        // Generate both URLs for display
        const randomUrl = `${protocol}://${host}/${url.shortId}`;
        const customUrl = url.customAlias ? `${protocol}://${host}/${url.customAlias}` : null;

        // Determine if we're viewing via custom alias
        const viewingViaCustom = url.customAlias && shortId === url.customAlias;

        // Send the preview page with both URLs
        return res.send(getLinkPreviewPage(url, accessedUrl, randomUrl, customUrl, viewingViaCustom));
    } catch (error) {
        console.error('Preview Error:', error);
        return res.status(500).send('Server Error');
    }
};
