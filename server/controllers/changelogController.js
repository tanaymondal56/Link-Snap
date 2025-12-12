import Changelog from '../models/Changelog.js';
import mongoose from 'mongoose';
import { z } from 'zod';
import validator from 'validator';

// Helper to validate ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// XSS sanitization helper - strips HTML tags and escapes dangerous characters
const sanitizeText = (text) => {
    if (!text || typeof text !== 'string') return text;
    // Strip control characters and trim whitespace
    // Note: We do NOT use validator.escape() because React handles output escaping natively.
    // Using escape() here would cause double-encoding (e.g., "Don't" -> "Don&#x27;t" on screen).
    return validator.stripLow(text.trim());
};

// Validation schemas with XSS sanitization
const changeSchema = z.object({
    type: z.enum(['feature', 'improvement', 'fix', 'note', 'breaking', 'deprecated']),
    text: z.string().min(1).max(200).transform(sanitizeText)
});

const createChangelogSchema = z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, 'Invalid version format (X.Y.Z or X.Y.Z-tag)').transform(v => v.toLowerCase()),
    date: z.string().optional(),
    title: z.string().min(1).max(100).transform(sanitizeText),
    description: z.string().max(500).optional().transform(val => val ? sanitizeText(val) : val),
    type: z.enum(['major', 'minor', 'patch', 'initial']).optional(),
    icon: z.enum(['Sparkles', 'Rocket', 'Shield', 'Zap', 'BarChart3', 'Bell', 'Bug', 'Star', 'Gift', 'Flame', 'Heart']).optional(),
    changes: z.array(changeSchema).min(1, 'At least one change is required'),
    isPublished: z.boolean().optional(),
    scheduledFor: z.string().nullable().optional(), // ISO date string for scheduled publishing
    // Roadmap fields
    showOnRoadmap: z.boolean().optional(),
    roadmapStatus: z.enum(['idea', 'planned', 'in-progress', 'testing', 'coming-soon']).optional(),
    estimatedRelease: z.string().max(50).nullable().optional().transform(val => val ? sanitizeText(val) : val),
    roadmapPriority: z.number().min(0).max(100).optional()
});

const updateChangelogSchema = createChangelogSchema.partial();

