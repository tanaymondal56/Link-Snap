import mongoose from 'mongoose';

const loginHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Can be null for failed login with unknown email
    },
    email: {
        type: String,
        required: true,
    },
    ip: {
        type: String,
        required: true,
    },
    userAgent: {
        type: String,
        default: 'Unknown',
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        required: true,
    },
    failureReason: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

// Index for querying history by user or IP
loginHistorySchema.index({ userId: 1, createdAt: -1 });
loginHistorySchema.index({ ip: 1, createdAt: -1 });
loginHistorySchema.index({ email: 1, createdAt: -1 });

// Data Retention: expire logs after 1 year (365 days)
loginHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);

export default LoginHistory;
