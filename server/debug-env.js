import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validating the same logic as env.js
const serverEnvPath = path.resolve(__dirname, '.env');
const rootEnvPath = path.resolve(__dirname, '../.env');

console.log('--- 🔍 DEBUGGING ENVIRONMENT ---');
console.log(`Checking for .env at: ${serverEnvPath}`);
const result1 = dotenv.config({ path: serverEnvPath });
console.log('Server .env found?', !result1.error);

if (result1.error) {
    console.log(`Checking for .env at: ${rootEnvPath}`);
    const result2 = dotenv.config({ path: rootEnvPath });
    console.log('Root .env found?', !result2.error);
}

console.log('\n--- 📋 LOADED VALUES ---');
const enabled = process.env.ADMIN_ENABLED;
const ips = process.env.ADMIN_WHITELIST_IPS;

console.log(`ADMIN_ENABLED: '${enabled}' (Type: ${typeof enabled})`);
console.log(`ADMIN_WHITELIST_IPS: '${ips}' (Type: ${typeof ips})`);

if (ips) {
    const list = ips.split(',').map(ip => ip.trim());
    console.log('Parsed Whitelist:', list);
    
    // Check for common mistake (spaces/quotes)
    if (ips.includes('"') || ips.includes("'")) {
        console.warn('⚠️ WARNING: Quotes found in variable. .env values should typically not be quoted unless necessary.');
    }
} else {
    console.error('❌ ERROR: ADMIN_WHITELIST_IPS is undefined or empty.');
}

console.log('--- DEBUG END ---');
