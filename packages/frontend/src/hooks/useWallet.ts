/**
 * useWallet Hook
 * React hook for wallet connection and transaction signing
 */

import { useCallback, useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { connectWallet, disconnectWallet } from '../store/slices/walletSlice'
import { WalletManager, type WalletType } from '../utils/wallets'
import type { SignatureRequest } from '../types'

export interface UseWalletReturn {
  // State
  connected: boolean
  accountId: string | null
  publicKey: string | null
  network: 'testnet' | 'mainnet'
  walletType: WalletType | null
  isConnecting: boolean
  error: string | null
  availableWallets: WalletType[]

  // Actions
  connect: (walletType: WalletType) => Promise<void>
  disconnect: () => Promise<void>
  signTransaction: (request: SignatureRequest) => Promise<string>
  clearError: () => void
}

/**
 * Custom hook for wallet management
 * Provides wallet connection, disconnection, and transaction signing
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
export const useWallet = (): UseWalletReturn => {
  const dispatch = useAppDispatch()
  const walletState = useAppSelector((state) => state.wallet)
  
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableWallets, setAvailableWallets] = useState<WalletType[]>([])

  /**
   * Load available wallets on mount
   */
  useEffect(() => {
    const loadAvailableWallets = async () => {
      try {
        const wallets = await WalletManager.getAvailableWallets()
        setAvailableWallets(wallets)
      } catch (err) {
        console.error('Failed to load available wallets:', err)
      }
    }

    loadAvailableWallets()
  }, [])

  /**
   * Connect to wallet
   * Validates: Requirement 6.1 - Secure wallet connection
   * Validates: Requirement 6.3 - Valid Stellar address validation
   */
  const connect = useCallback(async (walletType: WalletType) => {
    setIsConnecting(true)
    setError(null)

    try {
      // Connect to wallet
      const connection = await WalletManager.connect(walletType)

      // Update Redux state
      dispatch(connectWallet({
        accountId: connection.accountId,
        publicKey: connection.publicKey,
        walletType: connection.walletType,
      }))

      console.log(`Successfully connected to ${walletType}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(errorMessage)
      console.error('Wallet connection error:', err)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [dispatch])

  /**
   * Disconnect from wallet
   * Validates: Requirement 6.4 - Clear session data on disconnect
   */
  const disconnect = useCallback(async () => {
    setError(null)

    try {
      // Disconnect from wallet if connected
      if (walletState.walletType) {
        await WalletManager.disconnect(walletState.walletType)
      }

      // Clear Redux state
      dispatch(disconnectWallet())

      console.log('Successfully disconnected from wallet')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect wallet'
      setError(errorMessage)
      console.error('Wallet disconnection error:', err)
      // Don't throw error on disconnect failure
    }
  }, [dispatch, walletState.walletType])

  /**
   * Sign a transaction
   * Validates: Requirement 6.2 - Transaction signing with user authorization
   * Validates: Requirement 6.5 - Display transaction details before approval
   */
  const signTransaction = useCallback(async (request: SignatureRequest): Promise<string> => {
    setError(null)

    if (!walletState.connected || !walletState.walletType) {
      const errorMessage = 'Wallet is not connected'
      setError(errorMessage)
      throw new Error(errorMessage)
    }

    try {
      // Sign transaction with connected wallet
      const signedXdr = await WalletManager.signTransaction(
        walletState.walletType,
        request
      )

      console.log('Transaction signed successfully')
      return signedXdr
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign transaction'
      setError(errorMessage)
      console.error('Transaction signing error:', err)
      throw err
    }
  }, [walletState.connected, walletState.walletType])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // State
    connected: walletState.connected,
    accountId: walletState.accountId,
    publicKey: walletState.publicKey,
    network: walletState.network,
    walletType: walletState.walletType,
    isConnecting,
    error,
    availableWallets,

    // Actions
    connect,
    disconnect,
    signTransaction,
    clearError,
  }
}
