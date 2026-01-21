import mongoose from 'mongoose';

const anonUsageSchema = new mongoose.Schema({
    fingerprint: {
        type: String,
        required: true,
        unique: true,
        index: true, // Optimizes lookup by fingerprint
    },
    createdCount: {
        type: Number,
        default: 0, // Hard limit counter (never decreases)
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true // Adds createdAt, updatedAt
});

// TTL index: MongoDB auto-deletes doc when expiresAt time is reached
anonUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AnonUsage = mongoose.model('AnonUsage', anonUsageSchema);

export default AnonUsage;
