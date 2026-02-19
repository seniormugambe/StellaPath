import { useState } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  Paper,
  Divider,
} from '@mui/material'
import { Receipt as ReceiptIcon } from '@mui/icons-material'

export interface InvoiceFormData {
  clientEmail: string
  amount: number
  description: string
  dueDate: string
}

interface InvoiceFormProps {
  onSubmit: (data: InvoiceFormData) => Promise<void>
  loading?: boolean
}

export const InvoiceForm = ({ onSubmit, loading = false }: InvoiceFormProps) => {
  const [clientEmail, setClientEmail] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const getMinDueDate = () => {
    const now = new Date()
    now.setDate(now.getDate() + 1)
    return now.toISOString().slice(0, 10)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!clientEmail.trim()) {
      errors.clientEmail = 'Client email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      errors.clientEmail = 'Invalid email address'
    }

    if (amount <= 0) {
      errors.amount = 'Amount must be greater than 0'
    }

    if (!description.trim()) {
      errors.description = 'Description is required'
    }

    if (!dueDate) {
      errors.dueDate = 'Due date is required'
    } else if (new Date(dueDate) <= new Date()) {
      errors.dueDate = 'Due date must be in the future'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    try {
      await onSubmit({ clientEmail, amount, description, dueDate })
      setClientEmail('')
      setAmount(0)
      setDescription('')
      setDueDate('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    }
  }

  const clearFieldError = (field: string) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          background: (theme) =>
            theme.palette.mode === 'light'
              ? 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)'
              : 'linear-gradient(135deg, rgba(37,34,32,0.95) 0%, rgba(37,34,32,0.85) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            gutterBottom
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #9A8577 0%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Create Invoice
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Send a payment request to your client for approval
          </Typography>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Client Email"
            placeholder="client@example.com"
            type="email"
            value={clientEmail}
            onChange={(e) => { setClientEmail(e.target.value); clearFieldError('clientEmail') }}
            error={!!validationErrors.clientEmail}
            helperText={validationErrors.clientEmail || 'Email address of the client to invoice'}
            disabled={loading}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Amount"
            type="number"
            placeholder="0.00"
            value={amount || ''}
            onChange={(e) => { setAmount(parseFloat(e.target.value) || 0); clearFieldError('amount') }}
            error={!!validationErrors.amount}
            helperText={validationErrors.amount || 'Amount of XLM to request'}
            disabled={loading}
            InputProps={{
              startAdornment: <InputAdornment position="start"><strong>XLM</strong></InputAdornment>,
              inputProps: { min: 0, step: 0.0000001 },
            }}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Description"
            placeholder="Describe the goods or services..."
            multiline
            rows={3}
            value={description}
            onChange={(e) => { setDescription(e.target.value); clearFieldError('description') }}
            error={!!validationErrors.description}
            helperText={validationErrors.description || 'Description of the invoice'}
            disabled={loading}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); clearFieldError('dueDate') }}
            error={!!validationErrors.dueDate}
            helperText={validationErrors.dueDate || 'Invoice expires after this date'}
            disabled={loading}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: getMinDueDate() }}
            sx={{ mb: 4 }}
          />

          <Alert severity="info" icon="📧" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>How invoicing works:</strong> An invoice is created and can be sent to your client.
              The client can approve or reject it. Once approved, you can execute the payment.
            </Typography>
          </Alert>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || !clientEmail || amount <= 0 || !description || !dueDate}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ReceiptIcon />}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              boxShadow: 3,
              '&:hover': { boxShadow: 6 },
            }}
          >
            {loading ? 'Creating Invoice...' : 'Create Invoice'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
