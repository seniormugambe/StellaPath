import * as StellarSdk from 'stellar-sdk';
import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { 
  InvoiceRecord, 
  InvoiceStatus,
  TransactionType,
  ApprovalResult,
  ClientInfo,
  PublicInvoice
} from '../types/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import type { InvoiceExpirationService } from './InvoiceExpirationService';

export interface InvoiceParams {
  creatorId: string;
  clientEmail: string;
  amount: number;
  description: string;
  dueDate: Date;
  metadata?: any;
}

export interface InvoiceResult {
  success: boolean;
  invoice?: InvoiceRecord;
  error?: string;
}

export interface InvoiceDelivery {
  invoiceId: string;
  clientEmail: string;
  approvalUrl: string;
  deliveryStatus: 'sent' | 'delivered' | 'failed';
  sentAt: Date;
  expiresAt: Date;
}

export interface TokenValidation {
  valid: boolean;
  invoice?: InvoiceRecord;
  error?: string;
}

export interface InvoiceManagerConfig {
  networkPassphrase: string;
  horizonUrl: string;
  contractId?: string;
  baseUrl: string;
}

export class InvoiceManager {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future Stellar network integration
  private _server: StellarSdk.Horizon.Server;
  private baseUrl: string;
  private expirationService: InvoiceExpirationService | null = null;

  constructor(
    private invoiceRepository: InvoiceRepository,
    private transactionRepository: TransactionRepository,
    config: InvoiceManagerConfig
  ) {
    this._server = new StellarSdk.Horizon.Server(config.horizonUrl);
    this.baseUrl = config.baseUrl;
  }

  /** Returns the Horizon server instance (for future Stellar network integration). */
  get server(): StellarSdk.Horizon.Server {
    return this._server;
  }

  /**
   * Sets the InvoiceExpirationService for scheduling expiration checks.
   * Called after both services are constructed to avoid circular dependencies.
   */
  setExpirationService(service: InvoiceExpirationService): void {
    this.expirationService = service;
  }

