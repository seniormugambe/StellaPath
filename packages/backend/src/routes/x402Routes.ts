/**
 * X402 Routes - API routes for x402 protocol
 */

import { Router } from 'express';
import {
  processX402Payment,
  requestX402Resource,
  verifyX402Payment,
  createX402Session,
  getX402History,
  estimateX402Cost
} from '../controllers/x402Controller';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import {
  x402PaymentSchema,
  x402VerifySchema,
  x402SessionSchema
} from '../validators/x402Validators';

const router = Router();

/**
 * @route   POST /api/x402/pay
 * @desc    Process x402 payment authorization
 * @access  Private
 */
router.post('/pay', authenticateToken, validateBody(x402PaymentSchema), processX402Payment);

/**
 * @route   GET /api/x402/resource/:resourceId
 * @desc    Request resource (returns 402 with payment details)
 * @access  Public
 */
router.get('/resource/:resourceId', requestX402Resource);

/**
 * @route   POST /api/x402/verify
 * @desc    Verify payment and grant resource access
 * @access  Private
 */
router.post('/verify', authenticateToken, validateBody(x402VerifySchema), verifyX402Payment);

/**
 * @route   POST /api/x402/session
 * @desc    Create reusable x402 session
 * @access  Private
 */
router.post('/session', authenticateToken, validateBody(x402SessionSchema), createX402Session);

/**
 * @route   GET /api/x402/history
 * @desc    Get x402 payment history
 * @access  Private
 */
router.get('/history', authenticateToken, getX402History);

/**
 * @route   GET /api/x402/estimate
 * @desc    Estimate x402 payment cost
 * @access  Public
 */
router.get('/estimate', estimateX402Cost);

export default router;
