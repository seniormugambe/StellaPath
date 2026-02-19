import { useState, useEffect } from 'react'
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
import { Transaction, TransactionStatus, TransactionType } from '../../types'
import { TransactionFilters } from './TransactionFilters'

interface TransactionHistoryProps {
  transactions: Transaction[]
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onFilterChange?: (filters: any) => void
}

export const TransactionHistory = ({
  transactions,
  loading = false,
  error = null,
  onRefresh,
  onFilterChange,
}: TransactionHistoryProps) => {
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(transactions)

  useEffect(() => {
    setFilteredTransactions(transactions)
  }, [transactions])

  const getStatusColor = (status: TransactionStatus): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'confirmed':
        return 'success'
      case 'pending':
        return 'warning'
      case 'failed':
        return 'error'
      case 'cancelled':
        return 'default'
      default:
        return 'default'
    }
  }

  const getTypeLabel = (type: TransactionType): string => {
    switch (type) {
      case 'basic':
        return 'Basic'
      case 'p2p':
        return 'P2P'
      case 'escrow':
        return 'Escrow'
      case 'invoice':
        return 'Invoice'
      default:
        return type
    }
  }

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString()
  }

  const formatAmount = (amount: number): string => {
    return amount.toFixed(7)
  }

  const openInExplorer = (txHash: string) => {
    // Open transaction in Stellar explorer
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`
    window.open(explorerUrl, '_blank')
  }

  const handleFilterChange = (filters: any) => {
    let filtered = [...transactions]

    if (filters.type) {
      filtered = filtered.filter((tx) => tx.type === filters.type)
    }

    if (filters.status) {
      filtered = filtered.filter((tx) => tx.status === filters.status)
    }

    if (filters.dateFrom) {
      filtered = filtered.filter((tx) => new Date(tx.timestamp) >= new Date(filters.dateFrom))
    }

    if (filters.dateTo) {
      filtered = filtered.filter((tx) => new Date(tx.timestamp) <= new Date(filters.dateTo))
    }

    setFilteredTransactions(filtered)
    onFilterChange?.(filters)
  }

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              Transaction History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
            </Typography>
          </Box>
          {onRefresh && (
            <Tooltip title="Refresh transactions">
              <IconButton 
                onClick={onRefresh} 
                disabled={loading}
                sx={{ 
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&:disabled': { bgcolor: 'action.disabledBackground' }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <TransactionFilters onFilterChange={handleFilterChange} />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress size={60} />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Loading transactions...
          </Typography>
        </Box>
      )}

      {!loading && filteredTransactions.length === 0 && (
        <Paper elevation={2} sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            📭 No transactions found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {transactions.length === 0 
              ? "You haven't made any transactions yet. Create your first transaction to get started!"
              : "No transactions match your current filters. Try adjusting your search criteria."}
          </Typography>
        </Paper>
      )}

      {!loading && filteredTransactions.length > 0 && (
        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Recipient</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>Amount (XLM)</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>Transaction Hash</TableCell>
                <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTransactions.map((transaction, index) => (
                <TableRow 
                  key={transaction.id} 
                  hover
                  sx={{ 
                    '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                    '&:hover': { bgcolor: 'action.selected' }
                  }}
                >
                  <TableCell>
                    <Chip 
                      label={getTypeLabel(transaction.type)} 
                      size="small" 
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={transaction.recipient} arrow>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {transaction.recipient.substring(0, 10)}...
                        {transaction.recipient.substring(transaction.recipient.length - 10)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {formatAmount(transaction.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.status.toUpperCase()}
                      color={getStatusColor(transaction.status)}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(transaction.timestamp)}</Typography>
                  </TableCell>
                  <TableCell>
                    {transaction.txHash ? (
                      <Tooltip title={transaction.txHash} arrow>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {transaction.txHash.substring(0, 10)}...
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Chip label="Pending" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {transaction.txHash && (
                      <Tooltip title="View in Stellar Explorer" arrow>
                        <IconButton
                          size="small"
                          onClick={() => openInExplorer(transaction.txHash!)}
                          sx={{ 
                            color: 'primary.main',
                            '&:hover': { bgcolor: 'primary.light' }
                          }}
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
