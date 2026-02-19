import { useEffect, useState } from 'react'
import { Box, Tabs, Tab, Paper, Alert, Snackbar, Typography } from '@mui/material'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import {
  setInvoices,
  addInvoice,
  updateInvoiceInList,
  setLoading,
  setError,
  setStatusFilter,
} from '../../store/slices/invoiceSlice'
import { InvoiceForm, InvoiceFormData } from './InvoiceForm'
import { InvoiceDashboard } from './InvoiceDashboard'
import { apiClient } from '../../utils/api'
import type { InvoiceListItem } from '../../store/slices/invoiceSlice'
import type { InvoiceStatus } from '../../types'

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

export const InvoicePage = () => {
  const dispatch = useAppDispatch()
  const { invoices, loading, error, statusFilter } = useAppSelector((state) => state.invoice)
  const { accountId, connected } = useAppSelector((state) => state.wallet)
  const [activeTab, setActiveTab] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (connected && accountId) {
      fetchInvoices()
    }
  }, [connected, accountId])

  const fetchInvoices = async () => {
    dispatch(setLoading(true))
    try {
      const response = await apiClient.get<{ invoices: InvoiceListItem[] }>('/invoices')
      if (response.success && response.data) {
        dispatch(setInvoices(response.data.invoices || []))
      } else {
        dispatch(setError(response.error || 'Failed to fetch invoices'))
      }
    } catch {
      dispatch(setError('Failed to fetch invoices'))
    }
  }

  const handleCreateInvoice = async (formData: InvoiceFormData) => {
    dispatch(setLoading(true))
    try {
      const response = await apiClient.post<{ invoice: InvoiceListItem }>('/invoices', {
        clientEmail: formData.clientEmail,
        amount: formData.amount,
        description: formData.description,
        dueDate: new Date(formData.dueDate).toISOString(),
      })

      if (response.success && response.data?.invoice) {
        const invoice = response.data.invoice
        dispatch(addInvoice({
          id: invoice.id,
          clientEmail: invoice.clientEmail,
          amount: invoice.amount,
          description: invoice.description,
          status: invoice.status,
          dueDate: invoice.dueDate,
          createdAt: invoice.createdAt,
        }))
        setSuccessMessage('Invoice created successfully!')
        setActiveTab(1)
      } else {
        throw new Error(response.error || 'Failed to create invoice')
      }
    } catch (err) {
      throw err
    } finally {
      dispatch(setLoading(false))
    }
  }

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      const response = await apiClient.patch<{ invoice: any }>(`/invoices/${invoiceId}/status`, {
        status: 'sent',
      })

      if (response.success) {
        dispatch(updateInvoiceInList({ id: invoiceId, updates: { status: 'sent' as InvoiceStatus } }))
        setSuccessMessage('Invoice sent to client!')
      } else {
        dispatch(setError(response.error || 'Failed to send invoice'))
      }
    } catch {
      dispatch(setError('Failed to send invoice'))
    }
  }

  const handleExecuteInvoice = async (invoiceId: string) => {
    try {
      const response = await apiClient.post<{ invoice: any }>(`/invoices/${invoiceId}/execute`, {
        txHash: `invoice_exec_${Date.now()}`,
      })

      if (response.success) {
        dispatch(updateInvoiceInList({
          id: invoiceId,
          updates: {
            status: 'executed' as InvoiceStatus,
            executedAt: new Date().toISOString(),
            txHash: response.data?.invoice?.txHash,
          },
        }))
        setSuccessMessage('Invoice payment executed successfully!')
      } else {
        dispatch(setError(response.error || 'Failed to execute invoice'))
      }
    } catch {
      dispatch(setError('Failed to execute invoice'))
    }
  }

  if (!connected) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Paper elevation={3} sx={{ p: 6, maxWidth: 600, mx: 'auto', borderRadius: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
            📧 Wallet Required
          </Typography>
          <Alert severity="info" sx={{ mt: 3 }}>
            Please connect your Stellar wallet to manage invoices
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
          <Tab label="📝 Create Invoice" />
          <Tab label="📊 Invoice Dashboard" />
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        <InvoiceForm onSubmit={handleCreateInvoice} loading={loading} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <InvoiceDashboard
          invoices={invoices}
          loading={loading}
          error={error}
          statusFilter={statusFilter}
          onRefresh={fetchInvoices}
          onFilterChange={(status) => dispatch(setStatusFilter(status))}
          onSendInvoice={handleSendInvoice}
          onExecuteInvoice={handleExecuteInvoice}
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
