/**
 * X402 Page Component
 * Main page for x402 protocol features
 */

import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Tabs,
  Tab,
  Alert,
  Link,
} from '@mui/material';
import { X402PaymentForm } from './X402PaymentForm';
import { X402History } from './X402History';
import { useAppSelector } from '../../store/hooks';
import { x402Config } from '../../config/x402';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`x402-tabpanel-${index}`}
      aria-labelledby={`x402-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export const X402Page: React.FC = () => {
  const [tabValue, setTabValue] = React.useState(0);
  const { connected } = useAppSelector((state) => state.wallet);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          X402 Protocol
        </Typography>
        <Typography variant="body1" color="text.secondary">
          AI Agent Payments on Stellar - Pay for APIs and resources with micropayments
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Link href={x402Config.specUrl} target="_blank" rel="noopener noreferrer" variant="body2">
            x402.org
          </Link>
          <Typography variant="body2" color="text.secondary">
            ·
          </Typography>
          <Link href={x402Config.stellarX402Blog} target="_blank" rel="noopener noreferrer" variant="body2">
            Stellar & X402
          </Link>
        </Box>
      </Box>

      {!connected && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Connect your Stellar wallet (top right), then sign in so the app can call{' '}
          <code>/api/x402/*</code> with your JWT. History and payments require authentication.
        </Alert>
      )}

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="primary" gutterBottom>
              HTTP-Native
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Payments embedded directly in HTTP requests
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="primary" gutterBottom>
              No Accounts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No signups, API keys, or subscriptions required
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Instant Settlement
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ~5 second finality on Stellar network
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={3}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="x402 tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Make Payment" />
          <Tab label="Payment History" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box p={3}>
            <X402PaymentForm />
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box p={3}>
            <X402History />
          </Box>
        </TabPanel>
      </Paper>

      <Box mt={4}>
        <Paper elevation={2} sx={{ p: 3, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>
            About X402
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            X402 is an open protocol for internet-native payments that enables AI agents to pay for APIs and services autonomously. Built on Stellar for fast, low-cost settlements.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Use Cases:</strong> Pay-per-API call, AI agent payments, micropayments, M2M transactions, metered access
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};
