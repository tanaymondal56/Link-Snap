import express from 'express';
import { requireBetaOrLocal } from '../middleware/domainGate.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireTester } from '../middleware/testerMiddleware.js';
import { testerLimiter } from '../middleware/rateLimiter.js';
import {
  getTesterStatus,
  redeemTesterCode,
  simulateBuy,
  expireNow,
  resetSubscription,
} from '../controllers/testerController.js';

const router = express.Router();

// 3-Layer Watertight Protection:
// 1. requireBetaOrLocal: Rejects production domain (lksnp.qzz.io), allows beta / local only (404 Fail Closed)
// 2. protect: Authenticates user session JWT
// 3. requireTester: Authorizes admin or active beta tester (404 Fail Closed)
router.use(requireBetaOrLocal, protect, requireTester);

router.get('/status', getTesterStatus);
router.post('/redeem', testerLimiter, redeemTesterCode);
router.post('/simulate-buy', testerLimiter, simulateBuy);
router.post('/expire-now', testerLimiter, expireNow);
router.post('/reset', testerLimiter, resetSubscription);

export default router;
