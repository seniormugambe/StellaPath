/**
 * Wallet Manager
 * Unified interface for managing multiple wallet types
 */

import { FreighterWallet } from './freighter'
import { AlbedoWallet } from './albedo'
import { WalletConnectWallet } from './walletconnect'
import type { WalletConnection, SignatureRequest } from '../../types'

export type WalletType = 'freighter' | 'albedo' | 'walletconnect'

export interface WalletAdapter {
  isAvailable(): Promise<boolean>
  connect(): Promise<WalletConnection>
  signTransaction(request: SignatureRequest): Promise<string>
  disconnect(): Promise<void>
}

/**
 * Wallet Manager
 * Provides unified interface for all supported wallets
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
export class WalletManager {
  private static wallets: Record<WalletType, WalletAdapter> = {
    freighter: FreighterWallet,
    albedo: AlbedoWallet,
    walletconnect: WalletConnectWallet,
  }

  /**
   * Get available wallets
   * Returns list of wallet types that are currently available
   */
  static async getAvailableWallets(): Promise<WalletType[]> {
    const available: WalletType[] = []
    
    for (const [type, wallet] of Object.entries(this.wallets)) {
      try {
        const isAvailable = await wallet.isAvailable()
        if (isAvailable) {
          available.push(type as WalletType)
        }
      } catch (error) {
        console.error(`Error checking ${type} availability:`, error)
      }
    }

    return available
  }

  /**
   * Connect to a specific wallet
   * Validates: Requirement 6.1 - Secure wallet connection
   * Validates: Requirement 6.3 - Valid Stellar address validation
   */
  static async connect(walletType: WalletType): Promise<WalletConnection> {
    const wallet = this.wallets[walletType]
    
    if (!wallet) {
      throw new Error(`Unsupported wallet type: ${walletType}`)
    }

    try {
      const connection = await wallet.connect()
      
      // Validate connection
      if (!connection.accountId || !connection.publicKey) {
        throw new Error('Invalid wallet connection: missing account information')
      }

      return connection
    } catch (error) {
      console.error(`Failed to connect to ${walletType}:`, error)
      throw error
    }
  }

  /**
   * Sign a transaction with the connected wallet
   * Validates: Requirement 6.2 - Transaction signing with user authorization
   * Validates: Requirement 6.5 - Display transaction details before approval
   */
  static async signTransaction(
    walletType: WalletType,
    request: SignatureRequest
  ): Promise<string> {
    const wallet = this.wallets[walletType]
    
    if (!wallet) {
      throw new Error(`Unsupported wallet type: ${walletType}`)
    }

    try {
      // Validate request
      if (!request.transaction || !request.accountId) {
        throw new Error('Invalid signature request: missing required fields')
      }

      const signedXdr = await wallet.signTransaction(request)
      
      if (!signedXdr) {
        throw new Error('Transaction signing failed: no signed XDR returned')
      }

      return signedXdr
    } catch (error) {
      console.error(`Failed to sign transaction with ${walletType}:`, error)
      throw error
    }
  }

  /**
   * Disconnect from wallet
   * Validates: Requirement 6.4 - Clear session data on disconnect
   */
  static async disconnect(walletType: WalletType): Promise<void> {
    const wallet = this.wallets[walletType]
    
    if (!wallet) {
      console.warn(`Unknown wallet type: ${walletType}`)
      return
    }

    try {
      await wallet.disconnect()
    } catch (error) {
      console.error(`Failed to disconnect from ${walletType}:`, error)
      // Don't throw error on disconnect failure
    }
  }

  /**
   * Get wallet display name
   */
  static getWalletDisplayName(walletType: WalletType): string {
    const names: Record<WalletType, string> = {
      freighter: 'Freighter',
      albedo: 'Albedo',
      walletconnect: 'WalletConnect',
    }
    return names[walletType] || walletType
  }

  /**
   * Get wallet description
   */
  static getWalletDescription(walletType: WalletType): string {
    const descriptions: Record<WalletType, string> = {
      freighter: 'Browser extension wallet for Stellar',
      albedo: 'Web-based Stellar wallet with no installation required',
      walletconnect: 'Connect with mobile wallets via QR code',
    }
    return descriptions[walletType] || ''
  }
}
