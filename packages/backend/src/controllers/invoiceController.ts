/**
 * Invoice Management Controller
 * 
 * Handles invoice creation, approval workflow, and client portal access
 */

import { Response } from 'express';
import { InvoiceRepository, NotificationRepository, InvoiceLineItemRepository } from '../repositories';
import { AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import prisma from '../utils/database';
import { 
  InvoiceStatus,
  InvoiceFilters,
  PaginationOptions,
  NotificationType
} from '../types/database';

const logger = createLogger();
const invoiceRepository = new InvoiceRepository(prisma);
const notificationRepository = new NotificationRepository(prisma);
const lineItemRepository = new InvoiceLineItemRepository(prisma);

/**
 * Create a new invoice
 * POST /api/invoices
 */
export const createInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { clientEmail, description, dueDate, metadata, lineItems } = req.body;

  // Validate line items if provided
  if (lineItems && lineItems.length > 0) {
    for (const item of lineItems) {
      if (item.quantity <= 0 || item.unitPrice < 0) {
        throw new AppError('Line item quantity must be positive and unit price cannot be negative', 400);
      }
    }
  }

  // Validate due date
  const dueDateObj = new Date(dueDate);
  if (dueDateObj <= new Date()) {
    throw new AppError('Due date must be in the future', 400);
  }

  // Create invoice
  const invoice = await invoiceRepository.create({
    creatorId: req.user.id,
    clientEmail,
    description,
    dueDate: dueDateObj,
    metadata: metadata || {},
    lineItems: lineItems || []
  });

  logger.info(`Invoice created: ${invoice.id} for ${clientEmail}`);

  res.status(201).json({
    success: true,
    invoice: {
      id: invoice.id,
      clientEmail: invoice.clientEmail,
      totalAmount: invoice.totalAmount,
      description: invoice.description,
      status: invoice.status,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      approvalToken: invoice.approvalToken,
      metadata: invoice.metadata,
      lineItems: invoice.lineItems
    }
  });
});

/**
 * Get invoice by ID
 * GET /api/invoices/:invoiceId
 */
export const getInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { invoiceId } = req.params;

  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  // Verify user has access to this invoice
  const userId = req.user?.id;
  if (userId && invoice.creatorId !== userId) {
    throw new AppError('Unauthorized to access this invoice', 403);
  }

  res.json({
    success: true,
    invoice: {
      id: invoice.id,
      clientEmail: invoice.clientEmail,
      totalAmount: invoice.totalAmount,
      description: invoice.description,
      status: invoice.status,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      approvedAt: invoice.approvedAt,
      executedAt: invoice.executedAt,
      txHash: invoice.txHash,
      approvalToken: invoice.approvalToken,
      metadata: invoice.metadata,
      lineItems: invoice.lineItems
    }
  });
});

/**
 * Get invoices for authenticated user
 * GET /api/invoices
 */
export const getInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  // Parse filters from query params
  const filters: InvoiceFilters = {};
  if (req.query['status']) filters.status = req.query['status'] as InvoiceStatus;
  if (req.query['clientEmail']) filters.clientEmail = req.query['clientEmail'] as string;
  if (req.query['startDate']) filters.startDate = new Date(req.query['startDate'] as string);
  if (req.query['endDate']) filters.endDate = new Date(req.query['endDate'] as string);
  if (req.query['minAmount']) filters.minAmount = parseFloat(req.query['minAmount'] as string);
  if (req.query['maxAmount']) filters.maxAmount = parseFloat(req.query['maxAmount'] as string);

  // Parse pagination options
  const pagination: PaginationOptions = {
    page: req.query['page'] ? parseInt(req.query['page'] as string) : 1,
    limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 20,
    sortBy: req.query['sortBy'] as string || 'createdAt',
    sortOrder: (req.query['sortOrder'] as 'asc' | 'desc') || 'desc'
  };

  const result = await invoiceRepository.findByCreatorId(req.user.id, filters, pagination);

  res.json({
    success: true,
    invoices: result.data.map(inv => ({
      id: inv.id,
      clientEmail: inv.clientEmail,
      amount: inv.amount,
      description: inv.description,
      status: inv.status,
      dueDate: inv.dueDate,
      createdAt: inv.createdAt,
      approvedAt: inv.approvedAt,
      executedAt: inv.executedAt,
      txHash: inv.txHash
    })),
    pagination: result.pagination
  });
});

