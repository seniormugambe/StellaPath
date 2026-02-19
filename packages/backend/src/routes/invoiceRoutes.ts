/**
 * Invoice Management Routes
 */

import { Router } from 'express';
import {
  createInvoice,
  getInvoice,
  getInvoices,
  updateInvoiceStatus,
  getInvoiceStats,
  getPublicInvoice,
  validateApprovalToken,
  approveInvoice,
  rejectInvoice,
  executeInvoice
} from '../controllers/invoiceController';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import {
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  approveInvoiceSchema,
  rejectInvoiceSchema,
  executeInvoiceSchema,
  validateTokenSchema,
  invoiceIdParamSchema,
  approvalTokenParamSchema
} from '../validators/invoiceValidators';

const router = Router();

// Public routes (Client Portal)
router.get('/public/:approvalToken', validateParams(approvalTokenParamSchema), getPublicInvoice);
router.post('/validate-token', validateBody(validateTokenSchema), validateApprovalToken);
router.post('/approve', validateBody(approveInvoiceSchema), approveInvoice);
router.post('/reject', validateBody(rejectInvoiceSchema), rejectInvoice);

// Protected routes (require authentication)
router.use(authenticateToken);

router.post('/', validateBody(createInvoiceSchema), createInvoice);
router.get('/', getInvoices);
router.get('/stats', getInvoiceStats);
router.get('/:invoiceId', validateParams(invoiceIdParamSchema), getInvoice);
router.patch(
  '/:invoiceId/status',
  validateParams(invoiceIdParamSchema),
  validateBody(updateInvoiceStatusSchema),
  updateInvoiceStatus
);
router.post(
  '/:invoiceId/execute',
  validateParams(invoiceIdParamSchema),
  validateBody(executeInvoiceSchema),
  executeInvoice
);

export default router;
