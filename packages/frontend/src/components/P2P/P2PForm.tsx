import { useState, useEffect, useCallback } from 'react'
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
  Chip,
} from '@mui/material'
import {
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import {
  setFeeEstimate,
  setFeeLoading,
  setRecipientValid,
  setRecipientChecking,
} from '../../store/slices/p2pSlice'
import { apiClient } from '../../utils/api'
import type { FeeEstimate } from '../../store/slices/p2pSlice'

export interface P2PFormData {
  recipient: string
  amount: number
  memo?: string
}

interface P2PFormProps {
  onSubmit: (data: P2PFormData) => Promise<void>
  loading?: boolean
}

export const P2PForm = ({ onSubmit, loading = false }: P2PFormProps) => {
  const dispatch = useAppDispatch()
  const { feeEstimate, feeLoading, recipientValid, recipientChecking } = useAppSelector(
    (state) => state.p2p
  )

  const [formData, setFormData] = useState<P2PFormData>({
    recipient: '',
    amount: 0,
    memo: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Debounced recipient validation
  useEffect(() => {
    if (formData.recipient.length === 56 && formData.recipient.startsWith('G')) {
      const timer = setTimeout(() => validateRecipient(formData.recipient), 500)
      return () => clearTimeout(timer)
    } else {
      dispatch(setRecipientValid(null))
    }
  }, [formData.recipient])

  // Debounced fee estimation
  useEffect(() => {
    if (formData.amount > 0) {
      const timer = setTimeout(() => fetchFeeEstimate(formData.amount), 500)
      return () => clearTimeout(timer)
    } else {
      dispatch(setFeeEstimate(null))
    }
  }, [formData.amount])

  const validateRecipient = async (address: string) => {
    dispatch(setRecipientChecking(true))
    try {
      const response = await apiClient.get<{ valid: boolean; exists: boolean; error?: string }>(
        `/p2p/validate/${address}`
      )
      if (response.success && response.data) {
        dispatch(setRecipientValid(response.data.valid))
        if (!response.data.valid && response.data.error) {
          setValidationErrors(prev => ({ ...prev, recipient: response.data!.error! }))
        } else {
          setValidationErrors(prev => {
            const next = { ...prev }
            delete next.recipient
            return next
          })
        }
      } else {
        dispatch(setRecipientValid(null))
      }
    } catch {
      dispatch(setRecipientValid(null))
    }
  }

  const fetchFeeEstimate = async (amount: number) => {
    dispatch(setFeeLoading(true))
    try {
      const response = await apiClient.get<FeeEstimate>(`/p2p/fees?amount=${amount}`)
      if (response.success && response.data) {
        dispatch(setFeeEstimate(response.data))
      }
    } catch {
      dispatch(setFeeEstimate(null))
    }
  }

  const validateForm = useCallback((): boolean => {
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
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    try {
      await onSubmit(formData)
      setFormData({ recipient: '', amount: 0, memo: '' })
      dispatch(setFeeEstimate(null))
      dispatch(setRecipientValid(null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send payment')
    }
  }

  const handleChange = (field: keyof P2PFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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
            Send P2P Payment
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Send XLM directly to another Stellar account with minimal fees
          </Typography>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ position: 'relative', mb: 3 }}>
            <TextField
              fullWidth
              label="Recipient Address"
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={formData.recipient}
              onChange={(e) => handleChange('recipient', e.target.value)}
              error={!!validationErrors.recipient}
              helperText={validationErrors.recipient || 'Stellar public key starting with G (56 characters)'}
              disabled={loading}
              inputProps={{
                maxLength: 56,
                style: { fontFamily: 'monospace', fontSize: '0.9rem' },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {recipientChecking && <CircularProgress size={20} />}
                    {!recipientChecking && recipientValid === true && (
                      <CheckCircleIcon color="success" />
                    )}
                    {!recipientChecking && recipientValid === false && (
                      <ErrorIcon color="error" />
                    )}
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <TextField
            fullWidth
            label="Amount"
            type="number"
            placeholder="0.00"
            value={formData.amount || ''}
            onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
            error={!!validationErrors.amount}
            helperText={validationErrors.amount || 'Minimum: 0.0000001 XLM'}
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <strong>XLM</strong>
                </InputAdornment>
              ),
              inputProps: { min: 0, step: 0.0000001 },
            }}
            sx={{ mb: 3 }}
          />

          {/* Fee estimation display */}
          {(feeEstimate || feeLoading) && (
            <Paper
              variant="outlined"
              sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'action.hover' }}
            >
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Fee Estimate
              </Typography>
              {feeLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Calculating fees...
                  </Typography>
                </Box>
              ) : feeEstimate ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label={`Network Fee: ${feeEstimate.estimatedFee.toFixed(7)} XLM`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`Total Cost: ${feeEstimate.totalCost.toFixed(7)} XLM`}
                    size="small"
                    color="primary"
                  />
                </Box>
              ) : null}
            </Paper>
          )}

          <TextField
            fullWidth
            label="Memo (Optional)"
            placeholder="Add a note or reference..."
            value={formData.memo}
            onChange={(e) => handleChange('memo', e.target.value)}
            helperText={`Optional message (${formData.memo?.length || 0}/28 characters)`}
            disabled={loading}
            multiline
            rows={2}
            sx={{ mb: 3 }}
            inputProps={{ maxLength: 28 }}
          />

          <Alert severity="info" icon="💡" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>P2P payments</strong> are direct transfers on the Stellar network. They are fast,
              low-cost, and irreversible. Double-check the recipient address before sending.
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
              '&:hover': { boxShadow: 6 },
            }}
          >
            {loading ? 'Sending Payment...' : 'Send P2P Payment'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
