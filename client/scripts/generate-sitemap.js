#!/usr/bin/env node

/**
 * Generate sitemap.xml with environment-based URLs
 * Run during build: node scripts/generate-sitemap.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config();

// Get base URL from environment or use default
const BASE_URL = process.env.VITE_BASE_URL || 'https://linksnap.centralindia.cloudapp.azure.com';

// Pages to include in sitemap
const pages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/login', priority: '0.8', changefreq: 'monthly' },
    { url: '/register', priority: '0.8', changefreq: 'monthly' },
    { url: '/pricing', priority: '0.9', changefreq: 'weekly' },
    { url: '/changelog', priority: '0.6', changefreq: 'weekly' },
    { url: '/roadmap', priority: '0.5', changefreq: 'monthly' },
];

// Generate sitemap XML
const generateSitemap = () => {
    const urls = pages.map(page => `
  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
};

// Write sitemap
const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');

console.log('🗺️  Generating sitemap.xml...');
console.log(`   BASE_URL: ${BASE_URL}`);

try {
    const sitemap = generateSitemap();
    fs.writeFileSync(outputPath, sitemap, 'utf-8');
    console.log('✅ sitemap.xml generated successfully!');
} catch (error) {
    console.error('❌ Error generating sitemap.xml:', error.message);
    process.exit(1);
}
