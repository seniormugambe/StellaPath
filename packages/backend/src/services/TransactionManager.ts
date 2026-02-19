import * as StellarSdk from 'stellar-sdk';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { 
  TransactionRecord, 
  CreateTransactionRequest,
  TransactionStatus,
  TransactionType,
  TransactionFilters,
  PaginationOptions,
  PaginatedResponse
} from '../types/database';
import { logger } from '../utils/logger';

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  transaction?: TransactionRecord;
  error?: string;
}

export interface BasicTransactionParams {
  userId: string;
  sender: string;
  recipient: string;
  amount: number;
  memo?: string;
}

export interface TransactionManagerConfig {
  networkPassphrase: string;
  horizonUrl: string;
  contractId?: string;
}

export class TransactionManager {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;

  constructor(
    private transactionRepository: TransactionRepository,
    config: TransactionManagerConfig
  ) {
    this.server = new StellarSdk.Horizon.Server(config.horizonUrl);
    this.networkPassphrase = config.networkPassphrase;
  }

  async createBasicTransaction(params: BasicTransactionParams): Promise<TransactionResult> {
    try {
      logger.info('Creating basic transaction', { 
        sender: params.sender, 
        recipient: params.recipient, 
        amount: params.amount 
      });

      const senderValid = await this.validateAddress(params.sender);
      if (!senderValid) {
        return { success: false, error: 'Invalid sender address' };
      }

      const recipientValid = await this.validateAddress(params.recipient);
      if (!recipientValid) {
        return { success: false, error: 'Invalid recipient address' };
      }

      const hasBalance = await this.validateBalance(params.sender, params.amount);
      if (!hasBalance) {
        return { success: false, error: 'Insufficient balance' };
      }

      const sourceAccount = await this.server.loadAccount(params.sender);
      const fee = await this.server.fetchBaseFee();

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
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

      const transactionRecord = await this.persistTransaction({
        userId: params.userId,
        type: TransactionType.BASIC,
        txHash,
        amount: params.amount,
        sender: params.sender,
        recipient: params.recipient,
        fees: Number(fee),
        metadata: { 
          ...(params.memo ? { memo: params.memo } : {}),
          timestamp: new Date().toISOString() 
        }
      });

      logger.info('Basic transaction created', { txHash });

      return { success: true, txHash, transaction: transactionRecord };
    } catch (error) {
      logger.error('Error creating basic transaction', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const transaction = await this.server.transactions().transaction(txHash).call();
      return transaction.successful ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED;
    } catch (error) {
      return TransactionStatus.PENDING;
    }
  }

  async getTransactionHistory(
    userId: string,
    filters?: TransactionFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<TransactionRecord>> {
    return this.transactionRepository.findByUserId(userId, filters, pagination);
  }

  async validateAddress(address: string): Promise<boolean> {
    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
        return false;
      }

      try {
        await this.server.loadAccount(address);
        return true;
      } catch (error) {
        logger.warn('Account not found on network', { address });
        return false;
      }
    } catch (error) {
      logger.error('Error validating address', { address, error });
      return false;
    }
  }

  async validateBalance(accountId: string, amount: number): Promise<boolean> {
    try {
      const account = await this.server.loadAccount(accountId);
      
      const nativeBalance = account.balances.find(
        (balance) => balance.asset_type === 'native'
      );

      if (!nativeBalance || nativeBalance.asset_type !== 'native') {
        return false;
      }

      const balance = parseFloat(nativeBalance.balance);
      const fee = await this.server.fetchBaseFee();
      const requiredBalance = amount + (Number(fee) / 10000000);

      return balance >= requiredBalance;
    } catch (error) {
      logger.error('Error validating balance', { accountId, error });
      return false;
    }
  }

  async persistTransaction(data: CreateTransactionRequest): Promise<TransactionRecord> {
    return this.transactionRepository.create(data);
  }

  async updateTransactionStatus(txHash: string, status: TransactionStatus): Promise<void> {
    await this.transactionRepository.updateStatusByTxHash(txHash, { status });
  }

  async syncTransactionStatus(txHash: string): Promise<TransactionStatus> {
    const status = await this.getTransactionStatus(txHash);
    await this.updateTransactionStatus(txHash, status);
    return status;
  }
}
