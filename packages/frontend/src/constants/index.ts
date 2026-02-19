// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
export const CLIENT_PORTAL_URL = import.meta.env.VITE_CLIENT_PORTAL_URL || 'http://localhost:3000/client'

// Stellar Network Configuration
export const STELLAR_NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'testnet'
export const STELLAR_HORIZON_URL = import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
export const STELLAR_PASSPHRASE = import.meta.env.VITE_STELLAR_PASSPHRASE || 'Test SDF Network ; September 2015'

// Soroban Configuration
export const SOROBAN_RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
export const SOROBAN_NETWORK_PASSPHRASE = import.meta.env.VITE_SOROBAN_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'

// Contract Addresses
export const TRANSACTION_CONTRACT_ADDRESS = import.meta.env.VITE_TRANSACTION_CONTRACT_ADDRESS || ''
export const ESCROW_CONTRACT_ADDRESS = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || ''
export const INVOICE_CONTRACT_ADDRESS = import.meta.env.VITE_INVOICE_CONTRACT_ADDRESS || ''

// App Configuration
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Stellar DApp'
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

// Feature Flags
export const ENABLE_TESTNET = import.meta.env.VITE_ENABLE_TESTNET === 'true'
export const ENABLE_MAINNET = import.meta.env.VITE_ENABLE_MAINNET === 'true'
export const ENABLE_DEBUG_MODE = import.meta.env.VITE_ENABLE_DEBUG_MODE === 'true'

// Transaction Types
export const TRANSACTION_TYPES = {
  BASIC: 'basic',
  ESCROW: 'escrow',
  P2P: 'p2p',
  INVOICE: 'invoice',
} as const

// Transaction Status
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

// Escrow Status
export const ESCROW_STATUS = {
  ACTIVE: 'active',
  CONDITIONS_MET: 'conditions_met',
  RELEASED: 'released',
  REFUNDED: 'refunded',
  EXPIRED: 'expired',
} as const

// Invoice Status
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  APPROVED: 'approved',
  EXECUTED: 'executed',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const

// Wallet Types
export const WALLET_TYPES = {
  FREIGHTER: 'freighter',
  ALBEDO: 'albedo',
  RABET: 'rabet',
  WALLET_CONNECT: 'walletconnect',
} as const

// Routes
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  TRANSACTIONS: '/transactions',
  ESCROW: '/escrow',
  INVOICES: '/invoices',
  P2P: '/p2p',
  SETTINGS: '/settings',
  CLIENT_PORTAL: '/client',
} as const
