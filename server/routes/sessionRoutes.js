import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getMySessions,
  getCurrentSession,
  terminateSessionById,
  terminateOtherSessions,
  terminateAllSessions,
  getSessionCount
} from '../controllers/sessionController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all sessions for current user
router.get('/', getMySessions);

// Get current session details
router.get('/current', getCurrentSession);

// Get session count
router.get('/count', getSessionCount);

// Terminate all other sessions (must come before :id route)
router.delete('/others', terminateOtherSessions);

// Terminate all sessions (logout everywhere)
router.delete('/all', terminateAllSessions);

// Terminate a specific session by ID
router.delete('/:id', terminateSessionById);

export default router;
