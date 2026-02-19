import { useEffect, useState } from 'react'
import { Box, Tabs, Tab, Paper, Alert, Snackbar, Typography } from '@mui/material'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import {
  setTransactions,
  addTransaction,
  updateTransaction,
  setLoading,
  setError,
  setFilters,
} from '../../store/slices/transactionsSlice'
import { TransactionForm, TransactionFormData } from './TransactionForm'
import { TransactionHistory } from './TransactionHistory'
import { apiClient } from '../../utils/api'
import { Transaction, TransactionResult } from '../../types'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel = ({ children, value, index }: TabPanelProps) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export const TransactionsPage = () => {
  const dispatch = useAppDispatch()
  const { transactions, loading, error } = useAppSelector((state) => state.transactions)
  const { accountId, connected } = useAppSelector((state) => state.wallet)
  const [activeTab, setActiveTab] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch transactions on mount and when wallet changes
  useEffect(() => {
    if (connected && accountId) {
      fetchTransactions()
      // Set up real-time status updates
      const interval = setInterval(() => {
        updateTransactionStatuses()
      }, 10000) // Check every 10 seconds

      return () => {
        if (interval) clearInterval(interval)
      }
    }
  }, [connected, accountId])

  const fetchTransactions = async () => {
    if (!accountId) return

    dispatch(setLoading(true))
    try {
      const response = await apiClient.get<Transaction[]>(`/transactions/${accountId}`)
      if (response.success && response.data) {
        dispatch(setTransactions(response.data))
      } else {
        dispatch(setError(response.error || 'Failed to fetch transactions'))
      }
    } catch (err) {
      dispatch(setError('Failed to fetch transactions'))
    }
  }

  const updateTransactionStatuses = async () => {
    // Update status for pending transactions
    const pendingTransactions = transactions.filter((tx) => tx.status === 'pending')
    
    for (const tx of pendingTransactions) {
      if (tx.txHash) {
        try {
          const response = await apiClient.get<Transaction>(`/transactions/status/${tx.txHash}`)
          if (response.success && response.data) {
            dispatch(updateTransaction({ id: tx.id, updates: { status: response.data.status } }))
          }
        } catch (err) {
          // Silently fail for status updates
          console.error('Failed to update transaction status:', err)
        }
      }
    }
  }

  const handleCreateTransaction = async (formData: TransactionFormData) => {
    if (!accountId) {
      throw new Error('Wallet not connected')
    }

    dispatch(setLoading(true))
    try {
      const response = await apiClient.post<TransactionResult>('/transactions/create', {
        ...formData,
        sender: accountId,
      })

      if (response.success && response.data) {
        // Create a new transaction object
        const newTransaction: Transaction = {
          id: response.data.txHash || `temp-${Date.now()}`,
          type: formData.type,
          sender: accountId,
          recipient: formData.recipient,
          amount: formData.amount,
          status: 'pending',
          timestamp: new Date(),
          txHash: response.data.txHash,
          metadata: formData.memo ? { memo: formData.memo } : undefined,
        }

        dispatch(addTransaction(newTransaction))
        setSuccessMessage('Transaction created successfully!')
        setActiveTab(1) // Switch to history tab
      } else {
        throw new Error(response.error || 'Failed to create transaction')
      }
    } catch (err) {
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleRefresh = () => {
    fetchTransactions()
  }

  const handleFilterChange = (newFilters: any) => {
    dispatch(setFilters(newFilters))
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  if (!connected) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Paper elevation={3} sx={{ p: 6, maxWidth: 600, mx: 'auto', borderRadius: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
            🔐 Wallet Required
          </Typography>
          <Alert severity="info" sx={{ mt: 3 }}>
            Please connect your Stellar wallet to view and create transactions
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Use the "Connect Wallet" button in the top right corner to get started
          </Typography>
        </Paper>
      </Box>
    )
  }

  return (
    <Box>
      <Paper elevation={3} sx={{ mb: 4, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          centered
          sx={{
            bgcolor: 'background.paper',
            '& .MuiTab-root': {
              fontSize: '1rem',
              fontWeight: 600,
              py: 2,
            }
          }}
        >
          <Tab label="📤 Create Transaction" />
          <Tab label="📜 Transaction History" />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        <TransactionForm onSubmit={handleCreateTransaction} loading={loading} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <TransactionHistory
          transactions={transactions}
          loading={loading}
          error={error}
          onRefresh={handleRefresh}
          onFilterChange={handleFilterChange}
        />
      </TabPanel>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSuccessMessage(null)} 
          severity="success" 
          sx={{ width: '100%' }}
          variant="filled"
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}
