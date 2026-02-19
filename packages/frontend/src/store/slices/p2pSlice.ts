import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface P2PPayment {
  id: string
  sender: string
  recipient: string
  amount: number
  memo?: string
  status: 'pending' | 'confirmed' | 'failed'
  txHash?: string
  timestamp: string
  fees?: number
}

export interface FeeEstimate {
  baseFee: number
  estimatedFee: number
  totalCost: number
}

export interface P2PState {
  payments: P2PPayment[]
  loading: boolean
  error: string | null
  feeEstimate: FeeEstimate | null
  feeLoading: boolean
  recipientValid: boolean | null
  recipientChecking: boolean
}

const initialState: P2PState = {
  payments: [],
  loading: false,
  error: null,
  feeEstimate: null,
  feeLoading: false,
  recipientValid: null,
  recipientChecking: false,
}

export const p2pSlice = createSlice({
  name: 'p2p',
  initialState,
  reducers: {
    setPayments: (state, action: PayloadAction<P2PPayment[]>) => {
      state.payments = action.payload
      state.loading = false
      state.error = null
    },
    addPayment: (state, action: PayloadAction<P2PPayment>) => {
      state.payments.unshift(action.payload)
    },
    updatePayment: (state, action: PayloadAction<{ id: string; updates: Partial<P2PPayment> }>) => {
      const index = state.payments.findIndex(p => p.id === action.payload.id)
      if (index !== -1) {
        state.payments[index] = { ...state.payments[index], ...action.payload.updates }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      state.loading = false
    },
    setFeeEstimate: (state, action: PayloadAction<FeeEstimate | null>) => {
      state.feeEstimate = action.payload
      state.feeLoading = false
    },
    setFeeLoading: (state, action: PayloadAction<boolean>) => {
      state.feeLoading = action.payload
    },
    setRecipientValid: (state, action: PayloadAction<boolean | null>) => {
      state.recipientValid = action.payload
      state.recipientChecking = false
    },
    setRecipientChecking: (state, action: PayloadAction<boolean>) => {
      state.recipientChecking = action.payload
    },
  },
})

export const {
  setPayments,
  addPayment,
  updatePayment,
  setLoading,
  setError,
  setFeeEstimate,
  setFeeLoading,
  setRecipientValid,
  setRecipientChecking,
} = p2pSlice.actions

export default p2pSlice.reducer
