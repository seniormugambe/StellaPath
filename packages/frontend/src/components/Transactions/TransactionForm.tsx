import { useState } from 'react'
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  Paper,
  Divider,
} from '@mui/material'
import { Send as SendIcon } from '@mui/icons-material'
import { TransactionType } from '../../types'

interface TransactionFormProps {
  onSubmit: (data: TransactionFormData) => Promise<void>
  loading?: boolean
}

export interface TransactionFormData {
  type: TransactionType
  recipient: string
  amount: number
  memo?: string
}

export const TransactionForm = ({ onSubmit, loading = false }: TransactionFormProps) => {
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'basic',
    recipient: '',
    amount: 0,
    memo: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.recipient.trim()) {
      errors.recipient = 'Recipient address is required'
    } else if (formData.recipient.length !== 56 || !formData.recipient.startsWith('G')) {
      errors.recipient = 'Invalid Stellar address format (must start with G and be 56 characters)'
    }

    if (formData.amount <= 0) {
      errors.amount = 'Amount must be greater than 0'
    } else if (formData.amount < 0.0000001) {
      errors.amount = 'Amount must be at least 0.0000001 XLM'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    try {
      await onSubmit(formData)
      // Reset form on success
      setFormData({
        type: 'basic',
        recipient: '',
        amount: 0,
        memo: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction')
    }
  }

  const handleChange = (field: keyof TransactionFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
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
          background: (theme) => theme.palette.mode === 'light'
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
            Send Payment
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Fill in the details below to send XLM on the Stellar network
          </Typography>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="transaction-type-label">Transaction Type</InputLabel>
            <Select
              labelId="transaction-type-label"
              value={formData.type}
              label="Transaction Type"
              onChange={(e) => handleChange('type', e.target.value as TransactionType)}
              disabled={loading}
            >
              <MenuItem value="basic">
                <Box>
                  <Typography variant="body1" fontWeight={500}>Basic Transaction</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Simple XLM transfer
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="p2p">
                <Box>
                  <Typography variant="body1" fontWeight={500}>Peer-to-Peer Payment</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Direct payment to another user
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="escrow" disabled>
                <Box>
                  <Typography variant="body1" fontWeight={500}>Escrow Transaction</Typography>
                  <Typography variant="caption" color="warning.main">
                    Coming soon
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="invoice" disabled>
                <Box>
                  <Typography variant="body1" fontWeight={500}>Invoice Payment</Typography>
                  <Typography variant="caption" color="warning.main">
                    Coming soon
                  </Typography>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Recipient Address"
            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            value={formData.recipient}
            onChange={(e) => handleChange('recipient', e.target.value)}
            error={!!validationErrors.recipient}
            helperText={validationErrors.recipient || 'Stellar public key starting with G (56 characters)'}
            disabled={loading}
            sx={{ mb: 3 }}
            inputProps={{ 
              maxLength: 56,
              style: { fontFamily: 'monospace', fontSize: '0.9rem' }
            }}
          />

          <TextField
            fullWidth
            label="Amount"
            type="number"
            placeholder="0.00"
            value={formData.amount || ''}
            onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
            error={!!validationErrors.amount}
            helperText={validationErrors.amount || 'Minimum: 0.0000001 XLM (network fee applies)'}
            disabled={loading}
            InputProps={{
              startAdornment: <InputAdornment position="start"><strong>XLM</strong></InputAdornment>,
              inputProps: { min: 0, step: 0.0000001 },
            }}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Memo (Optional)"
            placeholder="Add a note or reference..."
            value={formData.memo}
            onChange={(e) => handleChange('memo', e.target.value)}
            helperText={`Optional message attached to this transaction (${formData.memo?.length || 0}/28 characters)`}
            disabled={loading}
            multiline
            rows={2}
            sx={{ mb: 3 }}
            inputProps={{ maxLength: 28 }}
          />

          <Alert severity="info" icon="💡" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Important:</strong> Always double-check the recipient address. Stellar transactions are irreversible.
            </Typography>
          </Alert>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || !formData.recipient || formData.amount <= 0}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            sx={{ 
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              boxShadow: 3,
              '&:hover': {
                boxShadow: 6,
              }
            }}
          >
            {loading ? 'Processing Transaction...' : 'Send Payment'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
