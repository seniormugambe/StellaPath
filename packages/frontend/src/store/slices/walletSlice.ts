import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface WalletState {
  connected: boolean
  accountId: string | null
  publicKey: string | null
  network: 'testnet' | 'mainnet'
  walletType: 'freighter' | 'albedo' | 'walletconnect' | null
}

const initialState: WalletState = {
  connected: false,
  accountId: null,
  publicKey: null,
  network: 'testnet',
  walletType: null,
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
      state.connected = true
      state.accountId = action.payload.accountId
      state.publicKey = action.payload.publicKey
      state.walletType = action.payload.walletType
    },
    disconnectWallet: (state) => {
      state.connected = false
      state.accountId = null
      state.publicKey = null
      state.walletType = null
    },
    setNetwork: (state, action: PayloadAction<'testnet' | 'mainnet'>) => {
      state.network = action.payload
    },
  },
})

export const { connectWallet, disconnectWallet, setNetwork } = walletSlice.actions
export default walletSlice.reducer
