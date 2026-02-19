import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material'
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Receipt as ReceiptIcon,
  ArrowBack as BackIcon,
  Person as PersonIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
} from '@mui/icons-material'
import { apiClient } from '../../utils/api'
import type { InvoiceStatus } from '../../types'

interface PublicInvoice {
  id: string
  amount: number
  description: string
  creatorName?: string
  status: InvoiceStatus
  dueDate: string
  createdAt?: string
  clientEmail?: string
}

interface ClientInfo {
  name: string
  email: string
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

const approvalSteps = ['Review Invoice', 'Provide Details', 'Confirm']
const rejectionSteps = ['Review Invoice', 'Provide Reason', 'Confirm']

export const InvoiceReviewPage = () => {
  const { approvalToken } = useParams<{ approvalToken: string }>()
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Client info form
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ name: '', email: '' })
  const [clientInfoErrors, setClientInfoErrors] = useState<{ name?: string; email?: string }>({})

  // Approval dialog with stepper
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [approveStep, setApproveStep] = useState(0)

  // Rejection dialog with stepper
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectStep, setRejectStep] = useState(0)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    if (approvalToken) {
      fetchInvoice()
    }
  }, [approvalToken])

  const fetchInvoice = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<{ invoice: PublicInvoice }>(
        `/invoices/public/${approvalToken}`
      )
      if (response.success && response.data?.invoice) {
        setInvoice(response.data.invoice)
      } else {
        setError(response.error || 'Invoice not found or token is invalid')
      }
    } catch {
      setError('Unable to load invoice. Please check your token and try again.')
    } finally {
      setLoading(false)
    }
  }

  const canRespond =
    invoice && (invoice.status === 'sent' || invoice.status === 'draft') && !isExpired()

  function isExpired(): boolean {
    if (!invoice) return false
    return new Date() > new Date(invoice.dueDate)
  }

  const validateClientEmail = (email: string): boolean => {
    if (!email) return true // optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateClientInfo = (): boolean => {
    const errors: { name?: string; email?: string } = {}
    if (clientInfo.email && !validateClientEmail(clientInfo.email)) {
      errors.email = 'Please enter a valid email address'
    }
    setClientInfoErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleApprove = async () => {
    if (!approvalToken) return
    setActionLoading(true)
    setError(null)
    try {
      const response = await apiClient.post<{ message: string }>('/invoices/approve', {
        approvalToken,
        clientInfo: {
          name: clientInfo.name || undefined,
          email: clientInfo.email || undefined,
        },
      })
      if (response.success) {
        setSuccessMessage('Invoice approved successfully! Payment will be processed shortly.')
        setInvoice((prev) => (prev ? { ...prev, status: 'approved' as InvoiceStatus } : null))
        setApproveDialogOpen(false)
        setApproveStep(0)
      } else {
        setError(response.error || 'Failed to approve invoice')
      }
    } catch {
      setError('Unable to approve invoice. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!approvalToken) return
    setActionLoading(true)
    setError(null)
    try {
      const response = await apiClient.post<{ message: string }>('/invoices/reject', {
        approvalToken,
        reason: rejectionReason || undefined,
        clientInfo: {
          name: clientInfo.name || undefined,
          email: clientInfo.email || undefined,
        },
      })
      if (response.success) {
        setSuccessMessage('Invoice has been declined. The sender has been notified.')
        setInvoice((prev) => (prev ? { ...prev, status: 'rejected' as InvoiceStatus } : null))
        setRejectDialogOpen(false)
        setRejectStep(0)
      } else {
        setError(response.error || 'Failed to reject invoice')
      }
    } catch {
      setError('Unable to reject invoice. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const openApproveDialog = () => {
    setApproveStep(0)
    setClientInfoErrors({})
    setApproveDialogOpen(true)
  }

  const openRejectDialog = () => {
    setRejectStep(0)
    setRejectionReason('')
    setClientInfoErrors({})
    setRejectDialogOpen(true)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12 }}>
        <CircularProgress size={60} />
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          Loading invoice...
        </Typography>
      </Box>
    )
  }

  if (error && !invoice) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 8, px: 3 }}>
        <Paper elevation={3} sx={{ p: 5, textAlign: 'center', borderRadius: 3 }}>
          <ReceiptIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            Invoice Not Found
          </Typography>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => navigate('/client')}
          >
            Back to Portal
          </Button>
        </Paper>
      </Box>
    )
  }

  if (!invoice) return null

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: 6, px: 3 }}>
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate('/client')}
        sx={{ mb: 3 }}
      >
        Back to Portal
      </Button>

      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ReceiptIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
              Invoice
            </Typography>
          </Box>
          <Chip
            label={invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            color={getStatusColor(invoice.status)}
            sx={{ fontWeight: 600, fontSize: '0.9rem' }}
          />
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Invoice Details */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              Amount
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
              {Number(invoice.amount).toFixed(7)} XLM
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              Due Date
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontWeight: 600 }}
              color={isExpired() ? 'error.main' : 'text.primary'}
            >
              {new Date(invoice.dueDate).toLocaleDateString()}
              {isExpired() && ' (Expired)'}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Description
            </Typography>
            <Typography variant="body1">{invoice.description}</Typography>
          </Grid>
          {invoice.creatorName && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                From
              </Typography>
              <Typography variant="body1">{invoice.creatorName}</Typography>
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">
              Invoice ID
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}
            >
              {invoice.id}
            </Typography>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {isExpired() && invoice.status !== 'expired' && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            This invoice has passed its due date and can no longer be approved.
          </Alert>
        )}

        {/* Action Buttons */}
        {canRespond && (
          <>
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RejectIcon />}
                onClick={openRejectDialog}
                disabled={actionLoading}
              >
                Decline
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
                onClick={openApproveDialog}
                disabled={actionLoading}
                sx={{ px: 4 }}
              >
                Approve Invoice
              </Button>
            </Box>
          </>
        )}

        {/* Post-action status messages */}
        {invoice.status === 'approved' && (
          <Alert severity="success" icon={<ThumbUpIcon />} sx={{ mt: 2 }}>
            This invoice has been approved. Payment will be processed by the sender.
          </Alert>
        )}

        {invoice.status === 'rejected' && (
          <Alert severity="error" icon={<ThumbDownIcon />} sx={{ mt: 2 }}>
            This invoice has been declined. The sender has been notified.
          </Alert>
        )}

        {invoice.status === 'executed' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This invoice has been paid.
          </Alert>
        )}
      </Paper>

      {/* Approval Dialog with Stepper */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => !actionLoading && setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Approve Invoice</DialogTitle>
        <DialogContent>
          <Stepper activeStep={approveStep} sx={{ mb: 3, mt: 1 }}>
            {approvalSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {approveStep === 0 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                You are about to approve a payment of{' '}
                <strong>{Number(invoice.amount).toFixed(7)} XLM</strong>
                {invoice.creatorName && <> from <strong>{invoice.creatorName}</strong></>}.
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Description:</strong> {invoice.description}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}

          {approveStep === 1 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonIcon color="action" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Your Information (Optional)
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Providing your details helps the sender identify the approval.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Your Name"
                    value={clientInfo.name}
                    onChange={(e) => setClientInfo((prev) => ({ ...prev, name: e.target.value }))}
                    size="small"
                    placeholder="e.g., John Doe"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Your Email"
                    type="email"
                    value={clientInfo.email}
                    onChange={(e) => {
                      setClientInfo((prev) => ({ ...prev, email: e.target.value }))
                      setClientInfoErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                    size="small"
                    placeholder="e.g., [email]"
                    error={!!clientInfoErrors.email}
                    helperText={clientInfoErrors.email}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {approveStep === 2 && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Please confirm your approval. This action cannot be undone.
              </Alert>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Payment Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {Number(invoice.amount).toFixed(7)} XLM
                </Typography>
                {clientInfo.name && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Approved by: {clientInfo.name}
                    {clientInfo.email && ` (${clientInfo.email})`}
                  </Typography>
                )}
              </Paper>
              <Typography variant="body2" color="text.secondary">
                By confirming, you authorize the invoice creator to process this payment.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (approveStep === 0) {
                setApproveDialogOpen(false)
              } else {
                setApproveStep((s) => s - 1)
              }
            }}
            disabled={actionLoading}
          >
            {approveStep === 0 ? 'Cancel' : 'Back'}
          </Button>
          {approveStep < 2 ? (
            <Button
              variant="contained"
              onClick={() => {
                if (approveStep === 1 && !validateClientInfo()) return
                setApproveStep((s) => s + 1)
              }}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={handleApprove}
              disabled={actionLoading}
              startIcon={
                actionLoading ? <CircularProgress size={20} color="inherit" /> : <ApproveIcon />
              }
            >
              {actionLoading ? 'Processing...' : 'Confirm Approval'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog with Stepper */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => !actionLoading && setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Decline Invoice</DialogTitle>
        <DialogContent>
          <Stepper activeStep={rejectStep} sx={{ mb: 3, mt: 1 }}>
            {rejectionSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {rejectStep === 0 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                You are about to decline an invoice for{' '}
                <strong>{Number(invoice.amount).toFixed(7)} XLM</strong>
                {invoice.creatorName && <> from <strong>{invoice.creatorName}</strong></>}.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                The invoice creator will be notified of your decision.
              </Typography>
            </Box>
          )}

          {rejectStep === 1 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Please provide a reason for declining this invoice. This helps the sender
                understand your decision.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason for declining (optional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Incorrect amount, services not rendered, duplicate invoice..."
              />
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PersonIcon color="action" fontSize="small" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Your Information (Optional)
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Your Name"
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo((prev) => ({ ...prev, name: e.target.value }))}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Your Email"
                      type="email"
                      value={clientInfo.email}
                      onChange={(e) => {
                        setClientInfo((prev) => ({ ...prev, email: e.target.value }))
                        setClientInfoErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                      size="small"
                      error={!!clientInfoErrors.email}
                      helperText={clientInfoErrors.email}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}

          {rejectStep === 2 && (
            <Box>
              <Alert severity="error" sx={{ mb: 2 }}>
                Please confirm you want to decline this invoice. This action cannot be undone.
              </Alert>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Invoice Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {Number(invoice.amount).toFixed(7)} XLM
                </Typography>
                {rejectionReason && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Reason:
                    </Typography>
                    <Typography variant="body2">{rejectionReason}</Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (rejectStep === 0) {
                setRejectDialogOpen(false)
              } else {
                setRejectStep((s) => s - 1)
              }
            }}
            disabled={actionLoading}
          >
            {rejectStep === 0 ? 'Cancel' : 'Back'}
          </Button>
          {rejectStep < 2 ? (
            <Button
              variant="contained"
              onClick={() => {
                if (rejectStep === 1 && !validateClientInfo()) return
                setRejectStep((s) => s + 1)
              }}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              onClick={handleReject}
              disabled={actionLoading}
              startIcon={
                actionLoading ? <CircularProgress size={20} color="inherit" /> : <RejectIcon />
              }
            >
              {actionLoading ? 'Processing...' : 'Confirm Decline'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  )
}