/**
 * Update invoice status
 * PATCH /api/invoices/:invoiceId/status
 */
export const updateInvoiceStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { invoiceId } = req.params;
  const { status, txHash, metadata } = req.body;

  // Validate status
  if (!Object.values(InvoiceStatus).includes(status)) {
    throw new AppError('Invalid invoice status', 400);
  }

  // Get existing invoice to verify ownership
  const existing = await invoiceRepository.findById(invoiceId);
  if (!existing) {
    throw new AppError('Invoice not found', 404);
  }

  // Verify user has access to this invoice
  const userId = req.user?.id;
  if (userId && existing.creatorId !== userId) {
    throw new AppError('Unauthorized to update this invoice', 403);
  }

  const updateData: any = { status };
  
  if (status === InvoiceStatus.APPROVED) {
    updateData.approvedAt = new Date();
  }
  
  if (status === InvoiceStatus.EXECUTED) {
    updateData.executedAt = new Date();
    if (txHash) updateData.txHash = txHash;
  }

  if (metadata) {
    updateData.metadata = metadata;
  }

  const invoice = await invoiceRepository.updateStatus(invoiceId, updateData);

  logger.info(`Invoice status updated: ${invoiceId} -> ${status}`);

  res.json({
    success: true,
    invoice: {
      id: invoice.id,
      status: invoice.status,
      approvedAt: invoice.approvedAt,
      executedAt: invoice.executedAt,
      txHash: invoice.txHash
    }
  });
});

/**
 * Get invoice statistics
 * GET /api/invoices/stats
 */
export const getInvoiceStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const stats = await invoiceRepository.getInvoiceStats(req.user.id);

  res.json({
    success: true,
    stats
  });
});

// ============================================
// CLIENT PORTAL ENDPOINTS (Public Access)
// ============================================

/**
 * Get public invoice details by approval token
 * GET /api/invoices/public/:approvalToken
 */
export const getPublicInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { approvalToken } = req.params;

  const invoice = await invoiceRepository.getPublicInvoice(approvalToken);
  if (!invoice) {
    throw new AppError('Invoice not found or invalid token', 404);
  }

  res.json({
    success: true,
    invoice
  });
});

/**
 * Validate approval token
 * POST /api/invoices/validate-token
 */
export const validateApprovalToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { approvalToken } = req.body;

  if (!approvalToken) {
    throw new AppError('Approval token is required', 400);
  }

  const invoice = await invoiceRepository.findByApprovalToken(approvalToken);
  
  if (!invoice) {
    res.json({
      success: true,
      valid: false,
      message: 'Invalid or expired token'
    });
    return;
  }

  // Check if invoice is still in a state that can be approved
  const canApprove = invoice.status === InvoiceStatus.SENT || invoice.status === InvoiceStatus.DRAFT;
  
  // Check if invoice is expired
  const isExpired = new Date() > invoice.dueDate;

  res.json({
    success: true,
    valid: !isExpired && canApprove,
    invoice: {
      id: invoice.id,
      amount: invoice.totalAmount,
      description: invoice.description,
      status: invoice.status,
      dueDate: invoice.dueDate
    },
    canApprove,
    isExpired
  });
});

/**
 * Approve invoice (Client Portal)
 * POST /api/invoices/approve
 */
