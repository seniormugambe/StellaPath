/**
 * X402 API — Stellar micropayments / HTTP 402 flows.
 * Uses the shared apiClient for JSON APIs; uses axios directly for GET /x402/resource/:id (HTTP 402).
 */

import axios from 'axios'
import { apiClient } from './api'
import type { ApiResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken')
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export interface X402PaymentRequest {
  walletAddress: string
  resourceUrl: string
  amount: number
  payTo: string
  asset?: 'XLM' | 'USDC' | 'PYUSD' | 'USDY'
  memo?: string
}

export interface X402PaymentResponse {
  success: boolean
  data?: {
    txHash: string
    transaction: unknown
  }
  error?: {
    code: string
    message: string
  }
}

export interface X402PaymentDetails {
  resourceUrl: string
  price: string
  network: string
  payTo: string
  description: string
}

export interface X402ResourceResponse {
  success?: boolean
  error?: { code: string; message: string }
  payment?: X402PaymentDetails
}

export interface X402SessionRequest {
  maxSpend: number
  expiresIn?: number
  allowedResources?: string[]
}

export interface X402CostEstimate {
  amount: number
  networkFee: number
  totalCost: number
}

/**
 * Request a resource — backend responds with HTTP 402 and a payment payload.
 */
export async function requestX402Resource(resourceId: string): Promise<X402ResourceResponse> {
  const url = `${API_BASE_URL}/x402/resource/${encodeURIComponent(resourceId)}`
  const { data, status } = await axios.get<X402ResourceResponse & { payment?: X402PaymentDetails }>(url, {
    headers: authHeaders(),
    validateStatus: (s) => s === 402 || s === 200,
  })

  if (status === 402 && data?.payment) {
    return {
      success: false,
      error: data.error,
      payment: data.payment,
    }
  }

  if (status === 200 && data) {
    return data
  }

  throw new Error('Unexpected response from x402 resource endpoint')
}

/**
 * Process x402 payment (requires JWT).
 */
export async function processX402Payment(payment: X402PaymentRequest): Promise<X402PaymentResponse> {
  const res = await apiClient.post<{ txHash: string; transaction: unknown }>('/x402/pay', payment)
  if (res.success && res.data) {
    return {
      success: true,
      data: {
        txHash: res.data.txHash,
        transaction: res.data.transaction,
      },
    }
  }
  return {
    success: false,
    error: {
      code: 'PAYMENT_FAILED',
      message: res.error || 'Payment failed',
    },
  }
}

/**
 * Verify x402 payment (requires JWT).
 */
export async function verifyX402Payment(resourceUrl: string, requiredAmount: number): Promise<boolean> {
  const res = await apiClient.post<{ verified: boolean }>('/x402/verify', {
    resourceUrl,
    requiredAmount,
  })
  return res.success === true && res.data?.verified === true
}

/**
 * Create x402 session (requires JWT).
 */
export async function createX402Session(session: X402SessionRequest): Promise<ApiResponse<unknown>> {
  return apiClient.post('/x402/session', session)
}

/**
 * Get x402 payment history (requires JWT).
 */
export async function getX402History(page = 1, limit = 20): Promise<
  ApiResponse<{ payments: unknown[]; page: number; limit: number; total: number }>
> {
  return apiClient.get('/x402/history', { page, limit })
}

/**
 * Estimate x402 payment cost (public).
 */
export async function estimateX402Cost(amount: number): Promise<X402CostEstimate> {
  const res = await apiClient.get<X402CostEstimate>('/x402/estimate', { amount })
  if (res.success && res.data) {
    return res.data
  }
  throw new Error(res.error || 'Failed to estimate x402 cost')
}

/** Parse price strings like "$0.001" or "0.001" to a number */
export function parseX402Price(price: string): number {
  const n = parseFloat(String(price).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}
