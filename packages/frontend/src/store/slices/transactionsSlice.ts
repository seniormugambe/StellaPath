import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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

export interface TransactionsState {
  transactions: Transaction[]
  loading: boolean
  error: string | null
  filters: {
    type?: TransactionType
    status?: TransactionStatus
    dateFrom?: Date
    dateTo?: Date
  }
}

const initialState: TransactionsState = {
  transactions: [],
  loading: false,
  error: null,
  filters: {},
}

export const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.transactions = action.payload
      state.loading = false
      state.error = null
    },
    addTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions.unshift(action.payload)
    },
    updateTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<Transaction> }>) => {
      const index = state.transactions.findIndex(tx => tx.id === action.payload.id)
      if (index !== -1) {
        state.transactions[index] = { ...state.transactions[index], ...action.payload.updates }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      state.loading = false
    },
    setFilters: (state, action: PayloadAction<TransactionsState['filters']>) => {
      state.filters = action.payload
    },
    clearFilters: (state) => {
      state.filters = {}
    },
  },
})

export const {
  setTransactions,
  addTransaction,
  updateTransaction,
  setLoading,
  setError,
  setFilters,
  clearFilters,
} = transactionsSlice.actions

export default transactionsSlice.reducer
