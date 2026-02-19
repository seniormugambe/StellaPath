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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Stack,
} from '@mui/material'
import { Lock as LockIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { Condition } from '../../types'

export interface EscrowFormData {
  recipient: string
  amount: number
  conditions: Condition[]
  expiresAt: string
}

interface EscrowFormProps {
  onSubmit: (data: EscrowFormData) => Promise<void>
  loading?: boolean
}

interface ConditionFormItem {
  type: Condition['type']
  parameters: Record<string, any>
  validator: string
}

const defaultCondition = (): ConditionFormItem => ({
  type: 'time_based',
  parameters: {},
  validator: '',
})

export const EscrowForm = ({ onSubmit, loading = false }: EscrowFormProps) => {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [expiresAt, setExpiresAt] = useState('')
  const [conditions, setConditions] = useState<ConditionFormItem[]>([defaultCondition()])
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const getMinExpirationDate = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 30)
    return now.toISOString().slice(0, 16)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!recipient.trim()) {
      errors.recipient = 'Recipient address is required'
    } else if (recipient.length !== 56 || !recipient.startsWith('G')) {
      errors.recipient = 'Invalid Stellar address format (must start with G and be 56 characters)'
    }

    if (amount <= 0) {
      errors.amount = 'Amount must be greater than 0'
    }

    if (!expiresAt) {
      errors.expiresAt = 'Expiration date is required'
    } else if (new Date(expiresAt) <= new Date()) {
      errors.expiresAt = 'Expiration date must be in the future'
    }

    if (conditions.length === 0) {
      errors.conditions = 'At least one condition is required'
    }

    for (let i = 0; i < conditions.length; i++) {
      const c = conditions[i]
      if (c.type === 'time_based' && !c.parameters['targetTime']) {
        errors[`condition_${i}`] = 'Target time is required for time-based conditions'
      }
      if (c.type === 'manual_approval' && !c.parameters['approverAddress']) {
        errors[`condition_${i}`] = 'Approver address is required for manual approval conditions'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    try {
      await onSubmit({
        recipient,
        amount,
        conditions: conditions.map(c => ({
          type: c.type,
          parameters: c.parameters,
          validator: c.validator || c.type,
        })),
        expiresAt,
      })
      // Reset form
      setRecipient('')
      setAmount(0)
      setExpiresAt('')
      setConditions([defaultCondition()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create escrow')
    }
  }

  const addCondition = () => {
    setConditions(prev => [...prev, defaultCondition()])
  }

  const removeCondition = (index: number) => {
    if (conditions.length <= 1) return
    setConditions(prev => prev.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, field: string, value: any) => {
    setConditions(prev => {
      const updated = [...prev]
      if (field === 'type') {
        updated[index] = { ...updated[index], type: value, parameters: {} }
      } else {
        updated[index] = {
          ...updated[index],
          parameters: { ...updated[index].parameters, [field]: value },
        }
      }
      return updated
    })
    // Clear condition validation error
    const errKey = `condition_${index}`
    if (validationErrors[errKey]) {
      setValidationErrors(prev => {
        const next = { ...prev }
        delete next[errKey]
        return next
      })
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
            Create Escrow
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Lock funds in a smart contract with conditions for release
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
            label="Recipient Address"
            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            value={recipient}
            onChange={(e) => { setRecipient(e.target.value); clearFieldError('recipient') }}
            error={!!validationErrors.recipient}
            helperText={validationErrors.recipient || 'Stellar public key of the recipient'}
            disabled={loading}
            sx={{ mb: 3 }}
            inputProps={{ maxLength: 56, style: { fontFamily: 'monospace', fontSize: '0.9rem' } }}
          />

          <TextField
            fullWidth
            label="Amount"
            type="number"
            placeholder="0.00"
            value={amount || ''}
            onChange={(e) => { setAmount(parseFloat(e.target.value) || 0); clearFieldError('amount') }}
            error={!!validationErrors.amount}
            helperText={validationErrors.amount || 'Amount of XLM to lock in escrow'}
            disabled={loading}
            InputProps={{
              startAdornment: <InputAdornment position="start"><strong>XLM</strong></InputAdornment>,
              inputProps: { min: 0, step: 0.0000001 },
            }}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Expiration Date"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => { setExpiresAt(e.target.value); clearFieldError('expiresAt') }}
            error={!!validationErrors.expiresAt}
            helperText={validationErrors.expiresAt || 'Funds are refunded to sender if conditions are not met by this date'}
            disabled={loading}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: getMinExpirationDate() }}
            sx={{ mb: 4 }}
          />

          <Divider sx={{ mb: 3 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Release Conditions
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addCondition}
              disabled={loading}
            >
              Add Condition
            </Button>
          </Box>

          {validationErrors.conditions && (
            <Alert severity="error" sx={{ mb: 2 }}>{validationErrors.conditions}</Alert>
          )}

          <Stack spacing={2} sx={{ mb: 4 }}>
            {conditions.map((condition, index) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2 }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Chip label={`Condition ${index + 1}`} size="small" color="primary" variant="outlined" />
                  {conditions.length > 1 && (
                    <IconButton size="small" onClick={() => removeCondition(index)} disabled={loading}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Condition Type</InputLabel>
                  <Select
                    value={condition.type}
                    label="Condition Type"
                    onChange={(e) => updateCondition(index, 'type', e.target.value)}
                    disabled={loading}
                  >
                    <MenuItem value="time_based">Time-Based</MenuItem>
                    <MenuItem value="manual_approval">Manual Approval</MenuItem>
                    <MenuItem value="oracle_based">Oracle-Based</MenuItem>
                  </Select>
                </FormControl>

                {condition.type === 'time_based' && (
                  <TextField
                    fullWidth
                    size="small"
                    label="Target Time"
                    type="datetime-local"
                    value={condition.parameters['targetTime'] || ''}
                    onChange={(e) => updateCondition(index, 'targetTime', e.target.value)}
                    error={!!validationErrors[`condition_${index}`]}
                    helperText={validationErrors[`condition_${index}`] || 'Condition is met after this time'}
                    disabled={loading}
                    InputLabelProps={{ shrink: true }}
                  />
                )}

                {condition.type === 'manual_approval' && (
                  <TextField
                    fullWidth
                    size="small"
                    label="Approver Address"
                    placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    value={condition.parameters['approverAddress'] || ''}
                    onChange={(e) => updateCondition(index, 'approverAddress', e.target.value)}
                    error={!!validationErrors[`condition_${index}`]}
                    helperText={validationErrors[`condition_${index}`] || 'Stellar address of the approver'}
                    disabled={loading}
                    inputProps={{ maxLength: 56, style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                  />
                )}

                {condition.type === 'oracle_based' && (
                  <TextField
                    fullWidth
                    size="small"
                    label="Oracle Endpoint"
                    placeholder="https://oracle.example.com/api/check"
                    value={condition.parameters['oracleEndpoint'] || ''}
                    onChange={(e) => updateCondition(index, 'oracleEndpoint', e.target.value)}
                    helperText="URL of the oracle service to verify the condition"
                    disabled={loading}
                  />
                )}
              </Paper>
            ))}
          </Stack>

          <Alert severity="info" icon="🔒" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>How escrow works:</strong> Funds are locked in a smart contract. When all conditions are met,
              funds are released to the recipient. If conditions aren't met by the expiration date, funds are
              refunded to you.
            </Typography>
          </Alert>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || !recipient || amount <= 0 || !expiresAt}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LockIcon />}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              boxShadow: 3,
              '&:hover': { boxShadow: 6 },
            }}
          >
            {loading ? 'Creating Escrow...' : 'Create Escrow'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
