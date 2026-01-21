import Appeal from '../models/Appeal.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

// @desc    Submit an appeal (for banned users - requires appeal token)
// @route   POST /api/appeals
// @access  Public (with appeal token)
export const submitAppeal = async (req, res) => {
    try {
        const { message } = req.body;
        const authHeader = req.headers.authorization;

        if (!message) {
            return res.status(400).json({ message: 'Appeal message is required' });
        }

        if (message.length < 10) {
            return res.status(400).json({ message: 'Appeal message must be at least 10 characters' });
        }

        if (message.length > 2000) {
            return res.status(400).json({ message: 'Appeal message cannot exceed 2000 characters' });
        }

        // Verify Appeal Token
        let userId;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
                if (decoded.type !== 'appeal') {
                    return res.status(401).json({ message: 'Invalid token type' });
                }
                userId = decoded.id;
            } catch {
                return res.status(401).json({ message: 'Invalid or expired appeal session. Please try logging in again.' });
            }
        } else {
            return res.status(401).json({ message: 'Unauthorized. Please try logging in again to submit an appeal.' });
        }

        // Find the user by ID from token
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        // Check if user is actually banned
        if (user.isActive) {
            return res.status(400).json({ message: 'Your account is not suspended' });
        }

        // Check appeal limit (max 3 per ban)
        const appealsCount = await Appeal.countDocuments({
            userId: user._id,
            bannedAt: user.bannedAt
        });

        if (appealsCount >= 3) {
            return res.status(400).json({
                message: 'Maximum appeal limit reached (3/3). You cannot submit more appeals for this suspension.'
            });
        }

        // Check if user already has a pending appeal
        const existingAppeal = await Appeal.findOne({
            userId: user._id,
            status: 'pending'
        });

        if (existingAppeal) {
            return res.status(400).json({
                message: 'You already have a pending appeal. Please wait for admin review.'
            });
        }

        // Create the appeal
        const appeal = await Appeal.create({
            userId: user._id,
            message,
            bannedAt: user.bannedAt,
            bannedReason: user.bannedReason
        });

        res.status(201).json({
            message: 'Your appeal has been submitted successfully. We will review it and get back to you.',
            appealId: appeal._id
        });
    } catch (error) {
        // Handle duplicate key error (user already has pending appeal)
        if (error.code === 11000) {
            return res.status(400).json({
                message: 'You already have a pending appeal. Please wait for admin review.'
            });
        }
        logger.error('[Appeal] Submit appeal error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check appeal status (for banned users)
// @route   GET /api/appeals/status
// @access  Public
export const checkAppealStatus = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let userId;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
                if (decoded.type === 'appeal') {
                    userId = decoded.id;
                }
            } catch {
                return res.status(401).json({ message: 'Session expired. Please sign in again to view appeal status.' });
            }
        } else {
            return res.status(401).json({ message: 'Unauthorized. Please sign in again to view appeal status.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        const appeal = await Appeal.findOne({ userId: user._id })
            .sort({ createdAt: -1 })
            .select('status adminResponse createdAt reviewedAt');

        // Count appeals for the current ban
        const appealsCount = user.bannedAt ? await Appeal.countDocuments({
            userId: user._id,
            bannedAt: user.bannedAt
        }) : 0;

        // Build banInfo for currently banned users
        const banInfo = !user.isActive ? {
            bannedAt: user.bannedAt,
            bannedUntil: user.bannedUntil,
            reason: user.bannedReason
        } : null;

        // If user is currently banned, check if this appeal is relevant
        if (!user.isActive && user.bannedAt && appeal) {
            // If the appeal was created BEFORE the current ban, it's an old appeal.
            // We should ignore it so the user can submit a new one.
            if (new Date(appeal.createdAt) < new Date(user.bannedAt)) {
                return res.json({
                    hasAppeal: false,
                    isActive: user.isActive,
                    appealsCount: 0,
                    maxAppeals: 3,
                    banInfo
                });
            }
        }

        if (!appeal) {
            return res.json({
                hasAppeal: false,
                isActive: user.isActive,
                appealsCount: appealsCount,
                maxAppeals: 3,
                banInfo
            });
        }

        res.json({
            hasAppeal: true,
            isActive: user.isActive,
            status: appeal.status,
            adminResponse: appeal.status !== 'pending' ? appeal.adminResponse : null,
            submittedAt: appeal.createdAt,
            reviewedAt: appeal.reviewedAt,
            appealsCount: appealsCount,
            maxAppeals: 3,
            banInfo
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
