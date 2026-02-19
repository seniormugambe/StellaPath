/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_CLIENT_PORTAL_URL: string
  readonly VITE_STELLAR_NETWORK: string
  readonly VITE_STELLAR_HORIZON_URL: string
  readonly VITE_STELLAR_PASSPHRASE: string
  readonly VITE_SOROBAN_RPC_URL: string
  readonly VITE_SOROBAN_NETWORK_PASSPHRASE: string
  readonly VITE_TRANSACTION_CONTRACT_ADDRESS: string
  readonly VITE_ESCROW_CONTRACT_ADDRESS: string
  readonly VITE_INVOICE_CONTRACT_ADDRESS: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
  readonly VITE_ENABLE_TESTNET: string
  readonly VITE_ENABLE_MAINNET: string
  readonly VITE_ENABLE_DEBUG_MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}