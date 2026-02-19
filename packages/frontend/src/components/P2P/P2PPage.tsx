import { useEffect, useState } from 'react'
import { Box, Tabs, Tab, Paper, Alert, Snackbar, Typography } from '@mui/material'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import {
  setPayments,
  addPayment,
  setLoading,
  setError,
} from '../../store/slices/p2pSlice'
import { addTransaction } from '../../store/slices/transactionsSlice'
import { P2PForm, P2PFormData } from './P2PForm'
import { P2PHistory } from './P2PHistory'
import { apiClient } from '../../utils/api'
import type { P2PPayment } from '../../store/slices/p2pSlice'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
)

export const P2PPage = () => {
  const dispatch = useAppDispatch()
  const { payments, loading, error } = useAppSelector((state) => state.p2p)
  const { accountId, connected } = useAppSelector((state) => state.wallet)
  const [activeTab, setActiveTab] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (connected && accountId) {
      fetchPayments()
    }
  }, [connected, accountId])

  const fetchPayments = async () => {
    if (!accountId) return
    dispatch(setLoading(true))
    try {
      const response = await apiClient.get<P2PPayment[]>(`/p2p/history/${accountId}`)
      if (response.success && response.data) {
        dispatch(setPayments(response.data))
      } else {
        dispatch(setError(response.error || 'Failed to fetch payment history'))
      }
    } catch {
      dispatch(setError('Failed to fetch payment history'))
    }
  }

  const handleSendPayment = async (formData: P2PFormData) => {
    if (!accountId) {
      throw new Error('Wallet not connected')
    }

    dispatch(setLoading(true))
    try {
      const response = await apiClient.post<{
        success: boolean
        txHash?: string
        transaction?: any
        error?: string
      }>('/p2p/send', {
        sender: accountId,
        recipient: formData.recipient,
        amount: formData.amount,
        memo: formData.memo,
      })

      if (response.success && response.data?.txHash) {
        const newPayment: P2PPayment = {
          id: response.data.txHash || `p2p-${Date.now()}`,
          sender: accountId,
          recipient: formData.recipient,
          amount: formData.amount,
          memo: formData.memo,
          status: 'pending',
          txHash: response.data.txHash,
          timestamp: new Date().toISOString(),
        }

        dispatch(addPayment(newPayment))

        // Also add to the global transactions list
        dispatch(addTransaction({
          id: newPayment.id,
          type: 'p2p',
          sender: accountId,
          recipient: formData.recipient,
          amount: formData.amount,
          status: 'pending',
          timestamp: new Date(),
          txHash: response.data.txHash,
          metadata: formData.memo ? { memo: formData.memo } : undefined,
        }))

        setSuccessMessage('P2P payment sent successfully!')
        setActiveTab(1)
      } else {
        throw new Error(response.data?.error || response.error || 'Failed to send payment')
      }
    } catch (err) {
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }

  if (!connected) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Paper elevation={3} sx={{ p: 6, maxWidth: 600, mx: 'auto', borderRadius: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
            💸 Wallet Required
          </Typography>
          <Alert severity="info" sx={{ mt: 3 }}>
            Please connect your Stellar wallet to send P2P payments
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
          onChange={(_e, v) => setActiveTab(v)}
          centered
          sx={{
            bgcolor: 'background.paper',
            '& .MuiTab-root': { fontSize: '1rem', fontWeight: 600, py: 2 },
          }}
        >
          <Tab label="💸 Send Payment" />
          <Tab label="📜 Payment History" />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        <P2PForm onSubmit={handleSendPayment} loading={loading} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <P2PHistory
          payments={payments}
          loading={loading}
          error={error}
          onRefresh={fetchPayments}
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
