/**
 * X402 Service - Handles x402 protocol payments for AI agent economy
 * Implements the x402 standard for HTTP-native micropayments on Stellar
 * 
 * Reference: https://stellar.org/x402
 * Spec: https://x402.org
 */

import * as StellarSdk from 'stellar-sdk';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { 
  TransactionRecord, 
  TransactionType,
  TransactionStatus
} from '../types/database';
import { attachAnchorMetadata } from '../utils/anchorMetadata';
import { logger } from '../utils/logger';

export interface X402PaymentRequest {
  resourceUrl: string;
  price: string; // e.g., "$0.001" or "0.001 USDC"
  network: string; // e.g., "stellar:pubnet" or "stellar:testnet"
  payTo: string; // Merchant's Stellar address
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface X402PaymentAuthorization {
  userId: string;
  walletAddress: string;
  resourceUrl: string;
  amount: number;
  payTo: string;
  asset?: string; // Default: USDC
  memo?: string;
}

export interface X402PaymentResult {
  success: boolean;
  txHash?: string;
  transaction?: TransactionRecord;
  error?: string;
  statusCode?: number;
}

export interface X402ResourceConfig {
  path: string;
  price: string;
  description: string;
  payTo: string;
  network: string;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface X402SessionConfig {
  sessionId: string;
  userId: string;
  maxSpend: number;
  expiresAt: Date;
  allowedResources?: string[];
}

export interface X402ServiceConfig {
  networkPassphrase: string;
  horizonUrl: string;
  facilitatorUrl?: string | undefined; // OpenZeppelin facilitator
  defaultAsset?: {
    code: string;
    issuer: string;
  };
}

export class X402Service {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private defaultAsset: { code: string; issuer: string };

  constructor(
    private transactionRepository: TransactionRepository,
    private userRepository: UserRepository,
    config: X402ServiceConfig
  ) {
    this.server = new StellarSdk.Horizon.Server(config.horizonUrl);
    this.networkPassphrase = config.networkPassphrase;
    
    // Default to USDC on Stellar
    this.defaultAsset = config.defaultAsset || {
      code: 'USDC',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' // Circle USDC issuer
    };
  }

  /**
   * Process x402 payment for a resource
   * Implements the x402 payment flow: request -> 402 response -> payment -> resource
   */
  async processPayment(
    authorization: X402PaymentAuthorization
  ): Promise<X402PaymentResult> {
    try {
      logger.info('Processing x402 payment', {
        userId: authorization.userId,
        resourceUrl: authorization.resourceUrl,
        amount: authorization.amount
      });

      // Validate user exists
      const user = await this.userRepository.findById(authorization.userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: 404
        };
      }

      // Validate amount
      if (authorization.amount <= 0) {
        return {
          success: false,
          error: 'Amount must be positive',
          statusCode: 400
        };
      }

      // Load payer account
      const payerAccount = await this.server.loadAccount(authorization.walletAddress);
      
      // Determine asset (default to USDC)
      const asset = authorization.asset === 'XLM' 
        ? StellarSdk.Asset.native()
        : new StellarSdk.Asset(this.defaultAsset.code, this.defaultAsset.issuer);

      // Check balance
      const balance = this.getAccountBalance(payerAccount, asset);
      if (balance < authorization.amount) {
        return {
          success: false,
          error: `Insufficient balance. Required: ${authorization.amount}, Available: ${balance}`,
          statusCode: 402 // Payment Required
        };
      }

      // Build payment transaction
      const fee = await this.server.fetchBaseFee();
      const transaction = new StellarSdk.TransactionBuilder(payerAccount, {
        fee: fee.toString(),
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: authorization.payTo,
            asset: asset,
            amount: authorization.amount.toString()
          })
        )
        .setTimeout(180);

      // Add memo for x402 tracking
      const x402Memo = authorization.memo || `x402:${authorization.resourceUrl}`;
      transaction.addMemo(StellarSdk.Memo.text(x402Memo.substring(0, 28)));

      const builtTx = transaction.build();
      const txHash = builtTx.hash().toString('hex');

      // Record transaction
      const transactionRecord = await this.transactionRepository.create({
        userId: authorization.userId,
        type: TransactionType.P2P, // x402 is a specialized P2P payment
        txHash,
        amount: authorization.amount,
        sender: authorization.walletAddress,
        recipient: authorization.payTo,
        fees: Number(fee),
        metadata: attachAnchorMetadata({
          protocol: 'x402',
          resourceUrl: authorization.resourceUrl,
          asset: asset === StellarSdk.Asset.native() ? 'XLM' : `${asset.code}:${asset.issuer}`,
          timestamp: new Date().toISOString(),
          memo: x402Memo
        })
      });