// @desc    Get published changelogs (Public)
// @route   GET /api/changelog
// @access  Public
export const getPublicChangelogs = async (req, res, next) => {
    try {
        // Pagination (default: 20, max: 50)
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const skip = parseInt(req.query.skip) || 0;

        const [changelogs, total] = await Promise.all([
            Changelog.find({ isPublished: true })
                .sort({ order: -1, date: -1 })
                .skip(skip)
                .limit(limit)
                .select('-__v -history'),
            Changelog.countDocuments({ isPublished: true })
        ]);

        // Set cache headers for public endpoint
        res.set({
            'Cache-Control': 'public, max-age=60', // 1 minute cache
        });
        
        res.json({
            changelogs,
            pagination: {
                total,
                limit,
                skip,
                hasMore: skip + changelogs.length < total
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get public roadmap items
// @route   GET /api/changelog/roadmap
// @access  Public
export const getPublicRoadmap = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20); // Default 20, max 50
        const skip = (page - 1) * limit;

        // Base query for roadmap items
        const query = { 
            showOnRoadmap: true, 
            isPublished: false 
        };

        // Parallel execution: fetch paginated items AND aggregate total counts
        const [roadmapItems, countsAggregation] = await Promise.all([
            Changelog.find(query)
                .sort({ roadmapPriority: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('version title description type icon changes roadmapStatus estimatedRelease roadmapPriority createdAt')
                .lean(),
            Changelog.aggregate([
                { $match: query },
                { $group: { _id: "$roadmapStatus", count: { $sum: 1 } } }
            ])
        ]);

        // Process aggregation results into a map
        const counts = {
            'idea': 0, 'planned': 0, 'in-progress': 0, 'testing': 0, 'coming-soon': 0
        };
        let totalItems = 0;
        countsAggregation.forEach(c => {
            if (counts.hasOwnProperty(c._id)) {
                counts[c._id] = c.count;
            } else {
                // Handle unknown statuses if any
                counts[c._id] = c.count;
            }
            totalItems += c.count;
        });

        // Group the CURRENT PAGE items (for backward compatibility if frontend needs it, 
        // essentially providing the same structure but paginated)
        const grouped = {
            'idea': [], 'planned': [], 'in-progress': [], 'testing': [], 'coming-soon': []
        };
        roadmapItems.forEach(item => {
            const status = item.roadmapStatus || 'planned';
            if (grouped[status]) grouped[status].push(item);
        });

        // Set cache headers
        res.set({
            'Cache-Control': 'public, max-age=60', // 1 minute cache
        });

        res.json({
            items: roadmapItems,
            grouped, // Paginated grouping
            counts,  // GLOBAL counts for buttons
            pagination: {
                page,
                limit,
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                hasMore: (skip + roadmapItems.length) < totalItems
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all changelogs (Admin)
// @route   GET /api/admin/changelog
// @access  Admin
export const getAllChangelogs = async (req, res, next) => {
    try {
        const changelogs = await Changelog.find()
            .sort({ order: -1, date: -1 })
            .select('-__v');
        
        res.json(changelogs);
    } catch (error) {
        next(error);
    }
};

// @desc    Get single changelog
// @route   GET /api/admin/changelog/:id
// @access  Admin
export const getChangelogById = async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid changelog ID format' });
        }
        const changelog = await Changelog.findById(req.params.id);
        
        if (!changelog) {
            return res.status(404).json({ message: 'Changelog not found' });
        }
        
        res.json(changelog);
    } catch (error) {
        next(error);
    }
};

// @desc    Create changelog
// @route   POST /api/admin/changelog
// @access  Admin
export const createChangelog = async (req, res, next) => {
    try {
        const validation = createChangelogSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: validation.error.flatten().fieldErrors 
            });
        }

        // Check for duplicate version
        const existing = await Changelog.findOne({ version: validation.data.version });
        if (existing) {
            return res.status(409).json({ message: 'Version already exists' });
        }

        // Validate scheduledFor is not in the past
        if (validation.data.scheduledFor && new Date(validation.data.scheduledFor) < new Date()) {
            return res.status(400).json({ message: 'Scheduled date must be in the future' });
        }

        // Get highest order for new entry
        const highestOrder = await Changelog.findOne().sort({ order: -1 }).select('order');
        const newOrder = highestOrder ? highestOrder.order + 1 : 0;

        const changelog = await Changelog.create({
            ...validation.data,
            order: newOrder,
            history: [{
                action: 'created',
                timestamp: new Date(),
                changes: JSON.stringify({ version: validation.data.version, title: validation.data.title })
            }]
        });

        res.status(201).json(changelog);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Version already exists' });
        }
        next(error);
    }
};

// @desc    Update changelog
// @route   PUT /api/admin/changelog/:id
// @access  Admin
export const updateChangelog = async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid changelog ID format' });
        }
        const validation = updateChangelogSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: validation.error.flatten().fieldErrors 
            });
        }

        // Check for version conflict if version is being changed
        if (validation.data.version) {
            const existing = await Changelog.findOne({ 
                version: validation.data.version,
                _id: { $ne: req.params.id }
            });
            if (existing) {
                return res.status(409).json({ message: 'Version already exists' });
            }
        }

        // Validate scheduledFor is not in the past
        if (validation.data.scheduledFor && new Date(validation.data.scheduledFor) < new Date()) {
            return res.status(400).json({ message: 'Scheduled date must be in the future' });
        }

        // Find changelog first to track changes
        const changelog = await Changelog.findById(req.params.id);

        if (!changelog) {
            return res.status(404).json({ message: 'Changelog not found' });
        }

        // Edge Case #1: Optimistic locking - check for concurrent edits
        // If client sends lastModified, verify it matches the current updatedAt
        const clientLastModified = req.body._lastModified;
        if (clientLastModified) {
            const serverUpdatedAt = changelog.updatedAt.toISOString();
            if (clientLastModified !== serverUpdatedAt) {
                return res.status(409).json({ 
                    message: 'This changelog was modified by another user. Please refresh and try again.',
                    conflict: true,
                    serverUpdatedAt
                });
            }
        }

        // Track what fields are being changed
        const changedFields = Object.keys(validation.data).filter(key => {
            const oldVal = JSON.stringify(changelog[key]);
            const newVal = JSON.stringify(validation.data[key]);
            return oldVal !== newVal;
        });

        // Apply updates
        Object.assign(changelog, validation.data);

        // Add history entry if there were actual changes
        if (changedFields.length > 0) {
            changelog.history.push({
                action: 'updated',
                timestamp: new Date(),
                changes: `Updated: ${changedFields.join(', ')}`
            });
        }

        await changelog.save();

        res.json(changelog);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Version already exists' });
        }
        next(error);
    }
};

