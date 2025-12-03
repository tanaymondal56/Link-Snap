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
}, {
    timestamps: true,
});

// Index for fast lookups
urlSchema.index({ createdBy: 1 });

const Url = mongoose.model('Url', urlSchema);

export default Url;
