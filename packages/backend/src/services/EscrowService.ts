import * as StellarSdk from 'stellar-sdk';
import { EscrowRepository } from '../repositories/EscrowRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { 
  EscrowRecord, 
  EscrowStatus,
  Condition,
  ConditionStatus,
  TransactionType
} from '../types/database';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import type { ConditionMonitorService } from './ConditionMonitorService';
import type { NotificationService } from './NotificationService';

export interface EscrowResult {
  success: boolean;
  escrow?: EscrowRecord;
  error?: string;
}

export interface EscrowParams {
  userId: string;
  sender: string;
  recipient: string;
  amount: number;
  conditions: Condition[];
  expiresAt: Date;
}

export interface EscrowDetails {
  escrow: EscrowRecord;
  conditionStatuses: ConditionStatus[];
  canRelease: boolean;
  isExpired: boolean;
}

export interface EscrowServiceConfig {
  networkPassphrase: string;
  horizonUrl: string;
  contractId: string;
}

export class EscrowService {
  private server: StellarSdk.Horizon.Server;
  private contractId: string;
  private conditionMonitor: ConditionMonitorService | null = null;
  private notificationService: NotificationService | null = null;

  constructor(
    private escrowRepository: EscrowRepository,
    private transactionRepository: TransactionRepository,
    config: EscrowServiceConfig
  ) {
    this.server = new StellarSdk.Horizon.Server(config.horizonUrl);
    this.contractId = config.contractId;
  }

  /**
   * Sets the ConditionMonitorService for automated condition checking.
   * Called after both services are constructed to avoid circular dependency.
   */
  setConditionMonitor(conditionMonitor: ConditionMonitorService): void {
    this.conditionMonitor = conditionMonitor;
    logger.info('Condition monitor attached to EscrowService');
  }

  /**
   * Sets the NotificationService for escrow status change notifications.
   * Called after both services are constructed to avoid circular dependency.
   */
  setNotificationService(notificationService: NotificationService): void {
    this.notificationService = notificationService;
    logger.info('Notification service attached to EscrowService');
  }

