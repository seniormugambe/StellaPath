import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Receipt as ReceiptIcon, Search as SearchIcon } from '@mui/icons-material'
import { apiClient } from '../../utils/api'

export const InvoiceAccessPage = () => {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) {
      setError('Please enter an approval token')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.post<{
        valid: boolean
        message?: string
        canApprove?: boolean
        isExpired?: boolean
      }>('/invoices/validate-token', { approvalToken: trimmed })

      if (response.success && response.data?.valid) {
        navigate(`/client/invoice/${trimmed}`)
      } else {
        setError(response.data?.message || response.error || 'Invalid or expired token')
      }
    } catch {
      setError('Unable to validate token. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        background: (theme) =>
          theme.palette.mode === 'light'
            ? 'linear-gradient(135deg, #FAF8F6 0%, #F5F1ED 50%, #EBE3DB 100%)'
            : 'linear-gradient(135deg, #1A1614 0%, #252220 50%, #332E2B 100%)',
      }}
    >
      <Paper
        elevation={3}
        sx={{ p: 5, maxWidth: 500, width: '100%', borderRadius: 3, textAlign: 'center' }}
      >
        <ReceiptIcon sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
          Invoice Portal
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Enter your approval token to view and respond to an invoice
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Approval Token"
            value={token}
            onChange={(e) => {
              setToken(e.target.value)
              setError(null)
            }}
            placeholder="Paste your approval token here"
            disabled={loading}
            sx={{ mb: 3 }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={loading || !token.trim()}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            sx={{ py: 1.5, fontSize: '1rem' }}
          >
            {loading ? 'Validating...' : 'View Invoice'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
