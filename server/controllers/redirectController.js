import Url from '../models/Url.js';
import User from '../models/User.js';
import { trackVisit } from '../services/analyticsService.js';
import { getFromCache, setInCache } from '../services/cacheService.js';

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

// Beautiful HTML page for link preview (when user adds + or / at end)
const getLinkPreviewPage = (url, shortUrl, randomUrl, customUrl, viewingViaCustom) => {
    const safeTitle = escapeHtml(url.title || url.shortId);
    const safeOriginalUrl = escapeHtml(url.originalUrl);

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
                <p class="short-url">${shortUrl}</p>
                ${viewingViaCustom && randomUrl ? `
                    <div class="alternate-link">
                        <span class="alternate-link-label">Also available at:</span>
                        <span class="alternate-link-url" onclick="copyAlternateLink()">${randomUrl}</span>
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
                        <span class="alternate-link-url" onclick="copyCustomLink()">${customUrl}</span>
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
            navigator.clipboard.writeText('${shortUrl}').then(() => {
                showToast();
            });
        }
        
        function copyAlternateLink() {
            navigator.clipboard.writeText('${randomUrl || ''}').then(() => {
                showToast();
            });
        }
        
        function copyCustomLink() {
            navigator.clipboard.writeText('${customUrl || ''}').then(() => {
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
const getInactiveLinkPage = (shortId) => `
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
                    The link owner or an administrator has disabled this link. This could be temporary maintenance or a permanent change.
                </p>
                <span class="link-id">/${shortId}</span>
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

export const redirectUrl = async (req, res, next) => {
    const { shortId } = req.params;

    console.log(`[Redirect] Processing shortId: ${shortId}`);

    try {
        // 1. Check cache first (fast path)
        const cached = getFromCache(shortId);
        if (cached) {
            if (!cached.isActive) {
                return res.status(410).send(getInactiveLinkPage(shortId));
            }

            // Check if owner is banned and has links disabled
            if (cached.ownerId) {
                const owner = await User.findById(cached.ownerId).select('isActive disableLinksOnBan');
                if (owner && !owner.isActive && owner.disableLinksOnBan) {
                    return res.status(410).send(getInactiveLinkPage(shortId));
                }
            }

            // Async: Update clicks in DB (fire and forget)
            Url.findByIdAndUpdate(cached._id, { $inc: { clicks: 1 } }).exec();

            // Async Analytics Tracking
            trackVisit(cached._id, req);

            return res.redirect(cached.originalUrl);
        }

        // 2. Cache miss - query database
        const url = await Url.findOne({
            $or: [{ shortId }, { customAlias: shortId }],
        });

        if (!url) {
            // If not found, pass to next middleware (which might be frontend routing)
            console.log(`[Redirect] URL not found for shortId: ${shortId}, passing to next middleware`);
            return next();
        }

        console.log(`[Redirect] Found URL: ${url.originalUrl} for shortId: ${shortId}`);

        // 3. Store in cache for next time (include createdBy for ban check)
        setInCache(shortId, { ...url.toObject(), ownerId: url.createdBy });

        if (!url.isActive) {
            return res.status(410).send(getInactiveLinkPage(shortId));
        }

        // 4. Check if owner is banned and has links disabled
        if (url.createdBy) {
            const owner = await User.findById(url.createdBy).select('isActive disableLinksOnBan');
            if (owner && !owner.isActive && owner.disableLinksOnBan) {
                return res.status(410).send(getInactiveLinkPage(shortId));
            }
        }

        // Increment clicks (fire and forget to not block redirect)
        url.clicks += 1;
        await url.save();

        // Async Analytics Tracking (Phase 4)
        trackVisit(url._id, req);

        return res.redirect(url.originalUrl);
    } catch (error) {
        console.error('Redirect Error:', error);
        return res.status(500).send('Server Error');
    }
};

// Preview page handler (when user adds + at the end of URL)
export const previewUrl = async (req, res, next) => {
    // Extract shortId from regex match or params
    let shortId = req.params[0] || req.params.shortId;

    // Clean up: Remove any + or trailing slash just in case
    shortId = shortId.replace(/[\+\/]+$/, '');

    try {
        // Query database for the URL
        const url = await Url.findOne({
            $or: [{ shortId }, { customAlias: shortId }],
        });

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
