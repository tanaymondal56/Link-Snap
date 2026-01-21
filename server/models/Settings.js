import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
// This is needed because ES module imports are hoisted
dotenv.config();

// Encryption utilities for email password
// ENCRYPTION_KEY must be EXACTLY 32 characters for AES-256-CBC
const DEFAULT_KEY = 'default-32-char-encryption-key!'; // Exactly 32 chars
// Trim any whitespace/CR/LF from the key (Windows line ending fix)
let ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || DEFAULT_KEY).trim();

// Log for debugging
console.log(`[Settings] ENCRYPTION_KEY length: ${ENCRYPTION_KEY.length} chars, Buffer size: ${Buffer.from(ENCRYPTION_KEY, 'utf8').length} bytes`);

// Warn if key length is not 32, but we'll pad/truncate it anyway
if (ENCRYPTION_KEY.length !== 32) {
    console.warn(`WARNING: ENCRYPTION_KEY should be exactly 32 characters. Current length: ${ENCRYPTION_KEY.length}`);
    console.warn('Key will be padded/truncated to 32 bytes. Consider setting a proper 32-character ENCRYPTION_KEY in .env');
}

const IV_LENGTH = 16;

const encrypt = (text) => {
    if (!text) return '';
    console.log('[encrypt] Called with text length:', text.length);
    console.log('[encrypt] ENCRYPTION_KEY:', ENCRYPTION_KEY.length, 'chars');
    try {
        // Create a 32-byte buffer from the key (ensures correct length)
        const keyBuffer = Buffer.alloc(32);
        Buffer.from(ENCRYPTION_KEY, 'utf8').copy(keyBuffer);
        console.log('[encrypt] keyBuffer created, length:', keyBuffer.length);

        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
        let encrypted = cipher.update(text, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error('Encryption error:', error.message);
        throw new Error('Failed to encrypt data. Check ENCRYPTION_KEY configuration.');
    }
};

const decrypt = (text) => {
    if (!text) return '';
    try {
        // Create a 32-byte buffer from the key (ensures correct length)
        const keyBuffer = Buffer.alloc(32);
        Buffer.from(ENCRYPTION_KEY, 'utf8').copy(keyBuffer);

        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Decryption error:', error.message);
        return '';
    }
};

const settingsSchema = new mongoose.Schema({
    requireEmailVerification: {
        type: Boolean,
        default: true,
    },
    emailProvider: {
        type: String,
        default: 'gmail',
        enum: ['gmail', 'outlook', 'yahoo', 'smtp'],
    },
    emailUsername: {
        type: String,
        default: '',
    },
    emailPassword: {
        type: String,
        default: '',
    },
    // Custom SMTP settings
    smtpHost: {
        type: String,
        default: '',
    },
    smtpPort: {
        type: Number,
        default: 587,
    },
    smtpSecure: {
        type: Boolean,
        default: false, // true for 465, false for other ports
    },
    emailConfigured: {
        type: Boolean,
        default: false,
    },
    // Safe Browsing Configuration
    safeBrowsingEnabled: {
        type: Boolean,
        default: false, // Disabled by default until API key is provided
    },
    safeBrowsingAutoCheck: {
        type: Boolean,
        default: true, // Auto-check new links immediately
    },
}, { timestamps: true });

// Pre-save hook to encrypt password and set emailConfigured
settingsSchema.pre('save', async function () {
    if (this.emailUsername && this.emailPassword) {
        this.emailConfigured = true;
    } else {
        this.emailConfigured = false;
    }

    // Encrypt password if modified and strictly if it has a value
    // We trust isModified to tell us if it's a new plaintext password
    if (this.isModified('emailPassword') && this.emailPassword) {
        this.emailPassword = encrypt(this.emailPassword);
    }
});

// Method to get decrypted password
settingsSchema.methods.getDecryptedPassword = function () {
    return decrypt(this.emailPassword);
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