// @desc    Delete changelog
// @route   DELETE /api/admin/changelog/:id
// @access  Admin
export const deleteChangelog = async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid changelog ID format' });
        }
        const changelog = await Changelog.findByIdAndDelete(req.params.id);

        if (!changelog) {
            return res.status(404).json({ message: 'Changelog not found' });
        }

        res.json({ message: 'Changelog deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Duplicate changelog
// @route   POST /api/admin/changelog/:id/duplicate
// @access  Admin
export const duplicateChangelog = async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid changelog ID format' });
        }
        const original = await Changelog.findById(req.params.id);

        if (!original) {
            return res.status(404).json({ message: 'Changelog not found' });
        }

        // Generate new version (increment patch)
        const versionParts = original.version.match(/^(\d+)\.(\d+)\.(\d+)(-[a-z0-9]+)?$/i);
        let newVersion;
        if (versionParts) {
            const major = parseInt(versionParts[1]);
            const minor = parseInt(versionParts[2]);
            const patch = parseInt(versionParts[3]) + 1;
            const suffix = versionParts[4] || '';
            newVersion = `${major}.${minor}.${patch}${suffix}`;
        } else {
            newVersion = `${original.version}-copy`;
        }

        // Ensure unique version
        let counter = 1;
        let finalVersion = newVersion;
        while (await Changelog.findOne({ version: finalVersion })) {
            finalVersion = `${newVersion}-${counter}`;
            counter++;
        }

        // Get highest order
        const highestOrder = await Changelog.findOne().sort({ order: -1 }).select('order');
        const newOrder = highestOrder ? highestOrder.order + 1 : 0;

        const duplicate = await Changelog.create({
            version: finalVersion,
            date: new Date(),
            title: `${original.title} (Copy)`,
            description: original.description,
            type: original.type,
            icon: original.icon,
            changes: original.changes,
            isPublished: false,
            order: newOrder,
            history: [{
                action: 'duplicated',
                timestamp: new Date(),
                changes: `Duplicated from v${original.version}`
            }]
        });

        res.status(201).json(duplicate);
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle publish status
// @route   PATCH /api/admin/changelog/:id/publish
// @access  Admin
export const togglePublish = async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid changelog ID format' });
        }
        const changelog = await Changelog.findById(req.params.id);

        if (!changelog) {
            return res.status(404).json({ message: 'Changelog not found' });
        }

        changelog.isPublished = !changelog.isPublished;
        changelog.scheduledFor = null; // Clear scheduled time when manually toggling
        
        // Note: We intentionally persist roadmap fields (showOnRoadmap, etc.) even when published.
        // The getPublicRoadmap endpoint filters by isPublished: false, so they won't show on roadmap while published.
        // This effectively hides them from roadmap but preserves data if unpublished later (Fixes Data Loss Edge Case).
        
        changelog.history.push({
            action: changelog.isPublished ? 'published' : 'unpublished',
            timestamp: new Date(),
            changes: changelog.isPublished ? 'Published (hidden from roadmap)' : 'Unpublished (visible on roadmap if enabled)'
        });
        await changelog.save();

        res.json(changelog);
    } catch (error) {
        next(error);
    }
};

