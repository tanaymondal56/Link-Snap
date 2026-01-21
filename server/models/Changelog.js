import mongoose from 'mongoose';

const changeSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['feature', 'improvement', 'fix', 'note', 'breaking', 'deprecated'],
        required: true
    },
    text: {
        type: String,
        required: true,
        maxlength: 200,
        trim: true
    }
}, { _id: false });

const changelogSchema = new mongoose.Schema({
    version: {
        type: String,
        required: [true, 'Version is required'],
        unique: true,
        trim: true,
        validate: {
            validator: function(v) {
                // Allow standard semantic versioning (1.0.0, 1.0.0-beta, 1.0.0-beta.1)
                return /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/i.test(v);
            },
            message: 'Version must be in semantic format (e.g., 1.0.0 or 1.0.0-beta)'
        }
    },
    date: {
        type: Date,
        default: Date.now
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxlength: 100,
        trim: true
    },
    description: {
        type: String,
        maxlength: 500,
        trim: true
    },
    type: {
        type: String,
        enum: ['major', 'minor', 'patch', 'initial'],
        default: 'minor'
    },
    icon: {
        type: String,
        enum: ['Sparkles', 'Rocket', 'Shield', 'Zap', 'BarChart3', 'Bell', 'Bug', 'Star', 'Gift', 'Flame', 'Heart'],
        default: 'Sparkles'
    },
    changes: {
        type: [changeSchema],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'At least one change is required'
        }
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    scheduledFor: {
        type: Date,
        default: null
    },
    order: {
        type: Number,
        default: 0
    },
    history: [{
        action: {
            type: String,
            enum: ['created', 'updated', 'published', 'unpublished', 'duplicated'],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        changes: {
            type: String // JSON string of what changed
        }
    }],
    // Roadmap feature fields
    showOnRoadmap: {
        type: Boolean,
        default: false
    },
    roadmapStatus: {
        type: String,
        enum: ['idea', 'planned', 'in-progress', 'testing', 'coming-soon'],
        default: 'planned'
    },
    estimatedRelease: {
        type: String, // e.g., "Q1 2026", "January 2026", "Week 2 of December"
        default: null
    },
    roadmapPriority: {
        type: Number, // For ordering on roadmap page (higher = more prominent)
        default: 0
    }
}, { 
    timestamps: true 
});

// Index for efficient queries
changelogSchema.index({ isPublished: 1, order: -1 });
changelogSchema.index({ scheduledFor: 1, isPublished: 1 }); // For scheduled publishing cron
// Optimized index for roadmap queries: filters by showOnRoadmap + isPublished, sorts by roadmapPriority
changelogSchema.index({ showOnRoadmap: 1, isPublished: 1, roadmapPriority: -1 }); 
// Note: version unique index is created automatically by unique: true on the field

const Changelog = mongoose.model('Changelog', changelogSchema);

export default Changelog;
