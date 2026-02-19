import { useEffect, useState } from 'react'
import { Box, Tabs, Tab, Paper, Alert, Snackbar, Typography } from '@mui/material'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import {
  setEscrows,
  addEscrow,
  setSelectedEscrow,
  setConditionStatuses,
  updateEscrowInList,
  setLoading,
  setError,
  setStatusFilter,
} from '../../store/slices/escrowSlice'
import { EscrowForm, EscrowFormData } from './EscrowForm'
import { EscrowDashboard } from './EscrowDashboard'
import { apiClient } from '../../utils/api'
import type { EscrowListItem, EscrowDetail, ConditionStatusItem } from '../../store/slices/escrowSlice'
import type { EscrowStatus } from '../../types'

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

export const EscrowPage = () => {
  const dispatch = useAppDispatch()
  const { escrows, selectedEscrow, conditionStatuses, loading, error, statusFilter } = useAppSelector(
    (state) => state.escrow
  )
  const { accountId, connected } = useAppSelector((state) => state.wallet)
  const [activeTab, setActiveTab] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [conditionsLoading, setConditionsLoading] = useState(false)

  useEffect(() => {
    if (connected && accountId) {
      fetchEscrows()
    }
  }, [connected, accountId])

  const fetchEscrows = async () => {
    dispatch(setLoading(true))
    try {
      const response = await apiClient.get<{ escrows: EscrowListItem[] }>('/escrows')
      if (response.success && response.data) {
        dispatch(setEscrows(response.data.escrows || []))
      } else {
        dispatch(setError(response.error || 'Failed to fetch escrows'))
      }
    } catch {
      dispatch(setError('Failed to fetch escrows'))
    }
  }

  const handleCreateEscrow = async (formData: EscrowFormData) => {
    dispatch(setLoading(true))
    try {
      const response = await apiClient.post<{ escrow: any }>('/escrows', {
        recipientId: formData.recipient,
        amount: formData.amount,
        conditions: formData.conditions,
        expiresAt: new Date(formData.expiresAt).toISOString(),
      })

      if (response.success && response.data?.escrow) {
        const escrow = response.data.escrow
        dispatch(
          addEscrow({
            id: escrow.id,
            contractId: escrow.contractId,
            amount: escrow.amount,
            recipientId: escrow.recipientId,
            status: escrow.status,
            expiresAt: escrow.expiresAt,
            createdAt: escrow.createdAt,
            conditionCount: escrow.conditions?.length || formData.conditions.length,
          })
        )
        setSuccessMessage('Escrow created successfully!')
        setActiveTab(1)
      } else {
        throw new Error(response.error || 'Failed to create escrow')
      }
    } catch (err) {
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleViewDetails = async (escrowId: string) => {
    setConditionsLoading(true)
    try {
      const [escrowRes, conditionsRes] = await Promise.all([
        apiClient.get<{ escrow: EscrowDetail }>(`/escrows/${escrowId}`),
        apiClient.get<{ conditions: ConditionStatusItem[]; allConditionsMet: boolean }>(
          `/escrows/${escrowId}/conditions`
        ),
      ])

      if (escrowRes.success && escrowRes.data) {
        dispatch(setSelectedEscrow(escrowRes.data.escrow))
      }
      if (conditionsRes.success && conditionsRes.data) {
        dispatch(setConditionStatuses(conditionsRes.data.conditions || []))
      }
    } catch {
      dispatch(setError('Failed to load escrow details'))
    } finally {
      setConditionsLoading(false)
    }
  }

  const handleRelease = async (escrowId: string) => {
    try {
      const response = await apiClient.post<{ escrow: any }>(`/escrows/${escrowId}/release`, {
        txHash: `release_${Date.now()}`,
      })

      if (response.success) {
        dispatch(updateEscrowInList({ id: escrowId, updates: { status: 'released' as EscrowStatus } }))
        setSuccessMessage('Escrow funds released successfully!')
      } else {
        dispatch(setError(response.error || 'Failed to release escrow'))
      }
    } catch {
      dispatch(setError('Failed to release escrow'))
    }
  }

  const handleRefund = async (escrowId: string) => {
    try {
      const response = await apiClient.post<{ escrow: any }>(`/escrows/${escrowId}/refund`, {
        txHash: `refund_${Date.now()}`,
      })

      if (response.success) {
        dispatch(updateEscrowInList({ id: escrowId, updates: { status: 'refunded' as EscrowStatus } }))
        setSuccessMessage('Escrow funds refunded successfully!')
      } else {
        dispatch(setError(response.error || 'Failed to refund escrow'))
      }
    } catch {
      dispatch(setError('Failed to refund escrow'))
    }
  }

  const handleCloseDetails = () => {
    dispatch(setSelectedEscrow(null))
    dispatch(setConditionStatuses([]))
  }

  if (!connected) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Paper elevation={3} sx={{ p: 6, maxWidth: 600, mx: 'auto', borderRadius: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
            🔐 Wallet Required
          </Typography>
          <Alert severity="info" sx={{ mt: 3 }}>
            Please connect your Stellar wallet to manage escrows
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
          <Tab label="🔒 Create Escrow" />
          <Tab label="📊 Escrow Dashboard" />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        <EscrowForm onSubmit={handleCreateEscrow} loading={loading} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <EscrowDashboard
          escrows={escrows}
          loading={loading}
          error={error}
          statusFilter={statusFilter}
          onRefresh={fetchEscrows}
          onFilterChange={(status) => dispatch(setStatusFilter(status))}
          onViewDetails={handleViewDetails}
          onRelease={handleRelease}
          onRefund={handleRefund}
          selectedEscrow={selectedEscrow}
          conditionStatuses={conditionStatuses}
          conditionsLoading={conditionsLoading}
          onCloseDetails={handleCloseDetails}
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