  async createInvoice(params: InvoiceParams): Promise<InvoiceResult> {
    try {
      logger.info('Creating invoice', { 
        creatorId: params.creatorId, 
        clientEmail: params.clientEmail, 
        amount: params.amount 
      });

      if (params.amount <= 0) {
        return { success: false, error: 'Invoice amount must be positive' };
      }

      if (!params.clientEmail || !this.isValidEmail(params.clientEmail)) {
        return { success: false, error: 'Invalid client email address' };
      }

      if (params.dueDate < new Date()) {
        return { success: false, error: 'Due date must be in the future' };
      }

      const invoice = await this.invoiceRepository.create({
        creatorId: params.creatorId,
        clientEmail: params.clientEmail,
        amount: params.amount,
        description: params.description,
        dueDate: params.dueDate,
        metadata: params.metadata || {}
      });

      logger.info('Invoice created', { invoiceId: invoice.id });

      return { success: true, invoice };
    } catch (error) {
      logger.error('Error creating invoice', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendInvoice(invoiceId: string): Promise<InvoiceDelivery> {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const approvalUrl = `${this.baseUrl}/invoice/approve/${invoice.approvalToken}`;

      await this.invoiceRepository.updateStatus(invoiceId, {
        status: InvoiceStatus.SENT
      });

      logger.info('Invoice sent', { invoiceId, clientEmail: invoice.clientEmail });

      return {
        invoiceId: invoice.id,
        clientEmail: invoice.clientEmail,
        approvalUrl,
        deliveryStatus: 'sent',
        sentAt: new Date(),
        expiresAt: invoice.dueDate
      };
    } catch (error) {
      logger.error('Error sending invoice', { invoiceId, error });
      throw error;
    }
  }

  async approveInvoice(invoiceId: string, clientInfo: ClientInfo): Promise<ApprovalResult> {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.SENT) {
        throw new Error('Invoice cannot be approved in current status');
      }

      if (new Date() > invoice.dueDate) {
        throw new Error('Invoice has expired');
      }

      await this.invoiceRepository.updateStatus(invoiceId, {
        status: InvoiceStatus.APPROVED,
        approvedAt: new Date()
      });

      logger.info('Invoice approved', { invoiceId });

      return {
        invoiceId: invoice.id,
        approved: true,
        clientInfo,
        approvalToken: invoice.approvalToken,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error approving invoice', { invoiceId, error });
      throw error;
    }
  }

  async executeInvoice(invoiceId: string): Promise<InvoiceResult> {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      if (invoice.status !== InvoiceStatus.APPROVED) {
        return { success: false, error: 'Invoice must be approved before execution' };
      }

      const txHash = `invoice_${uuidv4()}`;

      const updatedInvoice = await this.invoiceRepository.updateStatus(invoiceId, {
        status: InvoiceStatus.EXECUTED,
        executedAt: new Date(),
        txHash
      });

      await this.transactionRepository.create({
        userId: invoice.creatorId,
        type: TransactionType.INVOICE,
        txHash,
        amount: Number(invoice.amount),
        sender: 'client',
        recipient: invoice.creatorId,
        fees: 0,
        metadata: {
          invoiceId: invoice.id,
          ...(invoice.clientEmail ? { clientEmail: invoice.clientEmail } : {}),
          description: invoice.description,
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Invoice executed', { invoiceId, txHash });

      return { success: true, invoice: updatedInvoice };
    } catch (error) {
      logger.error('Error executing invoice', { invoiceId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async rejectInvoice(invoiceId: string, reason?: string): Promise<InvoiceResult> {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      if (invoice.status !== InvoiceStatus.SENT) {
        return { success: false, error: 'Invoice cannot be rejected in current status' };
      }

      const updatedInvoice = await this.invoiceRepository.updateStatus(invoiceId, {
        status: InvoiceStatus.REJECTED,
        metadata: {
          ...invoice.metadata,
          rejectionReason: reason,
          rejectedAt: new Date().toISOString()
        }
      });

      logger.info('Invoice rejected', { invoiceId, reason });

      return { success: true, invoice: updatedInvoice };
    } catch (error) {
      logger.error('Error rejecting invoice', { invoiceId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getInvoiceStatus(invoiceId: string): Promise<InvoiceStatus | null> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    return invoice ? invoice.status : null;
  }

  async generateApprovalToken(_invoiceId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    return token;
  }

  async validateApprovalToken(token: string): Promise<TokenValidation> {
    try {
      const invoice = await this.invoiceRepository.findByApprovalToken(token);
      
      if (!invoice) {
        return {
          valid: false,
          error: 'Invalid approval token'
        };
      }

      if (invoice.status === InvoiceStatus.EXPIRED) {
        return {
          valid: false,
          error: 'Invoice has expired'
        };
      }

      if (invoice.status === InvoiceStatus.EXECUTED) {
        return {
          valid: false,
          error: 'Invoice has already been executed'
        };
      }

      return {
        valid: true,
        invoice
      };
    } catch (error) {
      logger.error('Error validating approval token', { token, error });
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async scheduleInvoiceExpiration(invoiceId: string, expirationDate: Date): Promise<void> {
    if (this.expirationService) {
      await this.expirationService.scheduleInvoiceExpiration(invoiceId, expirationDate);
    } else {
      logger.warn('InvoiceExpirationService not configured, skipping expiration scheduling', {
        invoiceId,
        expirationDate,
      });
    }
  }

  async notifyInvoiceStatusChange(invoiceId: string, status: InvoiceStatus): Promise<void> {
    logger.info('Invoice status changed', { invoiceId, status });

    // If the invoice was just sent, schedule its expiration
    if (status === InvoiceStatus.SENT && this.expirationService) {
      const invoice = await this.invoiceRepository.findById(invoiceId);
      if (invoice) {
        await this.expirationService.scheduleInvoiceExpiration(invoiceId, invoice.dueDate);
      }
    }

    // If the invoice reached a terminal state, cancel any scheduled expiration
    const terminalStatuses: InvoiceStatus[] = [
      InvoiceStatus.APPROVED,
      InvoiceStatus.EXECUTED,
      InvoiceStatus.REJECTED,
      InvoiceStatus.EXPIRED,
    ];
    if (terminalStatuses.includes(status) && this.expirationService) {
      await this.expirationService.cancelScheduledExpiration(invoiceId);
    }
  }

  async processExpiredInvoices(): Promise<InvoiceResult[]> {
    try {
      if (this.expirationService) {
        const expirationResults = await this.expirationService.processExpiredInvoices();
        return expirationResults.map((result) => {
          const invoiceResult: InvoiceResult = {
            success: result.status === 'expired' || result.status === 'already_expired',
          };
          if (result.invoice) {
            invoiceResult.invoice = result.invoice;
          }
          if (result.error) {
            invoiceResult.error = result.error;
          }
          return invoiceResult;
        });
      }

      // Fallback: direct processing if expiration service is not configured
      const expiredInvoices = await this.invoiceRepository.findExpiredInvoices();
      const results: InvoiceResult[] = [];

      for (const invoice of expiredInvoices) {
        const updatedInvoice = await this.invoiceRepository.updateStatus(invoice.id, {
          status: InvoiceStatus.EXPIRED
        });
        results.push({ success: true, invoice: updatedInvoice });
      }

      return results;
    } catch (error) {
      logger.error('Error processing expired invoices', { error });
      return [];
    }
  }

  async getPublicInvoice(approvalToken: string): Promise<PublicInvoice | null> {
    return this.invoiceRepository.getPublicInvoice(approvalToken);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
