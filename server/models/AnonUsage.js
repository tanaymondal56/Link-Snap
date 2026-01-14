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
        required: true,
        index: { expires: 0 } // TTL index: MongoDB auto-deletes doc when this time is reached
    }
}, {
    timestamps: true // Adds createdAt, updatedAt
});

const AnonUsage = mongoose.model('AnonUsage', anonUsageSchema);

export default AnonUsage;