      logger.info('x402 payment processed', { 
        txHash, 
        resourceUrl: authorization.resourceUrl 
      });

      return {
        success: true,
        txHash,
        transaction: transactionRecord,
        statusCode: 200
      };
    } catch (error) {
      logger.error('Error processing x402 payment', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  /**
   * Generate x402 payment request (402 response)
   * Returns the payment details that client needs to authorize
   */
  generatePaymentRequest(config: X402ResourceConfig): X402PaymentRequest {
    return {
      resourceUrl: config.path,
      price: config.price,
      network: config.network,
      payTo: config.payTo,
      description: config.description
    };
  }

  /**
   * Verify x402 payment was completed
   * Checks if a valid payment exists for the resource
   */
  async verifyPayment(
    userId: string,
    resourceUrl: string,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      const transactions = await this.transactionRepository.findByUserId(
        userId,
        { type: TransactionType.P2P },
        { page: 1, limit: 50 }
      );

      // Check if any recent transaction matches the resource
      const validPayment = transactions.data.find(tx => {
        const metadata = tx.metadata as { protocol?: string; resourceUrl?: string };
        const txAmount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount.toString());
        return (
          metadata.protocol === 'x402' &&
          metadata.resourceUrl === resourceUrl &&
          txAmount >= requiredAmount &&
          tx.status === TransactionStatus.CONFIRMED &&
          // Payment must be recent (within last 5 minutes)
          new Date(tx.timestamp).getTime() > Date.now() - 5 * 60 * 1000
        );
      });

      return !!validPayment;
    } catch (error) {
      logger.error('Error verifying x402 payment', { error });
      return false;
    }
  }

  /**
   * Create reusable x402 session (v2 feature)
   * Allows multiple payments within spending limits
   */
  async createSession(config: X402SessionConfig): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
  }> {
    try {
      // Store session configuration (would typically use Redis or database)
      logger.info('Creating x402 session', {
        sessionId: config.sessionId,
        userId: config.userId,
        maxSpend: config.maxSpend
      });

      // In production, store this in Redis with TTL
      // For now, just validate and return
      return {
        success: true,
        sessionId: config.sessionId
      };
    } catch (error) {
      logger.error('Error creating x402 session', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get x402 payment history for a user
   */
  async getPaymentHistory(
    userId: string,
    options?: { page?: number; limit?: number }
  ): Promise<TransactionRecord[]> {
    const result = await this.transactionRepository.findByUserId(
      userId,
      { type: TransactionType.P2P },
      { page: options?.page || 1, limit: options?.limit || 20 }
    );

    // Filter for x402 payments only
    return result.data.filter(tx => {
      const metadata = tx.metadata as { protocol?: string };
      return metadata.protocol === 'x402';
    });
  }

  /**
   * Estimate cost for x402 payment including network fees
   */
  async estimateCost(amount: number): Promise<{
    amount: number;
    networkFee: number;
    totalCost: number;
  }> {
    try {
      const baseFee = await this.server.fetchBaseFee();
      const networkFee = Number(baseFee) / 10000000; // Convert stroops to XLM

      return {
        amount,
        networkFee,
        totalCost: amount + networkFee
      };
    } catch (error) {
      logger.error('Error estimating x402 cost', { error });
      return {
        amount,
        networkFee: 0.00001,
        totalCost: amount + 0.00001
      };
    }
  }

  /**
   * Helper: Get account balance for specific asset
   */
  private getAccountBalance(
    account: StellarSdk.Horizon.AccountResponse,
    asset: StellarSdk.Asset
  ): number {
    if (asset.isNative()) {
      const nativeBalance = account.balances.find(b => b.asset_type === 'native');
      return nativeBalance && nativeBalance.asset_type === 'native' 
        ? parseFloat(nativeBalance.balance) 
        : 0;
    }

    const assetBalance = account.balances.find(
      b => b.asset_type !== 'native' && 
           b.asset_type !== 'liquidity_pool_shares' &&
           b.asset_code === asset.code && 
           b.asset_issuer === asset.issuer
    );

    return assetBalance && assetBalance.asset_type !== 'native' && assetBalance.asset_type !== 'liquidity_pool_shares'
      ? parseFloat(assetBalance.balance)
      : 0;
  }
}