  async createEscrow(params: EscrowParams): Promise<EscrowResult> {
    try {
      logger.info('Creating escrow', { 
        sender: params.sender, 
        recipient: params.recipient, 
        amount: params.amount 
      });

      if (!StellarSdk.StrKey.isValidEd25519PublicKey(params.sender)) {
        return { success: false, error: 'Invalid sender address' };
      }

      if (!StellarSdk.StrKey.isValidEd25519PublicKey(params.recipient)) {
        return { success: false, error: 'Invalid recipient address' };
      }

      const account = await this.server.loadAccount(params.sender);
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      
      if (!nativeBalance || nativeBalance.asset_type !== 'native') {
        return { success: false, error: 'No native balance found' };
      }

      const balance = parseFloat(nativeBalance.balance);
      if (balance < params.amount) {
        return { success: false, error: 'Insufficient balance' };
      }

      const contractId = `escrow_${uuidv4()}`;

      const escrow = await this.escrowRepository.create({
        contractId,
        creatorId: params.userId,
        amount: params.amount,
        conditions: params.conditions,
        expiresAt: params.expiresAt
      });

      logger.info('Escrow created', { escrowId: escrow.id, contractId, parentContract: this.contractId });

      return { success: true, escrow };
    } catch (error) {
      logger.error('Error creating escrow', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkConditions(escrowId: string): Promise<ConditionStatus[]> {
    try {
      const escrow = await this.escrowRepository.findById(escrowId);
      if (!escrow) {
        throw new Error('Escrow not found');
      }

      const conditionStatuses: ConditionStatus[] = [];

      for (const condition of escrow.conditions) {
        const met = await this.evaluateCondition(condition, escrow);
        conditionStatuses.push({
          condition,
          met,
          checkedAt: new Date(),
          evidence: met ? 'Condition satisfied' : 'Condition not satisfied'
        });
      }

      return conditionStatuses;
    } catch (error) {
      logger.error('Error checking conditions', { escrowId, error });
      throw error;
    }
  }

  private async evaluateCondition(condition: Condition, escrow: EscrowRecord): Promise<boolean> {
    switch (condition.type) {
      case 'time_based':
        return this.evaluateTimeBased(condition, escrow);
      case 'oracle_based':
        return this.evaluateOracleBased(condition, escrow);
      case 'manual_approval':
        return this.evaluateManualApproval(condition, escrow);
      default:
        return false;
    }
  }

  private async evaluateTimeBased(condition: Condition, _escrow: EscrowRecord): Promise<boolean> {
    const targetTime = new Date(condition.parameters['targetTime']);
    const now = new Date();
    return now >= targetTime;
  }

  private async evaluateOracleBased(condition: Condition, _escrow: EscrowRecord): Promise<boolean> {
    logger.info('Oracle-based condition evaluation not implemented', { condition });
    return false;
  }

  private async evaluateManualApproval(condition: Condition, _escrow: EscrowRecord): Promise<boolean> {
    return condition.parameters['approved'] === true;
  }

  async releaseEscrow(escrowId: string): Promise<EscrowResult> {
    try {
      const escrow = await this.escrowRepository.findById(escrowId);
      if (!escrow) {
        return { success: false, error: 'Escrow not found' };
      }

      if (escrow.status !== EscrowStatus.ACTIVE) {
        return { success: false, error: 'Escrow is not active' };
      }

      const conditionStatuses = await this.checkConditions(escrowId);
      const allConditionsMet = conditionStatuses.every(cs => cs.met);

      if (!allConditionsMet) {
        return { success: false, error: 'Not all conditions are met' };
      }

      const txHash = `release_${uuidv4()}`;

      const updatedEscrow = await this.escrowRepository.updateStatus(escrowId, {
        status: EscrowStatus.RELEASED,
        releasedAt: new Date(),
        txHash
      });

      await this.transactionRepository.create({
        userId: escrow.creatorId,
        type: TransactionType.ESCROW,
        txHash,
        amount: Number(escrow.amount),
        sender: escrow.creatorId,
        recipient: escrow.recipientId || 'unknown',
        fees: 0,
        metadata: {
          escrowId: escrow.id,
          action: 'release',
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Escrow released', { escrowId, txHash });

      return { success: true, escrow: updatedEscrow };
    } catch (error) {
      logger.error('Error releasing escrow', { escrowId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async refundEscrow(escrowId: string): Promise<EscrowResult> {
    try {
      const escrow = await this.escrowRepository.findById(escrowId);
      if (!escrow) {
        return { success: false, error: 'Escrow not found' };
      }

      if (escrow.status !== EscrowStatus.ACTIVE) {
        return { success: false, error: 'Escrow is not active' };
      }

      const now = new Date();
      if (now < escrow.expiresAt) {
        return { success: false, error: 'Escrow has not expired yet' };
      }

      const txHash = `refund_${uuidv4()}`;

      const updatedEscrow = await this.escrowRepository.updateStatus(escrowId, {
        status: EscrowStatus.REFUNDED,
        releasedAt: new Date(),
        txHash
      });

      await this.transactionRepository.create({
        userId: escrow.creatorId,
        type: TransactionType.ESCROW,
        txHash,
        amount: Number(escrow.amount),
        sender: escrow.recipientId || 'unknown',
        recipient: escrow.creatorId,
        fees: 0,
        metadata: {
          escrowId: escrow.id,
          action: 'refund',
          timestamp: new Date().toISOString()
        }
      });

      logger.info('Escrow refunded', { escrowId, txHash });

      return { success: true, escrow: updatedEscrow };
    } catch (error) {
      logger.error('Error refunding escrow', { escrowId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getEscrowDetails(escrowId: string): Promise<EscrowDetails> {
    const escrow = await this.escrowRepository.findById(escrowId);
    if (!escrow) {
      throw new Error('Escrow not found');
    }

    const conditionStatuses = await this.checkConditions(escrowId);
    const canRelease = conditionStatuses.every(cs => cs.met);
    const isExpired = new Date() > escrow.expiresAt;

    return {
      escrow,
      conditionStatuses,
      canRelease,
      isExpired
    };
  }

  async scheduleConditionCheck(escrowId: string, checkInterval: number): Promise<void> {
    if (this.conditionMonitor) {
      await this.conditionMonitor.startMonitoring(escrowId, checkInterval);
      logger.info('Condition check scheduled via ConditionMonitorService', { escrowId, checkInterval });
    } else {
      logger.warn('ConditionMonitorService not attached, cannot schedule condition check', { escrowId, checkInterval });
    }
  }

  async notifyEscrowStatusChange(escrowId: string, status: EscrowStatus): Promise<void> {
    if (!this.notificationService) {
      logger.warn('NotificationService not attached, cannot send escrow status notification', { escrowId, status });
      return;
    }

    try {
      const escrow = await this.escrowRepository.findById(escrowId);
      if (!escrow) {
        logger.warn('Escrow not found for notification', { escrowId });
        return;
      }

      const templateData = {
        recipientName: escrow.creatorId,
        amount: String(escrow.amount),
        currency: 'XLM',
        escrowId: escrow.id,
      };

      if (status === EscrowStatus.RELEASED) {
        await this.notificationService.notifyEscrowRelease(
          escrow.creatorId,
          { ...templateData, transactionHash: escrow.txHash || '' },
          { escrowId: escrow.id }
        );
      } else if (status === EscrowStatus.REFUNDED || status === EscrowStatus.EXPIRED) {
        await this.notificationService.notifyEscrowRefund(
          escrow.creatorId,
          { ...templateData, reason: `Escrow status changed to ${status}` },
          { escrowId: escrow.id }
        );
      }

      logger.info('Escrow status change notification sent', { escrowId, status });
    } catch (error) {
      logger.error('Error sending escrow status notification', {
        escrowId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async processExpiredEscrows(): Promise<EscrowResult[]> {
    try {
      const expiredEscrows = await this.escrowRepository.findExpiredEscrows();
      const results: EscrowResult[] = [];

      for (const escrow of expiredEscrows) {
        const result = await this.refundEscrow(escrow.id);
        results.push(result);
      }

      return results;
    } catch (error) {
      logger.error('Error processing expired escrows', { error });
      return [];
    }
  }
}
