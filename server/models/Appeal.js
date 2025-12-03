import mongoose from 'mongoose';

const appealSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    // The appeal message from the user
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
    },
    // Status of the appeal
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    // Admin response
    adminResponse: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: null,
    },
    // Admin who reviewed the appeal
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    reviewedAt: {
        type: Date,
        default: null,
    },
    // Reference to the ban this appeal is for
    bannedAt: {
        type: Date,
        required: true,
    },
    bannedReason: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

// Index for efficient querying
appealSchema.index({ userId: 1, createdAt: -1 });
appealSchema.index({ status: 1, createdAt: -1 });

// Limit one pending appeal per user
appealSchema.index(
    { userId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'pending' }
    }
);

const Appeal = mongoose.model('Appeal', appealSchema);

export default Appeal;
