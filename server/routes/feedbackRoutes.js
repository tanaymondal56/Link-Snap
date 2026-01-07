import express from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/authMiddleware.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import Feedback from '../models/Feedback.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// ============================================
// RATE LIMITERS
// ============================================

// Rate limiter for feedback submissions (5 per hour per IP)
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: 'Too many feedback submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false } // Disable strict IP check for custom key generators
});

// Rate limiter for voting (30 per minute per user to prevent spam clicking)
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { message: 'Too many vote attempts. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString(), // Rate limit by user ID only
  validate: { ip: false } // Disable strict IP check for custom key generators
});

// ============================================
// SECURITY HELPERS
// ============================================

/**
 * Sanitize user input to prevent XSS attacks
 * Escapes HTML characters to prevent any injection
 */
const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  // Limit input length first to prevent any DoS
  let result = input.slice(0, 10000);
  
  // Escape HTML special characters (most secure approach)
  // This converts dangerous characters to safe HTML entities
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Remove dangerous URL schemes (case insensitive, loop until clean)
  // Covers javascript:, data:, and vbscript: protocols
  let prev;
  do {
    prev = result;
    result = result.split('javascript:').join('');
    result = result.split('JAVASCRIPT:').join('');
    result = result.split('data:').join('');
    result = result.split('DATA:').join('');
    result = result.split('vbscript:').join('');
    result = result.split('VBSCRIPT:').join('');
  } while (result !== prev);
  
  // Remove event handlers like onclick=, onload=, etc.
  // Loop until no more matches to handle nested patterns
  do {
    prev = result;
    result = result.replace(/on[a-z]{1,15}=/gi, '');
  } while (result !== prev);
  
  // Remove potential SQL injection patterns
  result = result.replace(/[";]/g, '');
  
  // Trim whitespace
  return result.trim();
};

/**
 * Validate MongoDB ObjectId format
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ============================================
// ROUTES
// ============================================

/**
 * @route   POST /feedback
 * @desc    Submit new feedback (auth optional)
 * @access  Public (with rate limiting)
 */
router.post('/', feedbackLimiter, optionalAuth, async (req, res) => {
  try {
    const { type, category, title, message, email, notifyOnUpdate, website } = req.body;
    
    // Honeypot check - if 'website' field is filled, it's likely a bot
    // This field is hidden in the UI and should never be filled by real users
    if (website) {
      // Silently accept but don't save (trick bots into thinking it worked)
      return res.status(201).json({
        message: 'Thank you for your feedback!',
        feedback: { _id: 'temp', title: title, type: type || 'feature_request', status: 'new' }
      });
    }
    
    // Sanitize inputs
    const sanitizedTitle = sanitizeInput(title);
    const sanitizedMessage = sanitizeInput(message);
    const sanitizedEmail = email ? sanitizeInput(email).toLowerCase() : '';
    
    // Validation
    if (!sanitizedTitle || sanitizedTitle.length < 5) {
      return res.status(400).json({ message: 'Title must be at least 5 characters' });
    }
    if (sanitizedTitle.length > 100) {
      return res.status(400).json({ message: 'Title cannot exceed 100 characters' });
    }
    if (!sanitizedMessage || sanitizedMessage.length < 20) {
      return res.status(400).json({ message: 'Please provide more details (min 20 characters)' });
    }
    if (sanitizedMessage.length > 2000) {
      return res.status(400).json({ message: 'Message cannot exceed 2000 characters' });
    }
    
    // If not logged in, email is required
    if (!req.user && !sanitizedEmail) {
      return res.status(400).json({ message: 'Email is required for anonymous submissions' });
    }
    if (!req.user && !isValidEmail(sanitizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    
    // Validate type
    const validTypes = ['feature_request', 'bug_report', 'improvement', 'question'];
    const feedbackType = validTypes.includes(type) ? type : 'feature_request';
    
    // Validate category
    const validCategories = ['general', 'links', 'analytics', 'ui', 'api', 'mobile', 'other'];
    const feedbackCategory = validCategories.includes(category) ? category : 'general';
    
    // Create feedback
    const feedback = new Feedback({
      user: req.user?._id || null,
      email: sanitizedEmail || req.user?.email,
      type: feedbackType,
      category: feedbackCategory,
      title: sanitizedTitle,
      message: sanitizedMessage,
      notifyOnUpdate: notifyOnUpdate || false,
      // Screenshot disabled for now - field exists but not accepting uploads
    });
    
    await feedback.save();
    
    res.status(201).json({
      message: 'Thank you for your feedback!',
      feedback: {
        _id: feedback._id,
        title: feedback.title,
        type: feedback.type,
        status: feedback.status
      }
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ message: 'Failed to submit feedback' });
  }
});

/**
 * @route   POST /feedback/:id/vote
 * @desc    Upvote a feedback item
 * @access  Private (logged in users only)
 */
router.post('/:id/vote', verifyToken, voteLimiter, async (req, res) => {
  try {
    // Validate ObjectId format
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid feedback ID' });
    }
    
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback || feedback.isDeleted) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    
    await feedback.addVote(req.user._id);
    
    res.json({
      message: 'Vote added',
      voteCount: feedback.voteCount,
      hasVoted: true
    });
  } catch (error) {
    if (error.message === 'You have already voted for this feedback') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Vote error:', error);
    res.status(500).json({ message: 'Failed to add vote' });
  }
});

/**
 * @route   DELETE /feedback/:id/vote
 * @desc    Remove upvote from a feedback item
 * @access  Private (logged in users only)
 */
router.delete('/:id/vote', verifyToken, voteLimiter, async (req, res) => {
  try {
    // Validate ObjectId format
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid feedback ID' });
    }
    
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback || feedback.isDeleted) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    
    await feedback.removeVote(req.user._id);
    
    res.json({
      message: 'Vote removed',
      voteCount: feedback.voteCount,
      hasVoted: false
    });
  } catch (error) {
    if (error.message === 'You have not voted for this feedback') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Remove vote error:', error);
    res.status(500).json({ message: 'Failed to remove vote' });
  }
});

export default router;

