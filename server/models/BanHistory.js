import mongoose from 'mongoose';

const banHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // Permanent internal ID for audit trail (survives user deletion)
    userInternalId: {
        type: String,
        index: true,
    },
    action: {
        type: String,
        enum: ['ban', 'unban', 'temp_ban_expired', 'appeal_approved'],
        required: true,
    },
    reason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
    },
    // For temporary bans
    duration: {
        type: String,
        enum: ['1h', '24h', '7d', '30d', 'permanent', null],
        default: null,
    },
    bannedUntil: {
        type: Date,
        default: null,
    },
    // Whether links were disabled/re-enabled
    linksAffected: {
        type: Boolean,
        default: false,
    },
    // Admin who performed the action
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    // Additional metadata
    ipAddress: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

// Index for efficient querying
banHistorySchema.index({ userId: 1, createdAt: -1 });
banHistorySchema.index({ performedBy: 1, createdAt: -1 });

const BanHistory = mongoose.model('BanHistory', banHistorySchema);

export default BanHistory;
