// Wallet types
export type WalletType = 'freighter' | 'albedo' | 'walletconnect'

export interface WalletConnection {
  accountId: string
  publicKey: string
  network: 'testnet' | 'mainnet'
  connected: boolean
  walletType: WalletType
}

export interface SignatureRequest {
  transaction: string // XDR encoded transaction
  accountId: string
  network: string
  metadata?: {
    description: string
    amount?: number
    recipient?: string
  }
}

// Transaction types
export type TransactionType = 'basic' | 'escrow' | 'p2p' | 'invoice'
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled'

export interface Transaction {
  id: string
  type: TransactionType
  sender: string
  recipient: string
  amount: number
  status: TransactionStatus
  timestamp: Date
  txHash?: string
  metadata?: Record<string, any>
}

// Escrow types
export type EscrowStatus = 'active' | 'conditions_met' | 'released' | 'refunded' | 'expired'

export interface Condition {
  type: 'time_based' | 'oracle_based' | 'manual_approval'
  parameters: Record<string, any>
  validator: string
}

export interface EscrowContract {
  id: string
  sender: string
  recipient: string
  amount: number
  conditions: Condition[]
  status: EscrowStatus
  createdAt: Date
  expiresAt: Date
  contractAddress: string
}

// Invoice types
export type InvoiceStatus = 'draft' | 'sent' | 'approved' | 'executed' | 'rejected' | 'expired'

export interface Invoice {
  id: string
  creator: string
  clientEmail: string
  amount: number
  description: string
  status: InvoiceStatus
  createdAt: Date
  dueDate: Date
  approvedAt?: Date
  executedAt?: Date
  txHash?: string
  approvalToken: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface TransactionResult {
  success: boolean
  txHash?: string
  error?: string
}

// User types
export interface User {
  id: string
  walletAddress: string
  email?: string
  displayName?: string
  createdAt: Date
}

// Notification types
export type NotificationType = 
  | 'invoice_received'
  | 'invoice_approved'
  | 'invoice_rejected'
  | 'transaction_confirmed'
  | 'escrow_released'
  | 'escrow_refunded'
  | 'system_alert'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: Date
  actionUrl?: string
  metadata: Record<string, any>
}
