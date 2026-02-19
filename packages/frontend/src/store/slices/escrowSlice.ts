import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { EscrowStatus, Condition } from '../../types'

export interface ConditionStatusItem {
  condition: Condition
  met: boolean
  checkedAt: string
  evidence?: string
}

export interface EscrowListItem {
  id: string
  contractId: string
  amount: number
  recipientId?: string
  status: EscrowStatus
  expiresAt: string
  createdAt: string
  releasedAt?: string
  conditionCount: number
}

export interface EscrowDetail {
  id: string
  contractId: string
  amount: number
  recipientId?: string
  conditions: Condition[]
  status: EscrowStatus
  expiresAt: string
  createdAt: string
  releasedAt?: string
  txHash?: string
}

export interface EscrowState {
  escrows: EscrowListItem[]
  selectedEscrow: EscrowDetail | null
  conditionStatuses: ConditionStatusItem[]
  loading: boolean
  error: string | null
  statusFilter: EscrowStatus | 'all'
}

const initialState: EscrowState = {
  escrows: [],
  selectedEscrow: null,
  conditionStatuses: [],
  loading: false,
  error: null,
  statusFilter: 'all',
}

export const escrowSlice = createSlice({
  name: 'escrow',
  initialState,
  reducers: {
    setEscrows: (state, action: PayloadAction<EscrowListItem[]>) => {
      state.escrows = action.payload
      state.loading = false
      state.error = null
    },
    addEscrow: (state, action: PayloadAction<EscrowListItem>) => {
      state.escrows.unshift(action.payload)
    },
    setSelectedEscrow: (state, action: PayloadAction<EscrowDetail | null>) => {
      state.selectedEscrow = action.payload
    },
    setConditionStatuses: (state, action: PayloadAction<ConditionStatusItem[]>) => {
      state.conditionStatuses = action.payload
    },
    updateEscrowInList: (state, action: PayloadAction<{ id: string; updates: Partial<EscrowListItem> }>) => {
      const index = state.escrows.findIndex(e => e.id === action.payload.id)
      if (index !== -1) {
        state.escrows[index] = { ...state.escrows[index], ...action.payload.updates }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      state.loading = false
    },
    setStatusFilter: (state, action: PayloadAction<EscrowStatus | 'all'>) => {
      state.statusFilter = action.payload
    },
  },
})

export const {
  setEscrows,
  addEscrow,
  setSelectedEscrow,
  setConditionStatuses,
  updateEscrowInList,
  setLoading,
  setError,
  setStatusFilter,
} = escrowSlice.actions

export default escrowSlice.reducer
