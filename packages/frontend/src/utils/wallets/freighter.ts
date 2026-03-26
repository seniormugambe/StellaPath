/**
 * Freighter Wallet Integration
 * Provides connection and transaction signing for Freighter wallet
 */

import { isConnected, getPublicKey, signTransaction, getNetwork, signBlob } from '@stellar/freighter-api'
import type { WalletConnection, SignatureRequest } from '../../types'

export class FreighterWallet {
  /**
   * Check if Freighter extension is installed
   */
  static async isAvailable(): Promise<boolean> {
    try {
      return await isConnected()
    } catch (error) {
      console.error('Freighter availability check failed:', error)
      return false
    }
  }

  /**
   * Connect to Freighter wallet
   * Validates: Requirement 6.1 - Secure wallet connection
   */
  static async connect(): Promise<WalletConnection> {
    try {
      // Check if Freighter is available
      const available = await this.isAvailable()
      if (!available) {
        throw new Error('Freighter wallet is not installed. Please install the Freighter browser extension.')
      }

      // Get public key (this triggers the connection prompt)
      const publicKey = await getPublicKey()
      if (!publicKey) {
        throw new Error('Failed to get public key from Freighter')
      }

      // Get network information
      const network = await getNetwork()
      const networkType = network === 'PUBLIC' ? 'mainnet' : 'testnet'

      // Validates: Requirement 6.3 - Valid Stellar address validation
      if (!this.isValidStellarAddress(publicKey)) {
        throw new Error('Invalid Stellar address received from wallet')
      }

      return {
        accountId: publicKey,
        publicKey: publicKey,
        network: networkType,
        connected: true,
        walletType: 'freighter',
      }
    } catch (error) {
      console.error('Freighter connection failed:', error)
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Failed to connect to Freighter wallet'
      )
    }
  }

  /**
   * Sign a message with Freighter
   * Used for authentication and proving wallet ownership
   */
  static async signMessage(message: string): Promise<string> {
    try {
      console.log('🔐 FreighterWallet.signMessage called with message:', message)

      const available = await this.isAvailable()
      console.log('🔍 Freighter availability check:', available)

      if (!available) {
        throw new Error('Freighter wallet is not available')
      }

      // Use signBlob to sign the message. Different versions of Freighter
      // return different shapes, so normalise everything to a base64 string.
      console.log('📝 Calling Freighter signBlob...')
      // The Freighter API can return a few different types, so keep this loose.
      const rawSignature: any = await signBlob(message)
      console.log('✍️ Freighter signBlob returned:', rawSignature)

      if (!rawSignature) {
        throw new Error('Message signing was cancelled or failed')
      }

      let normalizedSignature: string

      if (typeof rawSignature === 'string') {
        normalizedSignature = rawSignature
      } else if (rawSignature instanceof Uint8Array) {
        // Browser-safe conversion of bytes to base64
        const uint = rawSignature as Uint8Array
        const binary = String.fromCharCode(...Array.from(uint))
        normalizedSignature = btoa(binary)
      } else if (typeof rawSignature === 'object') {
        // Handle Node Buffer JSON shape: { type: 'Buffer', data: number[] }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bufLike = rawSignature as any
        if (
          bufLike.type === 'Buffer' &&
          Array.isArray(bufLike.data)
        ) {
          const uint = Uint8Array.from(bufLike.data)
          const binary = String.fromCharCode(...uint)
          normalizedSignature = btoa(binary)
        } else {
          // Common Freighter shape: { publicKey, signature } or { signedMessage }
          const candidate =
            bufLike.signature ??
            bufLike.signedMessage

          if (typeof candidate === 'string' && candidate.length > 0) {
            normalizedSignature = candidate
          } else {
            throw new Error('Unexpected signature format returned from Freighter')
          }
        }
      } else {
        throw new Error('Unsupported signature type returned from Freighter')
      }

      return normalizedSignature
    } catch (error) {
      console.error('❌ Freighter message signing failed:', error)
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to sign message with Freighter'
      )
    }
  }

  /**
   * Sign a transaction with Freighter
   * Validates: Requirement 6.2 - Transaction signing with user authorization
   * Validates: Requirement 6.5 - Display transaction details before approval
   */
  static async signTransaction(request: SignatureRequest): Promise<string> {
    try {
      const available = await this.isAvailable()
      if (!available) {
        throw new Error('Freighter wallet is not available')
      }

      // Sign the transaction (Freighter will show transaction details to user)
      const signedXdr = await signTransaction(request.transaction, {
        network: request.network,
        accountToSign: request.accountId,
      })

      if (!signedXdr) {
        throw new Error('Transaction signing was cancelled or failed')
      }

      return signedXdr
    } catch (error) {
      console.error('Freighter transaction signing failed:', error)
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to sign transaction with Freighter'
      )
    }
  }

  /**
   * Disconnect from Freighter wallet
   * Validates: Requirement 6.4 - Clear session data on disconnect
   */
  static async disconnect(): Promise<void> {
    // Freighter doesn't require explicit disconnect
    // Session cleanup is handled by the application state
    console.log('Freighter wallet disconnected')
  }

  /**
   * Validate Stellar address format
   * Validates: Requirement 6.3 - Valid Stellar address validation
   */
  private static isValidStellarAddress(address: string): boolean {
    // Stellar addresses start with 'G' and are 56 characters long
    return /^G[A-Z0-9]{55}$/.test(address)
  }
}
