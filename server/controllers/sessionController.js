import mongoose from 'mongoose';
import Session from '../models/Session.js';
import { 
  hashToken, 
  formatSessionForResponse,
  terminateAllUserSessions 
} from '../utils/sessionHelper.js';
import logger from '../utils/logger.js';

// @desc    Get all sessions for current user
// @route   GET /api/sessions
// @access  Private
export const getMySessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const sessions = await Session.getUserSessions(userId);
    
    // Get current token hash to identify current session
    const currentToken = req.cookies.jwt;
    const currentTokenHash = currentToken ? hashToken(currentToken) : null;
    
    const formattedSessions = sessions.map(session => 
      formatSessionForResponse(session, currentTokenHash)
    );
    
    res.json({
      sessions: formattedSessions,
      total: formattedSessions.length
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ message: 'Failed to get sessions' });
  }
};

// @desc    Get current session details
// @route   GET /api/sessions/current
// @access  Private
export const getCurrentSession = async (req, res) => {
  try {
    const currentToken = req.cookies.jwt;
    if (!currentToken) {
      return res.status(404).json({ message: 'No active session' });
    }
    
    const tokenHash = hashToken(currentToken);
    const session = await Session.findOne({ tokenHash });
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    res.json(formatSessionForResponse(session, tokenHash));
  } catch (error) {
    console.error('Error getting current session:', error);
    res.status(500).json({ message: 'Failed to get current session' });
  }
};

// @desc    Terminate a specific session
// @route   DELETE /api/sessions/:id
// @access  Private
export const terminateSessionById = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const userId = req.user._id;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: 'Invalid session ID format' });
    }
    
    // Find the session
    const session = await Session.findOne({ _id: sessionId, userId });
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Check if trying to terminate current session
    const currentToken = req.cookies.jwt;
    const currentTokenHash = currentToken ? hashToken(currentToken) : null;
    
    if (session.tokenHash === currentTokenHash) {
      return res.status(400).json({ 
        message: 'Cannot terminate current session. Use logout instead.' 
      });
    }
    
    await session.deleteOne();
    
    logger.info(`[Session] User ${userId} terminated session ${sessionId}`);
    
    res.json({ 
      message: 'Session terminated successfully',
      sessionId 
    });
  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({ message: 'Failed to terminate session' });
  }
};

// @desc    Terminate all other sessions (keep current)
// @route   DELETE /api/sessions/others
// @access  Private
export const terminateOtherSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentToken = req.cookies.jwt;
    
    if (!currentToken) {
      return res.status(400).json({ message: 'No active session' });
    }
    
    const currentTokenHash = hashToken(currentToken);
    
    const result = await Session.terminateOthers(userId, currentTokenHash);
    
    logger.info(`[Session] User ${userId} terminated ${result.deletedCount} other sessions`);
    
    res.json({ 
      message: 'All other sessions terminated',
      terminatedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error terminating other sessions:', error);
    res.status(500).json({ message: 'Failed to terminate sessions' });
  }
};

// @desc    Terminate all sessions (full logout everywhere)
// @route   DELETE /api/sessions/all
// @access  Private
export const terminateAllSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const terminatedCount = await terminateAllUserSessions(userId);
    
    // Clear current session cookie
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'strict' : 'lax')
    });
    
    logger.info(`[Session] User ${userId} logged out everywhere (${terminatedCount} sessions)`);
    
    res.json({ 
      message: 'Logged out from all devices',
      terminatedCount 
    });
  } catch (error) {
    console.error('Error terminating all sessions:', error);
    res.status(500).json({ message: 'Failed to logout everywhere' });
  }
};

// @desc    Get session count for current user
// @route   GET /api/sessions/count
// @access  Private
export const getSessionCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await Session.countUserSessions(userId);
    
    res.json({ count });
  } catch (error) {
    console.error('Error getting session count:', error);
    res.status(500).json({ message: 'Failed to get session count' });
  }
};
