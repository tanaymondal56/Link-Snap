/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOT & CRAWLER DETECTOR UTILITY
 * ═══════════════════════════════════════════════════════════════════════════════
 * Identifies automated web scrapers, search engine crawlers, preview bots,
 * and programmatic HTTP clients to prevent:
 * 1. Economic Denial of Service (EDoS) via click quota exhaustion on free users.
 * 2. Analytics pollution and false geo/browser click inflation.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Comprehensive regex matching known bots, crawlers, preview generators, and scrapers
const BOT_UA_REGEX = new RegExp([
    'bot',
    'crawler',
    'spider',
    'crawling',
    'facebookexternalhit',
    'whatsapp',
    'slackbot',
    'twitterbot',
    'telegrambot',
    'linkedinbot',
    'discordbot',
    'embedly',
    'quora link preview',
    'pinterest',
    'applebot',
    'googlebot',
    'bingbot',
    'yandex',
    'baiduspider',
    'duckduckbot',
    'petalbot',
    'preview',
    'fetch',
    'curl',
    'wget',
    'python-requests',
    'python-urllib',
    'aiohttp',
    'httpx',
    'axios',
    'node-fetch',
    'got',
    'headlesschrome',
    'phantomjs',
    'puppeteer',
    'playwright',
    'postmanruntime',
    'insomnia',
    'chatgpt-user',
    'claude-user',
    'perplexity-user',
    'meta-externalagent',
    'google-extended',
    'bytespider',
    'anthropic',
    'cohere',
    'diffbot'
].join('|'), 'i');

/**
 * Determines whether an incoming HTTP request originates from an automated bot or crawler.
 * 
 * @param {import('express').Request} req - Express request object
 * @returns {boolean} True if the request is identified as a bot or crawler
 */
export const isBotRequest = (req) => {
    if (!req) return false;

    // 1. Missing or blank User-Agent is almost certainly an automated script
    const userAgent = (req.headers && req.headers['user-agent']) || '';
    if (!userAgent || typeof userAgent !== 'string' || userAgent.trim().length === 0) {
        return true;
    }

    // 2. Test User-Agent against bot signatures
    if (BOT_UA_REGEX.test(userAgent)) {
        return true;
    }

    // 3. Check Cloudflare Bot Management header if available (score < 30 indicates automated traffic)
    const cfBotScore = req.headers && req.headers['cf-bot-score'];
    if (cfBotScore) {
        const score = parseInt(cfBotScore, 10);
        if (!isNaN(score) && score < 30) {
            return true;
        }
    }

    return false;
};

export default isBotRequest;
