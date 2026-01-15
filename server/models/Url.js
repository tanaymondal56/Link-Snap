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
    // Safe Browsing Status
    safetyStatus: {
        type: String,
        enum: ['pending', 'safe', 'malware', 'phishing', 'unwanted', 'unchecked'],
        default: 'pending',
    },
    safetyDetails: {
        type: String, // Stores threat type or API errors
    },
    lastCheckedAt: {
        type: Date,
    },
    // Manual Override Flag - prevents background scans from overwriting admin decisions
    manualSafetyOverride: {
        type: Boolean,
        default: false,
    },
    // Link Expiration
    expiresAt: {
        type: Date,
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
    // Lifecycle Scheduling (Free feature)
    // Links are hidden (404) until activeStartTime, then work normally
    activeStartTime: {
        type: Date,
        default: null, // null = immediately active
    },
    // Time-Based Redirects (Pro/Business feature)
    // Route to different URLs based on time of day/week
    timeRedirects: {
        enabled: { type: Boolean, default: false },
        timezone: { type: String, default: 'UTC' }, // IANA format: 'Asia/Kolkata'
        rules: [{
            startTime: { type: String, required: true }, // "09:00" (24h)
            endTime: { type: String, required: true },   // "17:00" (24h)
            days: [{ type: Number, min: 0, max: 6 }],    // 0=Sun, 6=Sat
            destination: { 
                type: String, 
                required: true,
                validate: {
                    validator: function(v) {
                        // Basic URL validation - must start with http/https
                        return /^https?:\/\/.+/.test(v);
                    },
                    message: 'Destination must be a valid URL starting with http:// or https://'
                }
            },
            priority: { type: Number, default: 0 }, // Higher = checked first
            label: { type: String, default: '' }    // Optional UI label
        }],
    },
}, {
    timestamps: true,
});

// Index for fast lookups and dashboard sorting
// Compound index avoids in-memory sort for "My Links" page
urlSchema.index({ createdBy: 1, createdAt: -1 });
// Indexes for background cleanup and scheduling
urlSchema.index({ expiresAt: 1 }, { sparse: true });
urlSchema.index({ activeStartTime: 1 }, { sparse: true });
urlSchema.index({ safetyStatus: 1 }); // Optimize background scans
urlSchema.index({ lastCheckedAt: 1 }); // Optimize retry logic

const Url = mongoose.model('Url', urlSchema);

export default Url;
