// Load environment variables first
// This file should be imported before anything else
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file to ensure .env is found correctly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from server directory first, then from root
const serverEnvPath = path.resolve(__dirname, '../.env');
const rootEnvPath = path.resolve(__dirname, '../../.env');

// Try server/.env first, then root/.env
let envResult = dotenv.config({ path: serverEnvPath });
if (envResult.error) {
  // eslint-disable-next-line no-useless-assignment -- Fallback pattern: try loading from root if server path fails
  envResult = dotenv.config({ path: rootEnvPath });
}

// Define required environment variables for each category
const CRITICAL_VARS = [
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const IMPORTANT_VARS = [
  'ENCRYPTION_KEY',
  'NODE_ENV',
  'PORT',
  // Lemon Squeezy Integration
  'LEMONSQUEEZY_API_KEY',
  'LEMONSQUEEZY_STORE_ID',
  'LEMONSQUEEZY_WEBHOOK_SECRET',
  'LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID',
  'LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID',
  'CLIENT_URL',
];

// eslint-disable-next-line no-unused-vars -- Kept for reference/documentation
const OPTIONAL_VARS = [
  'CLIENT_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'SUPPORT_EMAIL',
];

// Validate environment variables on startup
const validateEnvVars = () => {
  const missing = [];
  const warnings = [];

  // Check critical variables (server won't function without these)
  for (const varName of CRITICAL_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check important variables (warn but continue)
  for (const varName of IMPORTANT_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Validate ENCRYPTION_KEY is exactly 32 bytes if provided
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 32) {
    console.error(`❌ [ENV ERROR] ENCRYPTION_KEY must be exactly 32 characters (got ${process.env.ENCRYPTION_KEY.length})`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn(`⚠️  [ENV WARNING] Missing recommended variables: ${warnings.join(', ')}`);
  }

  // Handle missing critical variables
  if (missing.length > 0) {
    console.error(`❌ [ENV ERROR] Missing critical environment variables: ${missing.join(', ')}`);
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  } else {
    console.log('✅ [ENV] All critical environment variables loaded successfully');
  }
};

// Run validation
validateEnvVars();

export default process.env;
