#!/usr/bin/env node

/**
 * Version Sync Script
 * 
 * Syncs the app version across all configuration files from the latest published changelog.
 * 
 * Usage:
 *   node scripts/sync-version.js [version]
 * 
 * If version is provided, uses that version.
 * If no version provided, fetches from the latest published changelog in the database.
 * 
 * Files updated:
 * - package.json (root, client, server)
 * - package-lock.json (root, client, server)
 * - client/src/config/version.js (FALLBACK_VERSION)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// File paths relative to project root
const FILES = {
    rootPackage: path.join(rootDir, 'package.json'),
    rootPackageLock: path.join(rootDir, 'package-lock.json'),
    clientPackage: path.join(rootDir, 'client', 'package.json'),
    clientPackageLock: path.join(rootDir, 'client', 'package-lock.json'),
    serverPackage: path.join(rootDir, 'server', 'package.json'),
    serverPackageLock: path.join(rootDir, 'server', 'package-lock.json'),
    versionConfig: path.join(rootDir, 'client', 'src', 'config', 'version.js'),
};

/**
 * Get current version from client package.json
 */
function getCurrentVersion() {
    const content = JSON.parse(fs.readFileSync(FILES.clientPackage, 'utf8'));
    return content.version;
}

/**
 * Bump version by type (patch, minor, major)
 */
function bumpVersion(current, type) {
    const parts = current.replace(/-[a-zA-Z0-9.]+$/, '').split('.').map(Number);
    
    switch (type) {
        case 'major':
            return `${parts[0] + 1}.0.0`;
        case 'minor':
            return `${parts[0]}.${parts[1] + 1}.0`;
        case 'patch':
        default:
            return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
}

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
};

/**
 * Update version in package.json or package-lock.json
 */
function updatePackageJson(filePath, newVersion) {
    try {
        if (!fs.existsSync(filePath)) {
            log.warn(`File not found: ${filePath}`);
            return false;
        }
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const oldVersion = content.version;
        let updated = false;
        
        // Update top-level version
        if (content.version !== newVersion) {
            content.version = newVersion;
            updated = true;
        }
        
        // For package-lock.json: also update packages[""].version
        if (content.packages && content.packages[''] && content.packages[''].version !== newVersion) {
            content.packages[''].version = newVersion;
            updated = true;
        }
        
        if (!updated) {
            log.info(`${path.basename(filePath)}: Already at ${newVersion}`);
            return false;
        }
        
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
        log.success(`${path.basename(filePath)}: ${oldVersion} → ${newVersion}`);
        return true;
    } catch (error) {
        log.error(`Failed to update ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Update FALLBACK_VERSION in version.js
 */
function updateVersionConfig(filePath, newVersion) {
    try {
        if (!fs.existsSync(filePath)) {
            log.warn(`File not found: ${filePath}`);
            return false;
        }
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Match the FALLBACK_VERSION export
        const regex = /export const FALLBACK_VERSION = ['"]([^'"]+)['"]/;
        const match = content.match(regex);
        
        if (!match) {
            log.error('Could not find FALLBACK_VERSION in version.js');
            return false;
        }
        
        const oldVersion = match[1];
        
        if (oldVersion === newVersion) {
            log.info(`version.js FALLBACK_VERSION: Already at ${newVersion}`);
            return false;
        }
        
        content = content.replace(regex, `export const FALLBACK_VERSION = '${newVersion}'`);
        fs.writeFileSync(filePath, content);
        log.success(`version.js FALLBACK_VERSION: ${oldVersion} → ${newVersion}`);
        return true;
    } catch (error) {
        log.error(`Failed to update ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Fetch latest version from database (requires mongoose connection)
 */
async function fetchLatestVersionFromDB() {
    try {
        // Use createRequire to load modules from server's context
        const { createRequire } = await import('module');
        const serverRequire = createRequire(path.join(rootDir, 'server', 'index.js'));
        
        // Load dependencies from server
        const mongoose = serverRequire('mongoose');
        const dotenv = serverRequire('dotenv');
        
        // Load environment variables
        dotenv.config({ path: path.join(rootDir, 'server', '.env') });
        
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            log.error('No MONGO_URI found in environment');
            return null;
        }
        
        log.info('Connecting to database...');
        await mongoose.connect(mongoUri);
        
        // Define inline schema to avoid import issues
        const changelogSchema = new mongoose.Schema({
            version: String,
            isPublished: Boolean,
            order: Number
        }, { collection: 'changelogs' });
        
        const Changelog = mongoose.models.Changelog || mongoose.model('Changelog', changelogSchema);
        
        // Find latest published changelog
        const latest = await Changelog.findOne({ isPublished: true })
            .sort({ order: -1 })
            .select('version')
            .lean();
        
        await mongoose.disconnect();
        
        if (!latest) {
            log.warn('No published changelog found in database');
            return null;
        }
        
        log.success(`Found latest version from database: ${latest.version}`);
        return latest.version;
    } catch (error) {
        log.error(`Database fetch failed: ${error.message}`);
        // Ensure mongoose disconnects even on error
        try {
            const { createRequire } = await import('module');
            const serverRequire = createRequire(path.join(rootDir, 'server', 'index.js'));
            const mongoose = serverRequire('mongoose');
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        } catch { /* ignore disconnect errors */ }
        return null;
    }
}

/**
 * Main sync function
 */
async function syncVersion(providedVersion) {
    console.log('\n📦 Version Sync Script\n');
    
    let version = providedVersion;
    
    // Check if bump type provided (patch, minor, major)
    if (['patch', 'minor', 'major'].includes(version)) {
        const currentVersion = getCurrentVersion();
        version = bumpVersion(currentVersion, providedVersion);
        log.info(`Bumping ${providedVersion}: ${currentVersion} → ${version}`);
    }
    // If no version provided, try to fetch from database
    else if (!version) {
        log.info('No version provided, fetching from database...');
        version = await fetchLatestVersionFromDB();
        
        if (!version) {
            log.error('Could not determine version. Please provide a version as argument.');
            log.info('Usage: node scripts/sync-version.js [version|patch|minor|major]');
            process.exit(1);
        }
    }
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
        log.error(`Invalid version format: ${version}`);
        log.info('Version must be in format: X.Y.Z or X.Y.Z-tag');
        process.exit(1);
    }
    
    console.log(`\n🎯 Syncing to version: ${colors.cyan}${version}${colors.reset}\n`);
    
    let updated = 0;
    
    // Update root package.json and lock
    if (updatePackageJson(FILES.rootPackage, version)) updated++;
    if (updatePackageJson(FILES.rootPackageLock, version)) updated++;
    
    // Update client package.json and lock
    if (updatePackageJson(FILES.clientPackage, version)) updated++;
    if (updatePackageJson(FILES.clientPackageLock, version)) updated++;
    
    // Update server package.json and lock
    if (updatePackageJson(FILES.serverPackage, version)) updated++;
    if (updatePackageJson(FILES.serverPackageLock, version)) updated++;
    
    // Update version.js FALLBACK_VERSION
    if (updateVersionConfig(FILES.versionConfig, version)) updated++;
    
    console.log('');
    
    if (updated > 0) {
        log.success(`Updated ${updated} file(s) to version ${version}`);
        log.info('Remember to commit these changes!');
    } else {
        log.info('All files already at correct version');
    }
    
    console.log('');
}

// Run the script
const args = process.argv.slice(2);
syncVersion(args[0]).catch(console.error);
