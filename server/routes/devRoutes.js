import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
  devUpgradeSelf, 
  devResetSelf, 
  devClearRedeemHistory,
  devCreateTestLinks,
  devGetTestLinks,
  devDeleteTestLinks
} from '../controllers/devController.js';

const router = express.Router();

// All dev routes require authentication
router.use(protect);

// DOUBLE SECURITY: Failsafe middleware
// Even if this file is loaded, strictly block access if not in development mode
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ message: 'Dev routes are disabled in production' });
  }
  next();
});

// Subscription overrides
router.post('/subscription/upgrade', devUpgradeSelf);
router.post('/subscription/reset', devResetSelf);
router.post('/subscription/clear-history', devClearRedeemHistory);

// Bulk test link management
router.post('/links', devCreateTestLinks);
router.get('/links', devGetTestLinks);
router.delete('/links', devDeleteTestLinks);

export default router;
