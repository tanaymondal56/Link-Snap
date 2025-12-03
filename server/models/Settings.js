import mongoose from 'mongoose';
import crypto from 'crypto';

// Encryption utilities for email password
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!'; // Must be 32 characters
const IV_LENGTH = 16;

const encrypt = (text) => {
    if (!text) return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
    if (!text) return '';
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
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
    emailConfigured: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

// Pre-save hook to encrypt password and set emailConfigured
settingsSchema.pre('save', async function () {
    if (this.emailUsername && this.emailPassword) {
        this.emailConfigured = true;
    } else {
        this.emailConfigured = false;
    }

    // Encrypt password if modified and not already encrypted
    if (this.isModified('emailPassword') && this.emailPassword && !this.emailPassword.includes(':')) {
        this.emailPassword = encrypt(this.emailPassword);
    }
});

// Method to get decrypted password
settingsSchema.methods.getDecryptedPassword = function () {
    return decrypt(this.emailPassword);
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