export const approveInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { approvalToken, clientInfo } = req.body;

  if (!approvalToken) {
    throw new AppError('Approval token is required', 400);
  }

  const invoice = await invoiceRepository.findByApprovalToken(approvalToken);
  if (!invoice) {
    throw new AppError('Invoice not found or invalid token', 404);
  }

  // Check if invoice can be approved
  if (invoice.status !== InvoiceStatus.SENT && invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError(`Invoice cannot be approved (current status: ${invoice.status})`, 400);
  }

  // Check if invoice is expired
  if (new Date() > invoice.dueDate) {
    throw new AppError('Invoice has expired', 400);
  }

  // Update invoice status to approved
  const updatedInvoice = await invoiceRepository.updateStatus(invoice.id, {
    status: InvoiceStatus.APPROVED,
    approvedAt: new Date(),
    metadata: {
      ...invoice.metadata,
      clientInfo: {
        ...clientInfo,
        approvalTimestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    }
  });

  // Create notification for the invoice creator (Requirement 4.3, 4.4)
  try {
    await notificationRepository.create({
      userId: invoice.creatorId,
      type: NotificationType.INVOICE_APPROVED,
      title: 'Invoice Approved',
      message: `Your invoice for ${Number(invoice.totalAmount ?? invoice.amount).toFixed(7)} XLM has been approved by ${clientInfo?.name || clientInfo?.email || 'the client'}. Payment can now be executed.`,
      actionUrl: `/invoices/${invoice.id}`,
      metadata: {
        invoiceId: invoice.id,
        amount: Number(invoice.totalAmount ?? invoice.amount),
        clientEmail: invoice.clientEmail
      }
    });
  } catch (notifError) {
    logger.warn('Failed to create approval notification', { invoiceId: invoice.id, error: notifError });
  }

  logger.info(`Invoice approved: ${invoice.id} by ${clientInfo?.email || 'client'}`);

  res.json({
    success: true,
    message: 'Invoice approved successfully',
    invoice: {
      id: updatedInvoice.id,
      status: updatedInvoice.status,
      approvedAt: updatedInvoice.approvedAt
    }
  });
});

/**
 * Reject invoice (Client Portal)
 * POST /api/invoices/reject
 */
export const rejectInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { approvalToken, reason, clientInfo } = req.body;

  if (!approvalToken) {
    throw new AppError('Approval token is required', 400);
  }

  const invoice = await invoiceRepository.findByApprovalToken(approvalToken);
  if (!invoice) {
    throw new AppError('Invoice not found or invalid token', 404);
  }

  // Check if invoice can be rejected
  if (invoice.status !== InvoiceStatus.SENT && invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError(`Invoice cannot be rejected (current status: ${invoice.status})`, 400);
  }

  // Update invoice status to rejected
  const updatedInvoice = await invoiceRepository.updateStatus(invoice.id, {
    status: InvoiceStatus.REJECTED,
    metadata: {
      ...invoice.metadata,
      rejectionReason: reason,
      clientInfo: {
        ...clientInfo,
        rejectionTimestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    }
  });

  // Create notification for the invoice creator (Requirement 4.4)
  try {
    const reasonText = reason ? ` Reason: ${reason}` : '';
    await notificationRepository.create({
      userId: invoice.creatorId,
      type: NotificationType.INVOICE_REJECTED,
      title: 'Invoice Declined',
      message: `Your invoice for ${Number(invoice.totalAmount ?? invoice.amount).toFixed(7)} XLM has been declined by ${clientInfo?.email || 'the client'}.${reasonText}`,
      actionUrl: `/invoices/${invoice.id}`,
      metadata: {
        invoiceId: invoice.id,
        amount: Number(invoice.totalAmount ?? invoice.amount),
        clientEmail: invoice.clientEmail,
        rejectionReason: reason
      }
    });
  } catch (notifError) {
    logger.warn('Failed to create rejection notification', { invoiceId: invoice.id, error: notifError });
  }

  logger.info(`Invoice rejected: ${invoice.id} by ${clientInfo?.email || 'client'}`);

  res.json({
    success: true,
    message: 'Invoice rejected successfully',
    invoice: {
      id: updatedInvoice.id,
      status: updatedInvoice.status
    }
  });
});

/**
 * Execute approved invoice (trigger payment)
 * POST /api/invoices/:invoiceId/execute
 */
