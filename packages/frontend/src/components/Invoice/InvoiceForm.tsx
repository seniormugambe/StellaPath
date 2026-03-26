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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
} from '@mui/material'
import { Receipt as ReceiptIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'

export interface InvoiceLineItem {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface InvoiceFormData {
  clientEmail: string
  description: string
  dueDate: string
  lineItems: InvoiceLineItem[]
}

interface InvoiceFormProps {
  onSubmit: (data: InvoiceFormData) => Promise<void>
  loading?: boolean
}

export const InvoiceForm = ({ onSubmit, loading = false }: InvoiceFormProps) => {
  const [clientEmail, setClientEmail] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Line item dialog state
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InvoiceLineItem | null>(null)
  const [itemDescription, setItemDescription] = useState('')
  const [itemQuantity, setItemQuantity] = useState<number>(1)
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0)

  const getMinDueDate = () => {
    const now = new Date()
    now.setDate(now.getDate() + 1)
    return now.toISOString().slice(0, 10)
  }

  const calculateTotal = (items: InvoiceLineItem[]) => {
    return items.reduce((sum, item) => sum + item.total, 0)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!clientEmail.trim()) {
      errors.clientEmail = 'Client email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      errors.clientEmail = 'Invalid email address'
    }

    if (!description.trim()) {
      errors.description = 'Description is required'
    }

    if (!dueDate) {
      errors.dueDate = 'Due date is required'
    } else if (new Date(dueDate) <= new Date()) {
      errors.dueDate = 'Due date must be in the future'
    }

    if (lineItems.length === 0) {
      errors.lineItems = 'At least one line item is required'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    try {
      await onSubmit({ clientEmail, description, dueDate, lineItems })
      setClientEmail('')
      setDescription('')
      setDueDate('')
      setLineItems([])
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

  // Line item management functions
  const handleAddLineItem = () => {
    setEditingItem(null)
    setItemDescription('')
    setItemQuantity(1)
    setItemUnitPrice(0)
    setLineItemDialogOpen(true)
  }

  const handleEditLineItem = (item: InvoiceLineItem) => {
    setEditingItem(item)
    setItemDescription(item.description)
    setItemQuantity(item.quantity)
    setItemUnitPrice(item.unitPrice)
    setLineItemDialogOpen(true)
  }

  const handleDeleteLineItem = (itemId: string) => {
    setLineItems(prev => prev.filter(item => item.id !== itemId))
  }

  const handleSaveLineItem = () => {
    const total = itemQuantity * itemUnitPrice
    const newItem: InvoiceLineItem = {
      id: editingItem?.id || `temp-${Date.now()}`,
      description: itemDescription,
      quantity: itemQuantity,
      unitPrice: itemUnitPrice,
      total
    }

    if (editingItem) {
      setLineItems(prev => prev.map(item =>
        item.id === editingItem.id ? newItem : item
      ))
    } else {
      setLineItems(prev => [...prev, newItem])
    }

    setLineItemDialogOpen(false)
  }

  const handleCancelLineItem = () => {
    setLineItemDialogOpen(false)
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
            label="Invoice Description"
            placeholder="Describe the overall invoice..."
            multiline
            rows={2}
            value={description}
            onChange={(e) => { setDescription(e.target.value); clearFieldError('description') }}
            error={!!validationErrors.description}
            helperText={validationErrors.description || 'Brief description of the invoice'}
            disabled={loading}
            sx={{ mb: 3 }}
          />

          {/* Line Items Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Line Items
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddLineItem}
                disabled={loading}
                size="small"
              >
                Add Item
              </Button>
            </Box>

            {lineItems.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell align="right"><strong>Qty</strong></TableCell>
                      <TableCell align="right"><strong>Unit Price</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                      <TableCell align="center"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{item.unitPrice.toFixed(7)} XLM</TableCell>
                        <TableCell align="right">{item.total.toFixed(7)} XLM</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleEditLineItem(item)}
                            disabled={loading}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteLineItem(item.id!)}
                            disabled={loading}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} align="right" sx={{ fontWeight: 600 }}>
                        Total Amount:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {calculateTotal(lineItems).toFixed(7)} XLM
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box
                sx={{
                  p: 4,
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  color: 'text.secondary'
                }}
              >
                <Typography variant="body2" sx={{ mb: 1 }}>
                  No line items added yet
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddLineItem}
                  disabled={loading}
                >
                  Add Your First Item
                </Button>
              </Box>
            )}

            {validationErrors.lineItems && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {validationErrors.lineItems}
              </Typography>
            )}
          </Box>

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
            disabled={loading || lineItems.length === 0}
            sx={{
              mt: 2,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #9A8577 0%, #D4AF37 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #8A7767 0%, #C49F27 100%)',
              },
              '&:disabled': {
                background: 'rgba(154, 133, 119, 0.3)',
              }
            }}
          >
            {loading ? <CircularProgress size={24} /> : (
              <>
                <ReceiptIcon sx={{ mr: 1 }} />
                Create Invoice ({calculateTotal(lineItems).toFixed(7)} XLM)
              </>
            )}
          </Button>
        </Box>
      </Paper>

      {/* Line Item Dialog */}
      <Dialog open={lineItemDialogOpen} onClose={handleCancelLineItem} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingItem ? 'Edit Line Item' : 'Add Line Item'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Description"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
            placeholder="What are you charging for?"
          />
          <TextField
            fullWidth
            label="Quantity"
            type="number"
            value={itemQuantity}
            onChange={(e) => setItemQuantity(parseFloat(e.target.value) || 1)}
            inputProps={{ min: 0.01, step: 0.01 }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Unit Price (XLM)"
            type="number"
            value={itemUnitPrice}
            onChange={(e) => setItemUnitPrice(parseFloat(e.target.value) || 0)}
            inputProps={{ min: 0, step: 0.0000001 }}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            Total: {(itemQuantity * itemUnitPrice).toFixed(7)} XLM
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLineItem}>Cancel</Button>
          <Button
            onClick={handleSaveLineItem}
            variant="contained"
            disabled={!itemDescription.trim() || itemQuantity <= 0 || itemUnitPrice < 0}
          >
            {editingItem ? 'Update' : 'Add'} Item
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
