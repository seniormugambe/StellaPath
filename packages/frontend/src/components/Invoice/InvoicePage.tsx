import { useEffect, useState } from 'react'
import { Box, Tabs, Tab, Paper, Alert, Snackbar, Typography } from '@mui/material'
import type { AlertColor } from '@mui/material'
import { BackButton } from '../Common/BackButton'
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

const normalizeInvoice = (invoice: any): InvoiceListItem => ({
  ...invoice,
  totalAmount: invoice.totalAmount ?? invoice.amount ?? 0,
  status: String(invoice.status).toLowerCase() as InvoiceStatus,
})

interface InvitationDelivery {
  emailStatus: 'sent' | 'failed' | 'skipped'
  error?: string
  approvalUrl?: string
}

interface InvoiceCreateResponse {
  invoice: InvoiceListItem
  invitationDelivery?: InvitationDelivery
}

export const InvoicePage = () => {
  const dispatch = useAppDispatch()
  const { invoices, loading, error, statusFilter } = useAppSelector((state) => state.invoice)
  const { accountId, connected } = useAppSelector((state) => state.wallet)
  const [activeTab, setActiveTab] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [messageSeverity, setMessageSeverity] = useState<AlertColor>('success')

  useEffect(() => {
    if (connected && accountId) {
      fetchInvoices()
    }
  }, [connected, accountId])

  const fetchInvoices = async () => {
    dispatch(setLoading(true))
    try {
      const response = await apiClient.get<{ invoices: InvoiceListItem[] }>('/invoices')
      const invoices = response.data?.invoices ?? (response as typeof response & { invoices?: InvoiceListItem[] }).invoices
      if (response.success && invoices) {
        dispatch(setInvoices((invoices || []).map(normalizeInvoice)))
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
      const response = await apiClient.post<InvoiceCreateResponse>('/invoices', {
        clientEmail: formData.clientEmail,
        description: formData.description,
        dueDate: new Date(formData.dueDate).toISOString(),
        lineItems: formData.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      })

      const invoice = response.data?.invoice ?? (response as typeof response & { invoice?: InvoiceListItem }).invoice
      const invitationDelivery =
        response.data?.invitationDelivery ??
        (response as typeof response & { invitationDelivery?: InvitationDelivery }).invitationDelivery

      if (response.success && invoice) {
        const normalizedInvoice = normalizeInvoice(invoice)
        dispatch(addInvoice({
          id: normalizedInvoice.id,
          clientEmail: normalizedInvoice.clientEmail,
          totalAmount: normalizedInvoice.totalAmount,
          description: normalizedInvoice.description,
          status: normalizedInvoice.status,
          dueDate: normalizedInvoice.dueDate,
          createdAt: normalizedInvoice.createdAt,
          approvalToken: normalizedInvoice.approvalToken,
        }))
        if (invitationDelivery?.emailStatus === 'sent') {
          setMessageSeverity('success')
          setSuccessMessage('Invoice created and invitation email sent.')
        } else {
          const deliveryError = invitationDelivery?.error ? ` ${invitationDelivery.error}` : ''
          setMessageSeverity('warning')
          setSuccessMessage(`Invoice created, but the invitation email was not sent.${deliveryError}`)
        }
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
        status: 'SENT',
      })

      if (response.success) {
        dispatch(updateInvoiceInList({ id: invoiceId, updates: { status: 'sent' as InvoiceStatus } }))
        setMessageSeverity('success')
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
      const response = await apiClient.post<{ invoice: any }>(`/invoices/${invoiceId}/execute`)

      if (response.success) {
        const invoice = response.data?.invoice ?? (response as typeof response & { invoice?: any }).invoice
        dispatch(updateInvoiceInList({
          id: invoiceId,
          updates: {
            status: 'executed' as InvoiceStatus,
            executedAt: invoice?.executedAt || new Date().toISOString(),
            txHash: invoice?.txHash,
          },
        }))
        setMessageSeverity('success')
        setSuccessMessage('Invoice payment executed successfully!')
      } else {
        dispatch(setError(response.error || 'Failed to execute invoice'))
      }
    } catch {
      dispatch(setError('Failed to execute invoice'))
    }
  }

  const persisted = (() => {
    try {
      const raw = localStorage.getItem('walletState')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()

  const hasAuthToken = !!localStorage.getItem('authToken')

  const walletBanner = !connected && !hasAuthToken && !(persisted && persisted.connected) ? (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 800, mx: 'auto', borderRadius: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
          📧 Wallet Recommended
        </Typography>
        <Alert severity="info" sx={{ mt: 1 }}>
          Connect your Stellar wallet to create and manage invoices linked to on-chain payments.
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          You can still browse the invoice UI and prepare invoices before connecting.
        </Typography>
      </Paper>
    </Box>
  ) : null

  return (
    <Box>
      <BackButton />
      {walletBanner}
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
          severity={messageSeverity}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}
