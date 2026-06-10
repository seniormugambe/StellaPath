import React, { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  AccountBalance,
  Add,
  ArrowForward,
  Receipt,
  Refresh,
  SwapHoriz,
  Timelapse,
} from '@mui/icons-material';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { apiClient } from '../../utils/api';
import { setInvoices, setLoading as setInvoiceLoading, setError as setInvoiceError } from '../../store/slices/invoiceSlice';
import { setEscrows, setLoading as setEscrowLoading, setError as setEscrowError } from '../../store/slices/escrowSlice';
import { setTransactions, setLoading as setTransactionsLoading, setError as setTransactionsError } from '../../store/slices/transactionsSlice';
import type { InvoiceListItem } from '../../store/slices/invoiceSlice';
import type { EscrowListItem } from '../../store/slices/escrowSlice';
import type { Transaction } from '../../store/slices/transactionsSlice';

type StatusColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const formatXlm = (amount: number, maximumFractionDigits = 2) =>
  `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })} XLM`;

const formatStatus = (status: string) =>
  status.replace(/_/g, ' ');

const shortenAddress = (value?: string | null) => {
  if (!value) return 'Unknown';
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
};

const getStatusColor = (status: string): StatusColor => {
  const statusColors: Record<string, StatusColor> = {
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

interface MetricCardProps {
  title: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

const MetricCard = ({ title, value, helper, icon, onClick }: MetricCardProps) => (
  <Card sx={{ height: '100%', borderRadius: 2 }}>
    <CardActionArea onClick={onClick} disabled={!onClick} sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', p: { xs: 1.75, md: 2.5 } }}>
        <Stack spacing={{ xs: 1.5, md: 2 }} sx={{ height: '100%' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Box
              sx={{
                width: { xs: 36, md: 42 },
                height: { xs: 36, md: 42 },
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: 'secondary.main',
                bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.18)',
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          </Stack>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.05, fontSize: { xs: '1.65rem', md: '2.125rem' } }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: { xs: '0.78rem', md: '0.875rem' } }}>
              {helper}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </CardActionArea>
  </Card>
);

interface QuickActionProps {
  title: string;
  helper: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const QuickAction = ({ title, helper, icon, onClick }: QuickActionProps) => (
  <Card sx={{ height: '100%', borderRadius: 2 }}>
    <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.75, md: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={{ xs: 1.5, md: 2 }}>
          <Box
            sx={{
              width: { xs: 42, md: 48 },
              height: { xs: 42, md: 48 },
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: 'secondary.main',
              bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.18)',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, fontSize: { xs: '1rem', md: '1.25rem' } }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
              {helper}
            </Typography>
          </Box>
          <ArrowForward sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
        </Stack>
      </CardContent>
    </CardActionArea>
  </Card>
);

interface ActivityRow {
  id: string;
  title: string;
  detail: string;
  amount: number;
  status: string;
}

interface ActivityPanelProps {
  title: string;
  actionLabel: string;
  rows: ActivityRow[];
  emptyText: string;
  onViewAll: () => void;
}

const ActivityPanel = ({ title, actionLabel, rows, emptyText, onViewAll }: ActivityPanelProps) => (
  <Card sx={{ height: '100%', borderRadius: 2 }}>
    <CardContent sx={{ p: { xs: 1.75, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          <Button size="small" onClick={onViewAll} endIcon={<ArrowForward sx={{ fontSize: 16 }} />}>
            {actionLabel}
          </Button>
        </Stack>

        {rows.length === 0 ? (
          <Box
            sx={{
              minHeight: 150,
              display: 'grid',
              placeItems: 'center',
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              px: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {emptyText}
            </Typography>
          </Box>
        ) : (
          <>
            <Stack spacing={1.25} sx={{ display: { xs: 'flex', md: 'none' } }}>
              {rows.map((row) => (
                <Box
                  key={row.id}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(250,248,246,0.6)' : 'rgba(26,22,20,0.45)',
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                          {row.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {row.detail}
                        </Typography>
                      </Box>
                      <Chip
                        label={formatStatus(row.status)}
                        color={getStatusColor(row.status)}
                        size="small"
                        variant="outlined"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatXlm(row.amount)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>

            <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ maxWidth: 180 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {row.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {row.detail}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {formatXlm(row.amount)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatStatus(row.status)}
                          color={getStatusColor(row.status)}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Stack>
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const invoices = useAppSelector((state) => state.invoice.invoices);
  const invoiceLoading = useAppSelector((state) => state.invoice.loading);
  const invoiceError = useAppSelector((state) => state.invoice.error);

  const escrows = useAppSelector((state) => state.escrow.escrows);
  const escrowLoading = useAppSelector((state) => state.escrow.loading);
  const escrowError = useAppSelector((state) => state.escrow.error);

  const transactions = useAppSelector((state) => state.transactions.transactions);
  const transactionsLoading = useAppSelector((state) => state.transactions.loading);
  const transactionsError = useAppSelector((state) => state.transactions.error);

  const { connected, accountId } = useAppSelector((state) => state.wallet);

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

  const refreshDashboard = () => {
    if (!connected || !accountId) return;
    void Promise.all([
      fetchInvoicesData(),
      fetchEscrowsData(),
      fetchTransactionsData(),
    ]);
  };

  useEffect(() => {
    refreshDashboard();
  }, [connected, accountId]);

  const isLoading = invoiceLoading || escrowLoading || transactionsLoading;
  const hasLoadedData = invoices.length > 0 || escrows.length > 0 || transactions.length > 0;
  const hasErrors = invoiceError || escrowError || transactionsError;

  const invoiceCount = invoices.length;
  const escrowCount = escrows.length;
  const transactionCount = transactions.length;
  const pendingInvoices = invoices.filter((invoice) => ['draft', 'sent', 'approved'].includes(invoice.status)).length;
  const pendingEscrows = escrows.filter((escrow) => ['active', 'conditions_met'].includes(escrow.status)).length;
  const pendingTransactions = transactions.filter((transaction) => transaction.status === 'pending').length;

  const totalInvoiceAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
  const totalEscrowAmount = escrows.reduce((sum, escrow) => sum + Number(escrow.amount || 0), 0);
  const totalTransactionAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  const recentInvoices: ActivityRow[] = invoices.slice(0, 5).map((invoice) => ({
    id: invoice.id,
    title: invoice.clientEmail,
    detail: invoice.description || 'Invoice',
    amount: invoice.totalAmount,
    status: invoice.status,
  }));

  const recentEscrows: ActivityRow[] = escrows.slice(0, 5).map((escrow) => ({
    id: escrow.id,
    title: shortenAddress(escrow.contractId),
    detail: escrow.recipientId ? `To ${shortenAddress(escrow.recipientId)}` : 'Escrow contract',
    amount: escrow.amount,
    status: escrow.status,
  }));

  const recentTransactions: ActivityRow[] = transactions.slice(0, 5).map((transaction) => ({
    id: transaction.id,
    title: formatStatus(transaction.type),
    detail: `To ${shortenAddress(transaction.recipient)}`,
    amount: transaction.amount,
    status: transaction.status,
  }));

  if (isLoading && !hasLoadedData) {
    return (
      <Container maxWidth="lg" sx={{ py: 6, display: 'grid', placeItems: 'center', minHeight: '55vh' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading dashboard
          </Typography>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.25, md: 4 }, px: { xs: 2, sm: 3 } }}>
      <Stack spacing={{ xs: 2.5, md: 4 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: 0, fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {shortenAddress(accountId)}
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            {isLoading && hasLoadedData && (
              <Chip label="Refreshing" size="small" color="info" variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
            )}
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={refreshDashboard}
              disabled={isLoading}
              fullWidth
              sx={{ width: { sm: 'auto' } }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/transactions')}
              fullWidth
              sx={{ width: { sm: 'auto' } }}
            >
              New payment
            </Button>
          </Stack>
        </Stack>

        {hasErrors && (
          <Alert severity="warning">
            Some dashboard data could not load. Try refresh, or check the backend connection.
          </Alert>
        )}

        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
            Quick actions
          </Typography>
          <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={4}>
              <QuickAction
                title="Send payment"
                helper="Create a Stellar transfer"
                icon={<SwapHoriz />}
                onClick={() => navigate('/transactions')}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <QuickAction
                title="Create invoice"
                helper="Request client payment"
                icon={<Receipt />}
                onClick={() => navigate('/invoices')}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <QuickAction
                title="Start escrow"
                helper="Lock funds by condition"
                icon={<AccountBalance />}
                onClick={() => navigate('/escrow')}
              />
            </Grid>
          </Grid>
        </Box>

        <Grid container spacing={{ xs: 1.5, md: 2 }}>
          <Grid item xs={6} md={3}>
            <MetricCard
              title="Invoices"
              value={invoiceCount}
              helper={formatXlm(totalInvoiceAmount)}
              icon={<Receipt />}
              onClick={() => navigate('/invoices')}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <MetricCard
              title="Escrow"
              value={escrowCount}
              helper={formatXlm(totalEscrowAmount)}
              icon={<AccountBalance />}
              onClick={() => navigate('/escrow')}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <MetricCard
              title="Transactions"
              value={transactionCount}
              helper={formatXlm(totalTransactionAmount)}
              icon={<SwapHoriz />}
              onClick={() => navigate('/transactions')}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <MetricCard
              title="Open items"
              value={pendingInvoices + pendingEscrows + pendingTransactions}
              helper="Needs attention"
              icon={<Timelapse />}
            />
          </Grid>
        </Grid>

        {!hasLoadedData && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={() => navigate('/transactions')}>
                Start
              </Button>
            }
          >
            No activity yet. Start with a payment, invoice, or escrow.
          </Alert>
        )}

        <Grid container spacing={{ xs: 1.5, md: 2 }}>
          <Grid item xs={12} lg={4}>
            <ActivityPanel
              title="Recent invoices"
              actionLabel="Invoices"
              rows={recentInvoices}
              emptyText="No invoices yet"
              onViewAll={() => navigate('/invoices')}
            />
          </Grid>
          <Grid item xs={12} lg={4}>
            <ActivityPanel
              title="Recent escrows"
              actionLabel="Escrow"
              rows={recentEscrows}
              emptyText="No escrow contracts yet"
              onViewAll={() => navigate('/escrow')}
            />
          </Grid>
          <Grid item xs={12} lg={4}>
            <ActivityPanel
              title="Recent transactions"
              actionLabel="Transactions"
              rows={recentTransactions}
              emptyText="No transactions yet"
              onViewAll={() => navigate('/transactions')}
            />
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
};

export default Dashboard;