// @desc    Get latest published version (Public - for app version display)
// @route   GET /api/changelog/version
// @access  Public
export const getPublicLatestVersion = async (req, res, next) => {
    try {
        // Find the latest PUBLISHED changelog by order/date
        const latest = await Changelog.findOne({ isPublished: true })
            .sort({ order: -1, date: -1 })
            .select('version date')
            .lean(); // Use lean() for faster read-only queries

        // Set cache headers - cache for 5 minutes to reduce API load
        // but still update relatively quickly when new versions are published
        res.set({
            'Cache-Control': 'public, max-age=300', // 5 minutes
            'ETag': latest ? `"${latest.version}"` : '"0.0.0"'
        });

        // Handle case when no published changelogs exist
        if (!latest) {
            return res.json({ 
                version: null,
                message: 'No published versions yet',
                timestamp: new Date().toISOString()
            });
        }

        res.json({ 
            version: latest.version,
            publishedAt: latest.date,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Don't expose internal errors - return a safe fallback
        console.error('Error fetching public version:', error.message);
        res.status(500).json({ 
            version: null,
            error: 'Unable to fetch version',
            timestamp: new Date().toISOString()
        });
    }
};

// @desc    Get latest version (for auto-suggest)
// @route   GET /api/admin/changelog/latest-version
// @access  Admin
export const getLatestVersion = async (req, res, next) => {
    try {
        const latest = await Changelog.findOne()
            .sort({ order: -1 })
            .select('version');

        if (!latest) {
            return res.json({ suggestedVersion: '0.1.0' });
        }

        // Increment patch version
        const versionParts = latest.version.match(/^(\d+)\.(\d+)\.(\d+)(-[a-z0-9]+)?$/i);
        if (versionParts) {
            const major = parseInt(versionParts[1]);
            const minor = parseInt(versionParts[2]);
            const patch = parseInt(versionParts[3]) + 1;
            return res.json({ 
                latestVersion: latest.version,
                suggestedVersion: `${major}.${minor}.${patch}` 
            });
        }

        res.json({ latestVersion: latest.version, suggestedVersion: '0.1.0' });
    } catch (error) {
        next(error);
    }
};

// @desc    Bulk delete changelogs
// @route   DELETE /api/admin/changelog/bulk
// @access  Admin
export const bulkDeleteChangelogs = async (req, res, next) => {
    try {
        const { ids } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'IDs array is required' });
        }

        // Validate all IDs
        const invalidIds = ids.filter(id => !isValidObjectId(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({ message: 'Invalid ID format in array' });
        }

        const result = await Changelog.deleteMany({ _id: { $in: ids } });

        res.json({ 
            message: `Deleted ${result.deletedCount} changelog(s)`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Bulk publish/unpublish changelogs
// @route   PATCH /api/admin/changelog/bulk/publish
// @access  Admin
export const bulkPublishChangelogs = async (req, res, next) => {
    try {
        const { ids, publish } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'IDs array is required' });
        }

        if (typeof publish !== 'boolean') {
            return res.status(400).json({ message: 'publish field must be a boolean' });
        }

        // Validate all IDs
        const invalidIds = ids.filter(id => !isValidObjectId(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({ message: 'Invalid ID format in array' });
        }

        // Update all matching changelogs
        const result = await Changelog.updateMany(
            { _id: { $in: ids }, isPublished: { $ne: publish } },
            { 
                $set: { isPublished: publish, scheduledFor: null },
                $push: {
                    history: {
                        action: publish ? 'published' : 'unpublished',
                        timestamp: new Date(),
                        changes: 'Bulk operation'
                    }
                }
            }
        );

        res.json({ 
            message: `${publish ? 'Published' : 'Unpublished'} ${result.modifiedCount} changelog(s)`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reorder changelogs (normalize gaps or custom order)
// @route   PATCH /api/admin/changelog/reorder
// @access  Admin
export const reorderChangelogs = async (req, res, next) => {
    try {
        const { orderedIds } = req.body;
        
        // If orderedIds provided, set order based on array position
        if (orderedIds && Array.isArray(orderedIds)) {
            // Validate all IDs
            const invalidIds = orderedIds.filter(id => !isValidObjectId(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({ message: 'Invalid ID format in array' });
            }

            // Update each changelog with its new order
            const bulkOps = orderedIds.map((id, index) => ({
                updateOne: {
                    filter: { _id: id },
                    update: { $set: { order: index } }
                }
            }));
            
            await Changelog.bulkWrite(bulkOps);
            
            return res.json({ message: 'Changelogs reordered successfully' });
        }
        
        // If no orderedIds, normalize existing order to remove gaps
        const changelogs = await Changelog.find()
            .sort({ order: -1, date: -1 })
            .select('_id');
        
        const bulkOps = changelogs.map((changelog, index) => ({
            updateOne: {
                filter: { _id: changelog._id },
                update: { $set: { order: changelogs.length - 1 - index } }
            }
        }));
        
        await Changelog.bulkWrite(bulkOps);
        
        res.json({ 
            message: `Normalized order for ${changelogs.length} changelogs`,
            count: changelogs.length
        });
    } catch (error) {
        next(error);
    }
};
