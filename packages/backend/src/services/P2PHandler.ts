import * as StellarSdk from 'stellar-sdk';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { 
  TransactionRecord, 
  TransactionType,
  PaginationOptions
} from '../types/database';
import { logger } from '../utils/logger';

export interface P2PPaymentParams {
  userId: string;
  sender: string;
  recipient: string;
  amount: number;
  memo?: string;
}

export interface P2PPaymentResult {
  success: boolean;
  txHash?: string;
  transaction?: TransactionRecord;
  error?: string;
}

export interface RecipientValidation {
  valid: boolean;
  exists: boolean;
  address: string;
  error?: string;
}

export interface FeeEstimate {
  baseFee: number;
  estimatedFee: number;
  totalCost: number;
}

export interface P2PHandlerConfig {
  networkPassphrase: string;
  horizonUrl: string;
}

export class P2PHandler {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;

  constructor(
    private transactionRepository: TransactionRepository,
    config: P2PHandlerConfig
  ) {
    this.server = new StellarSdk.Horizon.Server(config.horizonUrl);
    this.networkPassphrase = config.networkPassphrase;
  }

  async sendPayment(params: P2PPaymentParams): Promise<P2PPaymentResult> {
    try {
      logger.info('Processing P2P payment', { 
        sender: params.sender, 
        recipient: params.recipient, 
        amount: params.amount 
      });

      if (params.amount <= 0) {
        return { success: false, error: 'Amount must be positive' };
      }

      const recipientValidation = await this.validateRecipient(params.recipient);
      if (!recipientValidation.valid) {
        return { 
          success: false, 
          error: recipientValidation.error || 'Invalid recipient address' 
        };
      }

      const senderAccount = await this.server.loadAccount(params.sender);
      const nativeBalance = senderAccount.balances.find(b => b.asset_type === 'native');
      
      if (!nativeBalance || nativeBalance.asset_type !== 'native') {
        return { success: false, error: 'No native balance found' };
      }

      const balance = parseFloat(nativeBalance.balance);
      const feeEstimate = await this.estimateFees(params.amount);
      
      if (balance < feeEstimate.totalCost) {
        return { 
          success: false, 
          error: `Insufficient balance. Required: ${feeEstimate.totalCost}, Available: ${balance}` 
        };
      }

      const fee = await this.server.fetchBaseFee();
      const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
        fee: fee.toString(),
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: params.recipient,
            asset: StellarSdk.Asset.native(),
            amount: params.amount.toString()
          })
        )
        .setTimeout(180);

      if (params.memo) {
        transaction.addMemo(StellarSdk.Memo.text(params.memo));
      }

      const builtTx = transaction.build();
      const txHash = builtTx.hash().toString('hex');

      const transactionRecord = await this.transactionRepository.create({
        userId: params.userId,
        type: TransactionType.P2P,
        txHash,
        amount: params.amount,
        sender: params.sender,
        recipient: params.recipient,
        fees: Number(fee),
        metadata: {
          ...(params.memo ? { memo: params.memo } : {}),
          timestamp: new Date().toISOString(),
          paymentType: 'p2p'
        }
      });

      logger.info('P2P payment processed', { txHash });

      return { 
        success: true, 
        txHash, 
        transaction: transactionRecord 
      };
    } catch (error) {
      logger.error('Error processing P2P payment', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async validateRecipient(address: string): Promise<RecipientValidation> {
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
        return {
          valid: false,
          exists: false,
          address,
          error: 'Invalid Stellar address format'
        };
      }

      try {
        await this.server.loadAccount(address);
        return {
          valid: true,
          exists: true,
          address
        };
      } catch (error) {
        return {
          valid: false,
          exists: false,
          address,
          error: 'Account does not exist on the Stellar network'
        };
      }
    } catch (error) {
      logger.error('Error validating recipient', { address, error });
      return {
        valid: false,
        exists: false,
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async estimateFees(amount: number): Promise<FeeEstimate> {
    try {
      const baseFee = await this.server.fetchBaseFee();
      const estimatedFee = Number(baseFee) / 10000000;
      const totalCost = amount + estimatedFee;

      return {
        baseFee: Number(baseFee),
        estimatedFee,
        totalCost
      };
    } catch (error) {
      logger.error('Error estimating fees', { error });
      return {
        baseFee: 100,
        estimatedFee: 0.00001,
        totalCost: amount + 0.00001
      };
    }
  }

  async getPaymentHistory(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<TransactionRecord[]> {
    const result = await this.transactionRepository.findByUserId(
      userId,
      { type: TransactionType.P2P },
      pagination
    );
    return result.data;
  }

  async notifyPaymentComplete(txHash: string, sender: string, recipient: string): Promise<void> {
    logger.info('Notifying payment complete', { txHash, sender, recipient });
  }

  async getPaymentDetails(txHash: string): Promise<TransactionRecord | null> {
    return this.transactionRepository.findByTxHash(txHash);
  }
}
