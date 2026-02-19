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
  Divider,
  Grid,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  LockOpen as ReleaseIcon,
  Undo as RefundIcon,
} from '@mui/icons-material'
import { EscrowStatus } from '../../types'
import { EscrowListItem, EscrowDetail, ConditionStatusItem } from '../../store/slices/escrowSlice'
import { EscrowConditionStatus } from './EscrowConditionStatus'

interface EscrowDashboardProps {
  escrows: EscrowListItem[]
  loading?: boolean
  error?: string | null
  statusFilter: EscrowStatus | 'all'
  onRefresh: () => void
  onFilterChange: (status: EscrowStatus | 'all') => void
  onViewDetails: (escrowId: string) => void
  onRelease: (escrowId: string) => void
  onRefund: (escrowId: string) => void
  selectedEscrow: EscrowDetail | null
  conditionStatuses: ConditionStatusItem[]
  conditionsLoading?: boolean
  onCloseDetails: () => void
}

const getStatusColor = (status: EscrowStatus): 'success' | 'warning' | 'error' | 'default' | 'info' => {
  switch (status) {
    case 'active': return 'info'
    case 'conditions_met': return 'success'
    case 'released': return 'success'
    case 'refunded': return 'warning'
    case 'expired': return 'error'
    default: return 'default'
  }
}

const getStatusLabel = (status: EscrowStatus): string => {
  switch (status) {
    case 'active': return 'Active'
    case 'conditions_met': return 'Conditions Met'
    case 'released': return 'Released'
    case 'refunded': return 'Refunded'
    case 'expired': return 'Expired'
    default: return status
  }
}

export const EscrowDashboard = ({
  escrows,
  loading = false,
  error = null,
  statusFilter,
  onRefresh,
  onFilterChange,
  onViewDetails,
  onRelease,
  onRefund,
  selectedEscrow,
  conditionStatuses,
  conditionsLoading = false,
  onCloseDetails,
}: EscrowDashboardProps) => {
  const filteredEscrows = statusFilter === 'all'
    ? escrows
    : escrows.filter(e => e.status === statusFilter)

  const isExpired = (expiresAt: string) => new Date() > new Date(expiresAt)

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              Escrow Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredEscrows.length} escrow{filteredEscrows.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => onFilterChange(e.target.value as EscrowStatus | 'all')}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="conditions_met">Conditions Met</MenuItem>
                <MenuItem value="released">Released</MenuItem>
                <MenuItem value="refunded">Refunded</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh escrows">
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

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress size={60} />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Loading escrows...
          </Typography>
        </Box>
      )}

      {!loading && filteredEscrows.length === 0 && (
        <Paper elevation={2} sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            🔒 No escrows found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {escrows.length === 0
              ? "You haven't created any escrows yet. Create your first escrow to get started!"
              : 'No escrows match your current filter. Try a different status.'}
          </Typography>
        </Paper>
      )}

      {!loading && filteredEscrows.length > 0 && (
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Contract ID</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Amount (XLM)</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Conditions</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Expires</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Created</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEscrows.map((escrow) => (
                <TableRow
                  key={escrow.id}
                  hover
                  sx={{
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <TableCell>
                    <Tooltip title={escrow.contractId} arrow>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {escrow.contractId.substring(0, 16)}...
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {Number(escrow.amount).toFixed(7)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(escrow.status)}
                      color={getStatusColor(escrow.status)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{escrow.conditionCount} condition{escrow.conditionCount !== 1 ? 's' : ''}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color={isExpired(escrow.expiresAt) ? 'error.main' : 'text.primary'}
                    >
                      {new Date(escrow.expiresAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{new Date(escrow.createdAt).toLocaleDateString()}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                      <Tooltip title="View Details" arrow>
                        <IconButton size="small" onClick={() => onViewDetails(escrow.id)} color="primary">
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {escrow.status === 'active' && (
                        <>
                          <Tooltip title="Release Funds" arrow>
                            <IconButton size="small" onClick={() => onRelease(escrow.id)} color="success">
                              <ReleaseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {isExpired(escrow.expiresAt) && (
                            <Tooltip title="Refund" arrow>
                              <IconButton size="small" onClick={() => onRefund(escrow.id)} color="warning">
                                <RefundIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Escrow Detail Dialog */}
      <Dialog
        open={!!selectedEscrow}
        onClose={onCloseDetails}
        maxWidth="sm"
        fullWidth
      >
        {selectedEscrow && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>
              Escrow Details
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Contract ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                    {selectedEscrow.contractId}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box>
                    <Chip
                      label={getStatusLabel(selectedEscrow.status)}
                      color={getStatusColor(selectedEscrow.status)}
                      size="small"
                    />
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {Number(selectedEscrow.amount).toFixed(7)} XLM
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Expires</Typography>
                  <Typography variant="body2">
                    {new Date(selectedEscrow.expiresAt).toLocaleString()}
                  </Typography>
                </Grid>
                {selectedEscrow.recipientId && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Recipient</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                      {selectedEscrow.recipientId}
                    </Typography>
                  </Grid>
                )}
                {selectedEscrow.txHash && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Transaction Hash</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                      {selectedEscrow.txHash}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              <Divider sx={{ mb: 2 }} />

              <EscrowConditionStatus
                conditions={conditionStatuses}
                loading={conditionsLoading}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={onCloseDetails}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
