import { configureStore } from '@reduxjs/toolkit'
import walletReducer from './slices/walletSlice'
import transactionsReducer from './slices/transactionsSlice'
import escrowReducer from './slices/escrowSlice'
import invoiceReducer from './slices/invoiceSlice'
import p2pReducer from './slices/p2pSlice'

export const store = configureStore({
  reducer: {
    wallet: walletReducer,
    transactions: transactionsReducer,
    escrow: escrowReducer,
    invoice: invoiceReducer,
    p2p: p2pReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for date serialization
        ignoredActions: ['transactions/setTransactions', 'transactions/addTransaction'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.timestamp', 'payload.dateFrom', 'payload.dateTo'],
        // Ignore these paths in the state
        ignoredPaths: ['transactions.transactions', 'transactions.filters'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch