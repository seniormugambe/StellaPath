/**
 * X402 Payment History Component
 * Displays user's x402 payment history
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Link
} from '@mui/material';
import { getX402History } from '../../utils/x402Api';

export const X402History: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getX402History();
      if (response.success && response.data?.payments) {
        setPayments(response.data.payments as any[]);
      } else {
        setError(response.error || 'Failed to load payment history');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (payments.length === 0) {
    return (
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No x402 payments yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Your x402 payment history will appear here
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3}>
      <Box p={2}>
        <Typography variant="h6" gutterBottom>
          X402 Payment History
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Your recent x402 protocol payments
        </Typography>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Resource</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Transaction</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((payment) => {
              const metadata = payment.metadata as any;
              return (
                <TableRow key={payment.id}>
                  <TableCell>
                    {new Date(payment.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {metadata?.resourceUrl || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      ${payment.amount}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={payment.status}
                      size="small"
                      color={
                        payment.status === 'CONFIRMED'
                          ? 'success'
                          : payment.status === 'PENDING'
                          ? 'warning'
                          : 'error'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`https://stellar.expert/explorer/testnet/tx/${payment.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ fontSize: '0.875rem' }}
                    >
                      {payment.txHash.substring(0, 8)}...
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
