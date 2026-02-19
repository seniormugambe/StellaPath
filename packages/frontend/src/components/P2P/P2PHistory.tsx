import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material'
import { Refresh as RefreshIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material'
import type { P2PPayment } from '../../store/slices/p2pSlice'

interface P2PHistoryProps {
  payments: P2PPayment[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
}

export const P2PHistory = ({
  payments,
  loading = false,
  error = null,
  onRefresh,
}: P2PHistoryProps) => {
  const getStatusColor = (status: P2PPayment['status']): 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'confirmed':
        return 'success'
      case 'pending':
        return 'warning'
      case 'failed':
        return 'error'
      default:
        return 'warning'
    }
  }

  const formatDate = (date: string): string => new Date(date).toLocaleString()
  const formatAmount = (amount: number): string => amount.toFixed(7)

  const openInExplorer = (txHash: string) => {
    window.open(`https://stellar.expert/explorer/testnet/tx/${txHash}`, '_blank')
  }

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              P2P Payment History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>
          {onRefresh && (
            <Tooltip title="Refresh payments">
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
          )}
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress size={60} />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Loading payments...
          </Typography>
        </Box>
      )}

      {!loading && payments.length === 0 && (
        <Paper elevation={2} sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            📭 No P2P payments yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Send your first peer-to-peer payment to get started.
          </Typography>
        </Paper>
      )}

      {!loading && payments.length > 0 && (
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Recipient</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Amount (XLM)</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Fee (XLM)</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Memo</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => (
                <TableRow
                  key={payment.id}
                  hover
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <TableCell>
                    <Tooltip title={payment.recipient} arrow>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {payment.recipient.substring(0, 10)}...
                        {payment.recipient.substring(payment.recipient.length - 10)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {formatAmount(payment.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {payment.fees ? formatAmount(payment.fees) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={payment.status.toUpperCase()}
                      color={getStatusColor(payment.status)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(payment.timestamp)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {payment.memo || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {payment.txHash && (
                      <Tooltip title="View in Stellar Explorer" arrow>
                        <IconButton
                          size="small"
                          onClick={() => openInExplorer(payment.txHash!)}
                          sx={{ color: 'primary.main', '&:hover': { bgcolor: 'primary.light' } }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
