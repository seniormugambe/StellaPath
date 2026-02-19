/**
 * Escrow Management Routes
 */

import { Router } from 'express';
import {
  createEscrow,
  getEscrow,
  getEscrowByContractId,
  getEscrows,
  getActiveEscrows,
  checkEscrowConditions,
  releaseEscrow,
  refundEscrow,
  updateEscrowStatus,
  getEscrowStats
} from '../controllers/escrowController';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import {
  createEscrowSchema,
  releaseEscrowSchema,
  refundEscrowSchema,
  updateEscrowStatusSchema,
  escrowIdParamSchema,
  contractIdParamSchema
} from '../validators/escrowValidators';

const router = Router();

// All escrow routes require authentication
router.use(authenticateToken);

// Escrow management
router.post('/', validateBody(createEscrowSchema), createEscrow);
router.get('/', getEscrows);
router.get('/stats', getEscrowStats);
router.get('/active', getActiveEscrows);
router.get('/contract/:contractId', validateParams(contractIdParamSchema), getEscrowByContractId);
router.get('/:escrowId', validateParams(escrowIdParamSchema), getEscrow);
router.get('/:escrowId/conditions', validateParams(escrowIdParamSchema), checkEscrowConditions);
router.post(
  '/:escrowId/release',
  validateParams(escrowIdParamSchema),
  validateBody(releaseEscrowSchema),
  releaseEscrow
);
router.post(
  '/:escrowId/refund',
  validateParams(escrowIdParamSchema),
  validateBody(refundEscrowSchema),
  refundEscrow
);
router.patch(
  '/:escrowId/status',
  validateParams(escrowIdParamSchema),
  validateBody(updateEscrowStatusSchema),
  updateEscrowStatus
);

export default router;
