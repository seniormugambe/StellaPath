/**
 * Transaction Management Routes
 */

import { Router } from 'express';
import {
  createTransaction,
  getTransaction,
  getTransactionByHash,
  getTransactionHistory,
  updateTransactionStatus,
  getTransactionStats,
  getPendingTransactions
} from '../controllers/transactionController';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import {
  createTransactionSchema,
  updateTransactionStatusSchema,
  transactionIdParamSchema,
  txHashParamSchema
} from '../validators/transactionValidators';

const router = Router();

// All transaction routes require authentication
router.use(authenticateToken);

// Transaction management
router.post('/', validateBody(createTransactionSchema), createTransaction);
router.get('/', getTransactionHistory);
router.get('/stats', getTransactionStats);
router.get('/pending', getPendingTransactions);
router.get('/hash/:txHash', validateParams(txHashParamSchema), getTransactionByHash);
router.get('/:transactionId', validateParams(transactionIdParamSchema), getTransaction);
router.patch(
  '/:transactionId/status',
  validateParams(transactionIdParamSchema),
  validateBody(updateTransactionStatusSchema),
  updateTransactionStatus
);

export default router;
