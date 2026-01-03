import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const urlSchema = new mongoose.Schema({
    originalUrl: {
        type: String,
        required: true,
    },
    shortId: {
        type: String,
        required: true,
        unique: true,
        default: () => nanoid(8), // Generate 8-char ID by default
    },
    customAlias: {
        type: String,
        unique: true,
        sparse: true, // Allows multiple null values
    },
    title: {
        type: String,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Can be anonymous
    },
    clicks: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    qrCode: {
        type: String, // Base64 string or URL
    },
    // Link Expiration
    expiresAt: {
        type: Date,
        default: null,  // null = never expires
        default: null,  // null = never expires
    },
    // Password Protection
    isPasswordProtected: {
        type: Boolean,
        default: false,
    },
    passwordHash: {
        type: String,
        select: false,  // Never return password hash by default
    },
    // Device-Based Redirects (Pro/Business feature)
    deviceRedirects: {
        enabled: { type: Boolean, default: false },
        rules: [{
            device: {
                type: String,
                enum: ['ios', 'android', 'mobile', 'desktop', 'tablet'],
                required: true
            },
            url: { type: String, required: true },
            priority: { type: Number, default: 0 } // Higher = checked first
        }],
    },
}, {
    timestamps: true,
});

// Index for fast lookups and dashboard sorting
// Compound index avoids in-memory sort for "My Links" page
urlSchema.index({ createdBy: 1, createdAt: -1 });

const Url = mongoose.model('Url', urlSchema);

export default Url;
