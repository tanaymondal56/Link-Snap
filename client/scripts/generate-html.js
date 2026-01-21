#!/usr/bin/env node

/**
 * Generate index.html with environment-based URLs
 * Run during build: node scripts/generate-html.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config();

// Get environment variables
const BASE_URL = process.env.VITE_BASE_URL || 'https://linksnap.centralindia.cloudapp.azure.com';
const DOMAIN = process.env.VITE_DOMAIN || 'linksnap.centralindia.cloudapp.azure.com';

// Read template
const templatePath = path.join(__dirname, '..', 'index.template.html');
const outputPath = path.join(__dirname, '..', 'index.html');

console.log('📝 Generating index.html from template...');
console.log(`   BASE_URL: ${BASE_URL}`);
console.log(`   DOMAIN: ${DOMAIN}`);

try {
    let template = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholders
    template = template.replace(/\{\{BASE_URL\}\}/g, BASE_URL);
    template = template.replace(/\{\{DOMAIN\}\}/g, DOMAIN);
    template = template.replace(/\{\{PROTOCOL_DOMAIN\}\}/g, `https://${DOMAIN}`);

    // Write output
    fs.writeFileSync(outputPath, template, 'utf-8');

    console.log('✅ index.html generated successfully!');
} catch (error) {
    console.error('❌ Error generating index.html:', error.message);
    process.exit(1);
}
