import React, { useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { apiClient } from '../../utils/api';
import { setInvoices, setLoading as setInvoiceLoading, setError as setInvoiceError } from '../../store/slices/invoiceSlice';
import { setEscrows, setLoading as setEscrowLoading, setError as setEscrowError } from '../../store/slices/escrowSlice';
import { setTransactions, setLoading as setTransactionsLoading, setError as setTransactionsError } from '../../store/slices/transactionsSlice';
import {
  TrendingUp,
  AccountBalance,
  SwapHoriz,
  Receipt,
  ArrowForward,
} from '@mui/icons-material';
import type { InvoiceListItem } from '../../store/slices/invoiceSlice';
import type { EscrowListItem } from '../../store/slices/escrowSlice';
import type { Transaction } from '../../store/slices/transactionsSlice';

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Redux selectors
  const invoices = useAppSelector((state) => state.invoice.invoices);
  const invoiceStats = useAppSelector((state) => state.invoice.stats);
  const invoiceLoading = useAppSelector((state) => state.invoice.loading);

  const escrows = useAppSelector((state) => state.escrow.escrows);
  const escrowLoading = useAppSelector((state) => state.escrow.loading);

  const transactions = useAppSelector((state) => state.transactions.transactions);
  const transactionsLoading = useAppSelector((state) => state.transactions.loading);

  const { connected, accountId } = useAppSelector((state) => state.wallet);

  // Fetch functions
  const fetchInvoicesData = async () => {
    dispatch(setInvoiceLoading(true));
    try {
      const response = await apiClient.get<{ invoices: InvoiceListItem[] }>('/invoices');
      if (response.success && response.data) {
        dispatch(setInvoices(response.data.invoices || []));
      } else {
        dispatch(setInvoiceError(response.error || 'Failed to fetch invoices'));
      }
    } catch {
      dispatch(setInvoiceError('Failed to fetch invoices'));
    }
  };

  const fetchEscrowsData = async () => {
    dispatch(setEscrowLoading(true));
    try {
      const response = await apiClient.get<{ escrows: EscrowListItem[] }>('/escrows');
      if (response.success && response.data) {
        dispatch(setEscrows(response.data.escrows || []));
      } else {
        dispatch(setEscrowError(response.error || 'Failed to fetch escrows'));
      }
    } catch {
      dispatch(setEscrowError('Failed to fetch escrows'));
    }
  };

  const fetchTransactionsData = async () => {
    dispatch(setTransactionsLoading(true));
    try {
      const response = await apiClient.get<{ transactions: Transaction[] }>('/transactions');
      if (response.success && response.data) {
        dispatch(setTransactions(response.data.transactions || []));
      } else {
        dispatch(setTransactionsError(response.error || 'Failed to fetch transactions'));
      }
    } catch {
      dispatch(setTransactionsError('Failed to fetch transactions'));
    }
  };

  // Fetch data on mount
  useEffect(() => {
    if (connected && accountId) {
      fetchInvoicesData();
      fetchEscrowsData();
      fetchTransactionsData();
    }
  }, [connected, accountId]);

  // Calculate statistics
  const invoiceCount = invoices.length;
  const escrowCount = escrows.length;
  const transactionCount = transactions.length;

  const totalInvoiceAmount = invoiceStats?.totalAmount || 0;
  const totalEscrowAmount = escrows.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalTransactionAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  const pendingInvoices = invoices.filter(
    (i) => i.status === 'sent' || i.status === 'draft'
  ).length;
  const pendingTransactions = transactions.filter((t) => t.status === 'pending').length;

  const isLoading = invoiceLoading || escrowLoading || transactionsLoading;

  // Get recent items (last 5)
  const recentInvoices = invoices.slice(0, 5);
  const recentEscrows = escrows.slice(0, 5);
  const recentTransactions = transactions.slice(0, 5);

  // Status color mapping
  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
      draft: 'default',
      sent: 'info',
      approved: 'success',
      executed: 'success',
      rejected: 'error',
      expired: 'warning',
      active: 'success',
      conditions_met: 'info',
      released: 'success',
      refunded: 'warning',
      confirmed: 'success',
      pending: 'info',
      failed: 'error',
      cancelled: 'warning',
    };
    return statusColors[status] || 'default';
  };

  // Summary Card Component
  const SummaryCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    count: number;
    amount?: number;
    action?: string;
    onActionClick?: () => void;
  }> = ({ title, icon, count, amount, action, onActionClick }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ mr: 2, color: 'primary.main' }}>{icon}</Box>
          <Typography color="textSecondary" gutterBottom>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div">
          {count}
        </Typography>
        {amount !== undefined && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {amount.toFixed(7)} XLM
          </Typography>
        )}
      </CardContent>
      {action && (
        <CardActions>
          <Button size="small" onClick={onActionClick}>
            {action} <ArrowForward sx={{ ml: 1, fontSize: '1rem' }} />
          </Button>
        </CardActions>
      )}
    </Card>
  );

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Overview of your invoices, escrow contracts, and transactions
        </Typography>
      </Box>

      {/* Summary Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Invoices"
            icon={<Receipt sx={{ fontSize: 40 }} />}
            count={invoiceCount}
            amount={totalInvoiceAmount}
            action="View All"
            onActionClick={() => navigate('/invoices')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Escrow Contracts"
            icon={<AccountBalance sx={{ fontSize: 40 }} />}
            count={escrowCount}
            amount={totalEscrowAmount}
            action="View All"
            onActionClick={() => navigate('/escrow')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Transactions"
            icon={<SwapHoriz sx={{ fontSize: 40 }} />}
            count={transactionCount}
            amount={totalTransactionAmount}
            action="View All"
            onActionClick={() => navigate('/transactions')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Pending"
            icon={<TrendingUp sx={{ fontSize: 40 }} />}
            count={pendingInvoices + pendingTransactions}
          />
        </Grid>
      </Grid>

      {/* Recent Activity Section */}
      <Grid container spacing={3}>
        {/* Recent Invoices */}
        {recentInvoices.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Recent Invoices</Typography>
                <Button size="small" onClick={() => navigate('/invoices')}>
                  View All
                </Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell>Client</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentInvoices.map((invoice) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {invoice.clientEmail}
                        </TableCell>
                        <TableCell align="right">{invoice.totalAmount.toFixed(2)} XLM</TableCell>
                        <TableCell>
                          <Chip
                            label={invoice.status}
                            color={getStatusColor(invoice.status)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}

        {/* Recent Escrows */}
        {recentEscrows.length > 0 && (
          <Grid item xs={12} md={6} lg={4}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Active Escrows</Typography>
                <Button size="small" onClick={() => navigate('/escrow')}>
                  View All
                </Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell>Contract ID</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentEscrows.map((escrow) => (
                      <TableRow key={escrow.id} hover>
                        <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {escrow.contractId}
                        </TableCell>
                        <TableCell align="right">{escrow.amount.toFixed(2)} XLM</TableCell>
                        <TableCell>
                          <Chip
                            label={escrow.status}
                            color={getStatusColor(escrow.status)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <Grid item xs={12} md={12} lg={4}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Recent Transactions</Typography>
                <Button size="small" onClick={() => navigate('/transactions')}>
                  View All
                </Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTransactions.map((transaction) => (
                      <TableRow key={transaction.id} hover>
                        <TableCell sx={{ textTransform: 'capitalize' }}>
                          {transaction.type}
                        </TableCell>
                        <TableCell align="right">{transaction.amount.toFixed(2)} XLM</TableCell>
                        <TableCell>
                          <Chip
                            label={transaction.status}
                            color={getStatusColor(transaction.status)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}

        {/* Empty State */}
        {recentInvoices.length === 0 && recentEscrows.length === 0 && recentTransactions.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="info">
              No activity yet. Start by creating an invoice, escrow contract, or transaction.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default Dashboard;
