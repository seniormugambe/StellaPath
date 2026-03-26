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

      // Clear auth token
      localStorage.removeItem('authToken')

      // Clear Redux state
      dispatch(disconnectWallet())

      console.log('✅ Successfully disconnected from wallet')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect wallet'
      setError(errorMessage)
      console.error('Wallet disconnection error:', err)
      // Don't throw error on disconnect failure
    }
  }, [dispatch, walletState.walletType])

  /**
   * Load available wallets on mount and validate persisted connection
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

    const validatePersistedConnection = async () => {
      // If wallet state shows connected but we need to validate it's still actually connected
      if (walletState.connected && walletState.walletType) {
        try {
          // For Freighter, check if it's still connected
          if (walletState.walletType === 'freighter') {
            const { isConnected } = await import('@stellar/freighter-api')
            const stillConnected = await isConnected()
            if (!stillConnected) {
              console.log('Freighter wallet is no longer connected, clearing state')
              dispatch(disconnectWallet())
            }
          }
          // Add similar checks for other wallet types if needed
        } catch (error) {
          console.error('Failed to validate wallet connection:', error)
          // If validation fails, clear the connection state
          dispatch(disconnectWallet())
        }
      }
    }

    const handleAuthLogout = () => {
      console.warn('Auth token expired/invalid, forcing wallet disconnect')
      // When auth token is invalid/expired, clear wallet connection state so the user can reconnect.
      disconnect()
    }

    loadAvailableWallets()
    validatePersistedConnection()

    window.addEventListener('auth:logout', handleAuthLogout)
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout)
    }
  }, [dispatch, walletState.connected, walletState.walletType, disconnect])

  /**
   * Connect to wallet
   * Validates: Requirement 6.1 - Secure wallet connection
   * Validates: Requirement 6.3 - Valid Stellar address validation
   */
  const connect = useCallback(async (walletType: WalletType) => {
    setIsConnecting(true)
    setError(null)

    try {
      console.log('🔗 Starting wallet connection process for:', walletType)
      // Connect to wallet
      const connection = await WalletManager.connect(walletType)
      console.log('🔗 Wallet connection result:', connection)

      // Authenticate with backend API
      console.log('🔐 Authenticating with backend API...')
      await authenticateWithBackend(connection.accountId, walletType)

      // Update Redux state
      dispatch(connectWallet({
        accountId: connection.accountId,
        publicKey: connection.publicKey,
        walletType: connection.walletType,
      }))

      console.log('✅ Successfully connected to', walletType, 'with account:', connection.accountId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(errorMessage)
      console.error('❌ Wallet connection error:', err)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [dispatch])

  /**
   * Authenticate wallet with backend API
   */
  const authenticateWithBackend = async (walletAddress: string, walletType: WalletType) => {
    try {
      console.log('🔐 Authenticating with backend API...')
      
      // Create authentication message
      const timestamp = new Date().toISOString()
      const message = `Authenticate wallet ${walletAddress} at ${timestamp}`
      console.log('📝 Authentication message:', message)
      
      // Sign the message with the wallet
      console.log('📝 Requesting wallet signature for authentication...')
      let signature: string
      try {
        signature = await WalletManager.signMessage(walletType, message)
        console.log('✍️ Received signature:', signature)
      } catch (signError) {
        console.error('❌ Wallet message signing failed:', signError)

        // In development, fall back to a dummy signature so that we still
        // hit the backend auth endpoint and obtain a JWT. The backend is
        // already configured to relax signature verification in development.
        if (import.meta.env.MODE === 'development') {
          console.warn('⚠️ Using development fallback signature for backend auth')
          signature = 'dev-fallback-signature'
        } else {
          throw signError
        }
      }
      
      // Send authentication request to backend
      console.log('🌐 Sending authentication request to backend...')
      const response = await fetch('http://localhost:3001/api/users/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          signature,
          message,
        }),
      })

      console.log('📡 Backend response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Backend authentication failed:', errorData)
        throw new Error(errorData.error || `Authentication failed: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📋 Backend response data:', data)
      
      if (data.success && data.token) {
        // Store the JWT token for API requests
        localStorage.setItem('authToken', data.token)
        console.log('✅ Backend authentication successful, token stored')
      } else {
        throw new Error(data.error || 'Authentication failed')
      }
    } catch (error) {
      console.error('❌ Backend authentication failed:', error)
      // Don't throw error - allow wallet connection to succeed even if backend auth fails
      console.warn('⚠️ Continuing without backend authentication - API calls may fail')
    }
  }

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
