import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface WalletState {
  connected: boolean
  accountId: string | null
  publicKey: string | null
  network: 'testnet' | 'mainnet'
  walletType: 'freighter' | 'albedo' | 'walletconnect' | null
}

// Load initial state from localStorage
const loadPersistedState = (): WalletState => {
  try {
    const persistedState = localStorage.getItem('walletState')
    if (persistedState) {
      return JSON.parse(persistedState)
    }
  } catch (error) {
    console.error('Failed to load persisted wallet state:', error)
  }
  
  return {
    connected: false,
    accountId: null,
    publicKey: null,
    network: 'testnet',
    walletType: null,
  }
}

const initialState: WalletState = loadPersistedState()

// Helper function to persist state to localStorage
const persistState = (state: WalletState) => {
  try {
    localStorage.setItem('walletState', JSON.stringify(state))
  } catch (error) {
    console.error('Failed to persist wallet state:', error)
  }
}

export const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    connectWallet: (state, action: PayloadAction<{
      accountId: string
      publicKey: string
      walletType: WalletState['walletType']
    }>) => {
      console.log('🔄 Redux: Updating wallet state to connected:', action.payload)
      state.connected = true
      state.accountId = action.payload.accountId
      state.publicKey = action.payload.publicKey
      state.walletType = action.payload.walletType
      persistState(state)
      console.log('💾 Redux: Wallet state persisted to localStorage')
    },
    disconnectWallet: (state) => {
      state.connected = false
      state.accountId = null
      state.publicKey = null
      state.walletType = null
      persistState(state)
    },
    setNetwork: (state, action: PayloadAction<'testnet' | 'mainnet'>) => {
      state.network = action.payload
      persistState(state)
    },
  },
})

export const { connectWallet, disconnectWallet, setNetwork } = walletSlice.actions
export default walletSlice.reducer