export const executeInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { invoiceId } = req.params;
  const { txHash } = req.body;

  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  // Verify user has access to this invoice
  if (invoice.creatorId !== req.user.id) {
    throw new AppError('Unauthorized to execute this invoice', 403);
  }

  // Check if invoice is approved
  if (invoice.status !== InvoiceStatus.APPROVED) {
    throw new AppError('Invoice must be approved before execution', 400);
  }

  // Update invoice status to executed
  const updatedInvoice = await invoiceRepository.updateStatus(invoiceId, {
    status: InvoiceStatus.EXECUTED,
    executedAt: new Date(),
    txHash
  });

  logger.info(`Invoice executed: ${invoiceId} with txHash: ${txHash}`);

  res.json({
    success: true,
    message: 'Invoice executed successfully',
    invoice: {
      id: updatedInvoice.id,
      status: updatedInvoice.status,
      executedAt: updatedInvoice.executedAt,
      txHash: updatedInvoice.txHash
    }
  });
});

/**
 * Add line item to invoice
 * POST /api/invoices/:invoiceId/line-items
 */
export const addLineItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { invoiceId } = req.params;
  const { description, quantity, unitPrice } = req.body;

  // Validate input
  if (!description || quantity <= 0 || unitPrice < 0) {
    throw new AppError('Invalid line item data', 400);
  }

  // Get invoice and verify ownership
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  if (invoice.creatorId !== req.user.id) {
    throw new AppError('Unauthorized to modify this invoice', 403);
  }

  // Check if invoice can be modified
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Line items can only be added to draft invoices', 400);
  }

  // Add line item
  const lineItem = await lineItemRepository.create(invoiceId, {
    description,
    quantity,
    unitPrice
  });

  // Recalculate invoice total
  await invoiceRepository.recalculateTotal(invoiceId);

  logger.info(`Line item added to invoice: ${invoiceId}, item: ${lineItem.id}`);

  res.status(201).json({
    success: true,
    lineItem
  });
});

/**
 * Update line item
 * PATCH /api/invoices/:invoiceId/line-items/:itemId
 */
export const updateLineItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { invoiceId, itemId } = req.params;
  const { description, quantity, unitPrice, sortOrder } = req.body;

  // Get invoice and verify ownership
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  if (invoice.creatorId !== req.user.id) {
    throw new AppError('Unauthorized to modify this invoice', 403);
  }

  // Check if invoice can be modified
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Line items can only be modified for draft invoices', 400);
  }

  // Update line item
  const updatedItem = await lineItemRepository.update(itemId, {
    description,
    quantity,
    unitPrice,
    sortOrder
  });

  // Recalculate invoice total
  await invoiceRepository.recalculateTotal(invoiceId);

  logger.info(`Line item updated: ${itemId} in invoice: ${invoiceId}`);

  res.json({
    success: true,
    lineItem: updatedItem
  });
});

/**
 * Delete line item
 * DELETE /api/invoices/:invoiceId/line-items/:itemId
 */
export const deleteLineItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { invoiceId, itemId } = req.params;

  // Get invoice and verify ownership
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  if (invoice.creatorId !== req.user.id) {
    throw new AppError('Unauthorized to modify this invoice', 403);
  }

  // Check if invoice can be modified
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Line items can only be deleted from draft invoices', 400);
  }

  // Delete line item
  await lineItemRepository.delete(itemId);

  // Recalculate invoice total
  await invoiceRepository.recalculateTotal(invoiceId);

  logger.info(`Line item deleted: ${itemId} from invoice: ${invoiceId}`);

  res.json({
    success: true,
    message: 'Line item deleted successfully'
  });
});

/**
 * Reorder line items
 * PATCH /api/invoices/:invoiceId/line-items/reorder
 */
export const reorderLineItems = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { invoiceId } = req.params;
  const { itemIds } = req.body;

  if (!Array.isArray(itemIds)) {
    throw new AppError('itemIds must be an array', 400);
  }

  // Get invoice and verify ownership
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  if (invoice.creatorId !== req.user.id) {
    throw new AppError('Unauthorized to modify this invoice', 403);
  }

  // Check if invoice can be modified
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError('Line items can only be reordered for draft invoices', 400);
  }

  // Reorder line items
  await lineItemRepository.reorder(invoiceId, itemIds);

  logger.info(`Line items reordered for invoice: ${invoiceId}`);

  res.json({
    success: true,
    message: 'Line items reordered successfully'
  });
});
