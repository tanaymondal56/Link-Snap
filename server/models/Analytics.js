import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
    urlId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Url',
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    ip: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    browser: {
        type: String,
    },
    os: {
        type: String,
    },
    device: {
        type: String,
    },
    country: {
        type: String,
    },
    city: {
        type: String,
    },
    // Device-based redirect tracking (null if not using device targeting)
    deviceMatchType: {
        type: String,
        enum: ['ios', 'android', 'mobile', 'tablet', 'desktop', 'mobile_fallback', 'fallback', 'time_redirect', 'edge_cached', 'bulk_import', null],
        default: null,
    },
});

// Index for faster aggregation by URL and Date
analyticsSchema.index({ urlId: 1, timestamp: -1 });

const Analytics = mongoose.model('Analytics', analyticsSchema);

export default Analytics;
