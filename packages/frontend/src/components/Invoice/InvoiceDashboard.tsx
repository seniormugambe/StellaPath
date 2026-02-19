import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Divider,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Send as SendIcon,
  PlayArrow as ExecuteIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
import { InvoiceStatus } from '../../types'
import { InvoiceListItem } from '../../store/slices/invoiceSlice'
import { CLIENT_PORTAL_URL } from '../../constants'
import { useState } from 'react'

interface InvoiceDashboardProps {
  invoices: InvoiceListItem[]
  loading?: boolean
  error?: string | null
  statusFilter: InvoiceStatus | 'all'
  onRefresh: () => void
  onFilterChange: (status: InvoiceStatus | 'all') => void
  onSendInvoice: (invoiceId: string) => void
  onExecuteInvoice: (invoiceId: string) => void
}

const getStatusColor = (status: InvoiceStatus): 'success' | 'warning' | 'error' | 'default' | 'info' | 'primary' => {
  switch (status) {
    case 'draft': return 'default'
    case 'sent': return 'info'
    case 'approved': return 'success'
    case 'executed': return 'primary'
    case 'rejected': return 'error'
    case 'expired': return 'warning'
    default: return 'default'
  }
}

const getStatusLabel = (status: InvoiceStatus): string => {
  switch (status) {
    case 'draft': return 'Draft'
    case 'sent': return 'Sent'
    case 'approved': return 'Approved'
    case 'executed': return 'Executed'
    case 'rejected': return 'Rejected'
    case 'expired': return 'Expired'
    default: return status
  }
}

export const InvoiceDashboard = ({
  invoices,
  loading = false,
  error = null,
  statusFilter,
  onRefresh,
  onFilterChange,
  onSendInvoice,
  onExecuteInvoice,
}: InvoiceDashboardProps) => {
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceListItem | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const filteredInvoices = statusFilter === 'all'
    ? invoices
    : invoices.filter(i => i.status === statusFilter)

  const isExpired = (dueDate: string) => new Date() > new Date(dueDate)

  const handleCopyApprovalLink = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId)
    if (!inv) return
    // In a real app, the approval token would be used here
    const link = `${CLIENT_PORTAL_URL}/invoice/${invoiceId}`
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              Invoice Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => onFilterChange(e.target.value as InvoiceStatus | 'all')}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="sent">Sent</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="executed">Executed</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh invoices">
              <IconButton
                onClick={onRefresh}
                disabled={loading}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&:disabled': { bgcolor: 'action.disabledBackground' },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {copySuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>Approval link copied to clipboard</Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress size={60} />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Loading invoices...
          </Typography>
        </Box>
      )}

      {!loading && filteredInvoices.length === 0 && (
        <Paper elevation={2} sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            📧 No invoices found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {invoices.length === 0
              ? "You haven't created any invoices yet. Create your first invoice to get started!"
              : 'No invoices match your current filter. Try a different status.'}
          </Typography>
        </Paper>
      )}

      {!loading && filteredInvoices.length > 0 && (
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Client</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Amount (XLM)</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Due Date</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Created</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  hover
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <TableCell>
                    <Typography variant="body2">{invoice.clientEmail}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {Number(invoice.amount).toFixed(7)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={invoice.description} arrow>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {invoice.description}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(invoice.status)}
                      color={getStatusColor(invoice.status)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={isExpired(invoice.dueDate) ? 'error.main' : 'text.primary'}
                    >
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{new Date(invoice.createdAt).toLocaleDateString()}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                      <Tooltip title="View Details" arrow>
                        <IconButton size="small" onClick={() => setSelectedInvoice(invoice)} color="primary">
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {invoice.status === 'draft' && (
                        <Tooltip title="Send to Client" arrow>
                          <IconButton size="small" onClick={() => onSendInvoice(invoice.id)} color="info">
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(invoice.status === 'draft' || invoice.status === 'sent') && (
                        <Tooltip title="Copy Approval Link" arrow>
                          <IconButton size="small" onClick={() => handleCopyApprovalLink(invoice.id)} color="secondary">
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {invoice.status === 'approved' && (
                        <Tooltip title="Execute Payment" arrow>
                          <IconButton size="small" onClick={() => onExecuteInvoice(invoice.id)} color="success">
                            <ExecuteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedInvoice && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>
              Invoice Details
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Invoice ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                    {selectedInvoice.id}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box>
                    <Chip
                      label={getStatusLabel(selectedInvoice.status)}
                      color={getStatusColor(selectedInvoice.status)}
                      size="small"
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {Number(selectedInvoice.amount).toFixed(7)} XLM
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Due Date</Typography>
                  <Typography variant="body2">
                    {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Client Email</Typography>
                  <Typography variant="body2">{selectedInvoice.clientEmail}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Description</Typography>
                  <Typography variant="body2">{selectedInvoice.description}</Typography>
                </Grid>
                {selectedInvoice.approvedAt && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Approved At</Typography>
                    <Typography variant="body2">
                      {new Date(selectedInvoice.approvedAt).toLocaleString()}
                    </Typography>
                  </Grid>
                )}
                {selectedInvoice.executedAt && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Executed At</Typography>
                    <Typography variant="body2">
                      {new Date(selectedInvoice.executedAt).toLocaleString()}
                    </Typography>
                  </Grid>
                )}
                {selectedInvoice.txHash && (
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">Transaction Hash</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                      {selectedInvoice.txHash}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              {selectedInvoice.status === 'draft' && (
                <Button
                  onClick={() => { onSendInvoice(selectedInvoice.id); setSelectedInvoice(null) }}
                  color="info"
                  startIcon={<SendIcon />}
                >
                  Send to Client
                </Button>
              )}
              {selectedInvoice.status === 'approved' && (
                <Button
                  onClick={() => { onExecuteInvoice(selectedInvoice.id); setSelectedInvoice(null) }}
                  color="success"
                  startIcon={<ExecuteIcon />}
                >
                  Execute Payment
                </Button>
              )}
              <Button onClick={() => setSelectedInvoice(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
