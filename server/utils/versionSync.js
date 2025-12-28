/**
 * Version Sync Utility
 * 
 * Automatically updates version in all config files when a changelog is published.
 * This ensures FALLBACK_VERSION and package.json versions stay in sync.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root (two levels up from server/utils/)
const rootDir = path.resolve(__dirname, '..', '..');

// File paths
const FILES = {
    rootPackage: path.join(rootDir, 'package.json'),
    clientPackage: path.join(rootDir, 'client', 'package.json'),
    serverPackage: path.join(rootDir, 'server', 'package.json'),
    versionConfig: path.join(rootDir, 'client', 'src', 'config', 'version.js'),
};

/**
 * Update version in a package.json file
 * @param {string} filePath - Path to package.json
 * @param {string} newVersion - New version string
 * @returns {boolean} True if updated, false if already at version or error
 */
function updatePackageJson(filePath, newVersion) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`[VersionSync] File not found: ${filePath}`);
            return false;
        }
        
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (content.version === newVersion) {
            return false; // Already at correct version
        }
        
        content.version = newVersion;
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
        console.log(`[VersionSync] Updated ${path.basename(filePath)}: ${content.version} → ${newVersion}`);
        return true;
    } catch (error) {
        console.error(`[VersionSync] Error updating ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Update FALLBACK_VERSION in version.js
 * @param {string} filePath - Path to version.js
 * @param {string} newVersion - New version string
 * @returns {boolean} True if updated, false if already at version or error
 */
function updateVersionConfig(filePath, newVersion) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`[VersionSync] File not found: ${filePath}`);
            return false;
        }
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        const regex = /export const FALLBACK_VERSION = ['"]([^'"]+)['"]/;
        const match = content.match(regex);
        
        if (!match) {
            console.log('[VersionSync] Could not find FALLBACK_VERSION in version.js');
            return false;
        }
        
        if (match[1] === newVersion) {
            return false; // Already at correct version
        }
        
        content = content.replace(regex, `export const FALLBACK_VERSION = '${newVersion}'`);
        fs.writeFileSync(filePath, content);
        console.log(`[VersionSync] Updated version.js FALLBACK_VERSION: ${match[1]} → ${newVersion}`);
        return true;
    } catch (error) {
        console.error(`[VersionSync] Error updating version.js:`, error.message);
        return false;
    }
}

/**
 * Sync version across all configuration files
 * Called automatically when a changelog is published
 * 
 * @param {string} version - The version to sync to
 * @returns {Object} Result object with updated count and any errors
 */
export async function syncVersionOnPublish(version) {
    // Validate version format
    if (!version || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
        console.log(`[VersionSync] Invalid version format: ${version}`);
        return { success: false, error: 'Invalid version format' };
    }
    
    console.log(`[VersionSync] Syncing to version: ${version}`);
    
    let updated = 0;
    
    try {
        // Update all package.json files
        if (updatePackageJson(FILES.rootPackage, version)) updated++;
        if (updatePackageJson(FILES.clientPackage, version)) updated++;
        if (updatePackageJson(FILES.serverPackage, version)) updated++;
        
        // Update FALLBACK_VERSION
        if (updateVersionConfig(FILES.versionConfig, version)) updated++;
        
        if (updated > 0) {
            console.log(`[VersionSync] Successfully updated ${updated} file(s) to version ${version}`);
        } else {
            console.log(`[VersionSync] All files already at version ${version}`);
        }
        
        return { success: true, updated, version };
    } catch (error) {
        console.error('[VersionSync] Error during sync:', error.message);
        return { success: false, error: error.message };
    }
}

export default { syncVersionOnPublish };
