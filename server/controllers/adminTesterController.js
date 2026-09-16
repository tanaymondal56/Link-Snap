import mongoose from 'mongoose';
import Tester from '../models/Tester.js';
import User from '../models/User.js';
import '../models/MasterAdmin.js';
import { redisDel } from '../config/redis.js';
import logger from '../utils/logger.js';
import validator from 'validator';

/**
 * List all authorized beta testers
 * GET /api/admin/testers
 */
export const listTesters = async (req, res) => {
  try {
    const testers = await Tester.find({ isActive: true })
      .populate('addedBy', 'email username firstName lastName')
      .sort({ _id: -1 })
      .lean();

    // Ensure strictly descending order by creation date
    testers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      testers,
      count: testers.length,
    });
  } catch (error) {
    logger.error(`[AdminTester] Failed to list testers: ${error.message}`);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(500).json({
      message: 'Failed to retrieve testers',
      ...(isDev ? { error: error.message } : {}),
    });
  }
};

/**
 * Add a new authorized beta tester
 * POST /api/admin/testers
 */
export const addTester = async (req, res) => {
  try {
    const { email, notes } = req.body || {};

    if (!email || typeof email !== 'string' || !validator.isEmail(email.trim())) {
      return res.status(400).json({ message: 'Valid email address is required' });
    }

    const emailClean = email.toLowerCase().trim();
    const addedByModel = req.user.role === 'master_admin' || req.user.type === 'master' ? 'MasterAdmin' : 'User';

    // Check for existing tester record
    let tester = await Tester.findOne({ email: emailClean });

    if (tester) {
      if (tester.isActive) {
        return res.status(400).json({ message: 'Tester with this email already exists and is active' });
      }

      // Reactivate previously deleted/inactive tester
      tester.isActive = true;
      tester.notes = typeof notes === 'string' ? notes.trim() : tester.notes;
      tester.addedBy = req.user._id;
      tester.addedByModel = addedByModel;
      await tester.save();
    } else {
      tester = await Tester.create({
        email: emailClean,
        notes: typeof notes === 'string' ? notes.trim() : '',
        addedBy: req.user._id,
        addedByModel,
        isActive: true,
      });
    }

    // Purge Redis cache
    await redisDel(`ls:tester:${emailClean}`);

    // If an existing User exists for this email, invalidate their user session cache
    const existingUser = await User.findOne({ email: emailClean }).select('_id');
    if (existingUser) {
      await redisDel(`ls:user:${existingUser._id}`);
    }

    logger.info(`[AdminTester] Added/activated tester: ${emailClean} by ${req.user.email}`);

    res.status(201).json({
      message: 'Tester added successfully',
      tester,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This email is already registered as an authorized tester' });
    }
    logger.error(`[AdminTester] Failed to add tester: ${error.message}`);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(500).json({
      message: 'Failed to add tester',
      ...(isDev ? { error: error.message } : {}),
    });
  }
};

/**
 * Remove an authorized beta tester
 * DELETE /api/admin/testers/:id
 */
export const removeTester = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid tester ID format' });
    }

    const tester = await Tester.findById(id);
    if (!tester) {
      return res.status(404).json({ message: 'Tester not found' });
    }

    const emailClean = tester.email;
    await Tester.findByIdAndDelete(id);

    // Purge Redis tester cache
    await redisDel(`ls:tester:${emailClean}`);

    // Invalidate user session cache if user exists
    const existingUser = await User.findOne({ email: emailClean }).select('_id');
    if (existingUser) {
      await redisDel(`ls:user:${existingUser._id}`);
    }

    logger.info(`[AdminTester] Removed tester: ${emailClean} by ${req.user.email}`);

    res.json({
      message: 'Tester removed successfully',
      id,
    });
  } catch (error) {
    logger.error(`[AdminTester] Failed to remove tester: ${error.message}`);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(500).json({
      message: 'Failed to remove tester',
      ...(isDev ? { error: error.message } : {}),
    });
  }
};

export default {
  listTesters,
  addTester,
  removeTester,
};
