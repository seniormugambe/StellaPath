/**
 * useX402Flow Hook
 * Orchestrates the complete X402 payment flow: request → sign → complete
 * Implements step tracking and manages the 5-second payment cycle
 */

import { useCallback, useState } from 'react'
import {
  requestX402Resource,
  processX402Payment,
  estimateX402Cost,
  parseX402Price,
  type X402PaymentDetails,
  type X402CostEstimate,
} from '../utils/x402Api'
import { useWallet } from './useWallet'

export type X402FlowStep = 'idle' | 'requesting' | 'signing' | 'processing' | 'complete' | 'error'

export interface X402FlowState {
  step: X402FlowStep
  resourceId: string
  paymentDetails: X402PaymentDetails | null
  costEstimate: X402CostEstimate | null
  txHash: string | null
  error: string | null
  startTime: number | null
  elapsedSeconds: number
}

export interface UseX402FlowReturn extends X402FlowState {
  requestResource: (resourceId: string) => Promise<void>
  confirmPayment: (asset?: 'XLM' | 'USDC' | 'PYUSD' | 'USDY') => Promise<void>
  reset: () => void
  canProceedToPayment: boolean
  isProcessing: boolean
}

const INITIAL_STATE: X402FlowState = {
  step: 'idle',
  resourceId: '',
  paymentDetails: null,
  costEstimate: null,
  txHash: null,
  error: null,
  startTime: null,
  elapsedSeconds: 0,
}

/**
 * Custom hook for managing X402 payment flow
 * Implements the complete flow: Request → Receive 402 → Sign → Complete (~5 seconds)
 */
export const useX402Flow = (): UseX402FlowReturn => {
  const { accountId } = useWallet()
  const [state, setState] = useState<X402FlowState>(INITIAL_STATE)

  const canProceedToPayment = state.paymentDetails !== null && accountId !== null && state.step !== 'error'
  const isProcessing = state.step === 'requesting' || state.step === 'signing' || state.step === 'processing'

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  /**
   * Step 1: Request resource and receive 402 response
   * Validates: Payment details endpoint returns 402 with payment requirement
   */
  const requestResource = useCallback(
    async (resourceId: string) => {
      if (!resourceId.trim()) {
        setState((prev) => ({
          ...prev,
          error: 'Please enter a resource ID',
          step: 'error',
        }))
        return
      }

      if (!accountId) {
        setState((prev) => ({
          ...prev,
          error: 'Please connect your wallet first',
          step: 'error',
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        step: 'requesting',
        resourceId,
        error: null,
        startTime: Date.now(),
      }))

      try {
        // Make request to API endpoint - expect 402 Payment Required
        const response = await requestX402Resource(resourceId)

        if (!response.payment) {
          throw new Error('No payment details received')
        }

        // Get cost estimate
        const amount = parseX402Price(response.payment.price)
        const estimate = await estimateX402Cost(amount)

        setState((prev) => ({
          ...prev,
          step: 'idle',
          paymentDetails: response.payment || null,
          costEstimate: estimate,
          error: null,
        }))
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to request resource'
        setState((prev) => ({
          ...prev,
          step: 'error',
          error: errorMsg,
        }))
      }
    },
    [accountId]
  )

  /**
   * Step 2-3: Confirm payment and process transaction
   * Implements the wallet confirmation and payment completion
   * Target: Complete within 5 seconds from initial request
   */
  const confirmPayment = useCallback(
    async (asset: 'XLM' | 'USDC' | 'PYUSD' | 'USDY' = 'USDC') => {
      if (!accountId || !state.paymentDetails || !state.costEstimate) {
        setState((prev) => ({
          ...prev,
          error: 'Missing payment details or wallet connection',
          step: 'error',
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        step: 'signing',
        error: null,
      }))

      try {
        const amount = parseX402Price(state.paymentDetails.price)

        // Step 2: User confirms payment (wallet confirmation)
        // In a real implementation, this would trigger wallet UI
        await new Promise((resolve) => setTimeout(resolve, 500))

        setState((prev) => ({
          ...prev,
          step: 'processing',
        }))

        // Step 3: Send authorization to backend for payment processing
        const paymentRequest = {
          walletAddress: accountId,
          resourceUrl: state.paymentDetails.resourceUrl,
          amount,
          payTo: state.paymentDetails.payTo,
          asset,
          memo: `X402-${state.resourceId}`,
        }

        const result = await processX402Payment(paymentRequest)

        if (!result.success) {
          throw new Error(result.error?.message || 'Payment processing failed')
        }

        const elapsedMs = Date.now() - (state.startTime || Date.now())
        const elapsedSeconds = Math.round(elapsedMs / 1000)

        setState((prev) => ({
          ...prev,
          step: 'complete',
          txHash: result.data?.txHash || null,
          elapsedSeconds,
          error: null,
        }))
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Payment failed'
        setState((prev) => ({
          ...prev,
          step: 'error',
          error: errorMsg,
        }))
      }
    },
    [accountId, state.paymentDetails, state.costEstimate, state.resourceId, state.startTime]
  )

  return {
    ...state,
    requestResource,
    confirmPayment,
    reset,
    canProceedToPayment,
    isProcessing,
  }
}

