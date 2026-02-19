import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { InvoiceStatus } from '../../types'

export interface InvoiceListItem {
  id: string
  clientEmail: string
  amount: number
  description: string
  status: InvoiceStatus
  dueDate: string
  createdAt: string
  approvedAt?: string
  executedAt?: string
  txHash?: string
}

export interface InvoiceStats {
  total: number
  draft: number
  sent: number
  approved: number
  executed: number
  rejected: number
  expired: number
  totalAmount: number
  paidAmount: number
}

export interface InvoiceState {
  invoices: InvoiceListItem[]
  stats: InvoiceStats | null
  loading: boolean
  error: string | null
  statusFilter: InvoiceStatus | 'all'
  selectedInvoice: InvoiceListItem | null
}

const initialState: InvoiceState = {
  invoices: [],
  stats: null,
  loading: false,
  error: null,
  statusFilter: 'all',
  selectedInvoice: null,
}

export const invoiceSlice = createSlice({
  name: 'invoice',
  initialState,
  reducers: {
    setInvoices: (state, action: PayloadAction<InvoiceListItem[]>) => {
      state.invoices = action.payload
      state.loading = false
      state.error = null
    },
    addInvoice: (state, action: PayloadAction<InvoiceListItem>) => {
      state.invoices.unshift(action.payload)
    },
    setStats: (state, action: PayloadAction<InvoiceStats | null>) => {
      state.stats = action.payload
    },
    setSelectedInvoice: (state, action: PayloadAction<InvoiceListItem | null>) => {
      state.selectedInvoice = action.payload
    },
    updateInvoiceInList: (state, action: PayloadAction<{ id: string; updates: Partial<InvoiceListItem> }>) => {
      const index = state.invoices.findIndex(i => i.id === action.payload.id)
      if (index !== -1) {
        state.invoices[index] = { ...state.invoices[index], ...action.payload.updates }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      state.loading = false
    },
    setStatusFilter: (state, action: PayloadAction<InvoiceStatus | 'all'>) => {
      state.statusFilter = action.payload
    },
  },
})

export const {
  setInvoices,
  addInvoice,
  setStats,
  setSelectedInvoice,
  updateInvoiceInList,
  setLoading,
  setError,
  setStatusFilter,
} = invoiceSlice.actions

export default invoiceSlice.reducer
