/**
 * Albedo Wallet Integration
 * Provides connection and transaction signing for Albedo wallet
 */

import type { WalletConnection, SignatureRequest } from '../../types'

// Albedo types (since there's no official npm package)
interface AlbedoPublicKeyResponse {
  pubkey: string
  signed_message?: string
}

interface AlbedoTxResponse {
  xdr: string
  signed_envelope_xdr: string
  tx_hash: string
  network: string
}

interface AlbedoAPI {
  publicKey(options?: { token?: string; require_existing?: boolean }): Promise<AlbedoPublicKeyResponse>
  tx(options: {
    xdr: string
    network?: string
    pubkey?: string
    submit?: boolean
  }): Promise<AlbedoTxResponse>
}

declare global {
  interface Window {
    albedo?: AlbedoAPI
  }
}

export class AlbedoWallet {
  /**
   * Check if Albedo is available
   */
  static async isAvailable(): Promise<boolean> {
    // Albedo is loaded dynamically, so we check if it's available
    return typeof window !== 'undefined' && window.albedo !== undefined
  }

  /**
   * Load Albedo SDK dynamically
   */
  private static async loadAlbedo(): Promise<AlbedoAPI> {
    if (window.albedo) {
      return window.albedo
    }

    // Dynamically import Albedo
    try {
      // @ts-ignore - Dynamic import from CDN
      const albedoModule = await import('https://cdn.jsdelivr.net/npm/@albedo-link/intent@0.11.0/lib/albedo.intent.js')
      window.albedo = albedoModule.default || albedoModule
      return window.albedo!
    } catch (error) {
      throw new Error('Failed to load Albedo wallet SDK')
    }
  }

  /**
   * Connect to Albedo wallet
   * Validates: Requirement 6.1 - Secure wallet connection
   */
  static async connect(): Promise<WalletConnection> {
    try {
      // Load Albedo SDK
      const albedo = await this.loadAlbedo()

      // Request public key (this opens Albedo popup)
      const response = await albedo.publicKey()
      
      if (!response.pubkey) {
        throw new Error('Failed to get public key from Albedo')
      }

      // Validates: Requirement 6.3 - Valid Stellar address validation
      if (!this.isValidStellarAddress(response.pubkey)) {
        throw new Error('Invalid Stellar address received from wallet')
      }

      // Albedo defaults to testnet, but can be configured
      // For now, we'll use testnet as default
      const networkType = 'testnet'

      return {
        accountId: response.pubkey,
        publicKey: response.pubkey,
        network: networkType,
        connected: true,
        walletType: 'albedo',
      }
    } catch (error) {
      console.error('Albedo connection failed:', error)
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to connect to Albedo wallet'
      )
    }
  }

  /**
   * Sign a transaction with Albedo
   * Validates: Requirement 6.2 - Transaction signing with user authorization
   * Validates: Requirement 6.5 - Display transaction details before approval
   */
  static async signTransaction(request: SignatureRequest): Promise<string> {
    try {
      const albedo = await this.loadAlbedo()

      // Sign the transaction (Albedo will show transaction details to user)
      const response = await albedo.tx({
        xdr: request.transaction,
        network: request.network,
        pubkey: request.accountId,
        submit: false, // Don't auto-submit, let the app handle submission
      })

      if (!response.signed_envelope_xdr) {
        throw new Error('Transaction signing was cancelled or failed')
      }

      return response.signed_envelope_xdr
    } catch (error) {
      console.error('Albedo transaction signing failed:', error)
      throw new Error(
        error instanceof Error
          ? error.message
          : 'Failed to sign transaction with Albedo'
      )
    }
  }

  /**
   * Disconnect from Albedo wallet
   * Validates: Requirement 6.4 - Clear session data on disconnect
   */
  static async disconnect(): Promise<void> {
    // Albedo doesn't require explicit disconnect
    // Session cleanup is handled by the application state
    console.log('Albedo wallet disconnected')
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
