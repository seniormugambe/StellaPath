/**
 * P2P Payment Routes
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import {
  sendP2PPayment,
  getP2PHistory,
  validateRecipient,
  estimateP2PFees
} from '../controllers/p2pController';
import {
  p2pPaymentSchema,
  recipientValidationSchema
} from '../validators/p2pValidators.js';

const router = Router();

// P2P payment endpoints that don't require auth
router.get('/validate/:walletAddress', validateRecipient);
router.get('/fees', estimateP2PFees);

// All other P2P routes require authentication
router.use(authenticateToken);

router.post('/send', validateBody(p2pPaymentSchema), sendP2PPayment);
router.get('/history/:walletAddress', validateParams(recipientValidationSchema), getP2PHistory);

export default router;