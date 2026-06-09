import { Routes, Route } from 'react-router-dom'
import { Box, Typography, Card, CardContent, Grid, Button, Stack, Chip } from '@mui/material'
import {
  AccountBalanceWallet,
  ArrowForward,
  CheckCircle,
  Lock,
  Receipt,
  Send,
  Share,
  Shield,
  SmartToy,
  SwapHoriz,
} from '@mui/icons-material'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { TransactionsPage } from './components/Transactions'
import { EscrowPage } from './components/Escrow'
import { InvoicePage } from './components/Invoice'
import { P2PPage } from './components/P2P'
import { X402Page } from './components/X402'
import { ClientPortalPage } from './components/ClientPortal'
import { useAppSelector } from './store/hooks'
import { useNavigate } from 'react-router-dom'
import './App.css'

function App() {
  const navigate = useNavigate()
  const { connected } = useAppSelector((state) => state.wallet)

  const primaryActions = [
    {
      title: 'Send money',
      description: 'Move XLM quickly with a clear record of every transfer.',
      icon: <SwapHoriz sx={{ fontSize: 34 }} />,
      path: '/transactions',
    },
    {
      title: 'Create an invoice',
      description: 'Build a professional payment request for your client.',
      icon: <Receipt sx={{ fontSize: 34 }} />,
      path: '/invoices',
    },
    {
      title: 'Share a payment link',
      description: 'Copy an invoice approval link your client can open and pay.',
      icon: <Share sx={{ fontSize: 34 }} />,
      path: '/invoices',
    },
    {
      title: 'Protect a deal',
      description: 'Hold funds safely until the agreed conditions are met.',
      icon: <Lock sx={{ fontSize: 34 }} />,
      path: '/escrow',
    },
  ]

  const additionalTools = [
    {
      label: 'P2P payments',
      helper: 'Direct transfers between Stellar wallets',
      icon: <AccountBalanceWallet />,
      path: '/p2p',
    },
    {
      label: 'X402 agent payments',
      helper: 'Micropayments for AI and automated services',
      icon: <SmartToy />,
      path: '/x402',
    },
  ]

  console.log('🏠 App render - wallet connected:', connected)

  return (
    <Layout>
      <Routes>
        <Route path="/" element={
          <Box sx={{ pb: { xs: 3, md: 6 }, overflow: 'hidden' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(340px, 0.85fr)' },
                gap: { xs: 3, md: 6 },
                alignItems: 'center',
                mb: { xs: 4, md: 7 },
              }}
            >
              <Box>
                <Chip
                  icon={connected ? <CheckCircle /> : <Shield />}
                  label={connected ? 'Wallet connected' : 'Freighter, Albedo, and WalletConnect supported'}
                  color={connected ? 'success' : 'default'}
                  sx={{
                    mb: { xs: 2, md: 3 },
                    px: 1,
                    height: 'auto',
                    maxWidth: '100%',
                    alignItems: 'flex-start',
                    '& .MuiChip-icon': { mt: { xs: '7px', sm: 0 } },
                    '& .MuiChip-label': { whiteSpace: 'normal', py: { xs: 0.75, sm: 0 } },
                  }}
                />
                <Typography
                  variant="h2"
                  component="h1"
                  sx={{
                    maxWidth: 760,
                    mb: 2,
                    fontSize: { xs: '2rem', sm: '2.6rem', md: '3.75rem' },
                    lineHeight: { xs: 1.12, md: 1.06 },
                    letterSpacing: 0,
                  }}
                >
                  Welcome to simple, secure Stellar payments.
                </Typography>
                <Typography
                  variant="h5"
                  component="p"
                  color="text.secondary"
                  sx={{
                    maxWidth: 700,
                    mb: { xs: 3, md: 4 },
                    fontSize: { xs: '1.05rem', md: '1.5rem' },
                    fontWeight: 400,
                    lineHeight: 1.45,
                  }}
                >
                  Send money, protect deals with escrow, and collect invoices from one calm workspace built for everyday Stellar payments.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: { xs: 3, md: 4 } }}>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate(connected ? '/dashboard' : '/transactions')}
                    fullWidth
                    sx={{ px: 4, py: 1.5, width: { sm: 'auto' } }}
                  >
                    {connected ? 'Open dashboard' : 'Start a payment'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => navigate('/invoices')}
                    fullWidth
                    sx={{ px: 4, py: 1.5, width: { sm: 'auto' } }}
                  >
                    Create invoice
                  </Button>
                </Stack>
                <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ maxWidth: 760 }}>
                  {[
                    'Transparent transaction history',
                    'Conditional escrow releases',
                    'Shareable client payment links',
                  ].map((item) => (
                    <Grid item xs={12} sm={4} key={item}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <CheckCircle sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {item}
                        </Typography>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: { xs: 2, md: 3 },
                  background: (theme) => theme.palette.mode === 'light'
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(245,241,237,0.92) 100%)'
                    : 'linear-gradient(145deg, rgba(37,34,32,0.96) 0%, rgba(51,46,43,0.92) 100%)',
                  boxShadow: { xs: 2, md: 4 },
                }}
              >
                <Stack spacing={{ xs: 1.75, md: 2.25 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box>
                      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Today at a glance
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.5 }}>
                        Ready when you are
                      </Typography>
                    </Box>
                    <Send sx={{ color: 'secondary.main', fontSize: 34 }} />
                  </Stack>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(250,248,246,0.9)' : 'rgba(26,22,20,0.7)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                      Suggested next step
                    </Typography>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {connected ? 'Review your dashboard' : 'Connect your wallet from the top bar'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {connected
                        ? 'Your payment tools are unlocked. Start with your dashboard or jump straight into a transfer.'
                        : 'You can explore the tools first, then connect when you are ready to send, sign, or collect funds.'}
                    </Typography>
                  </Box>
                  <Stack spacing={1.25}>
                    {[
                      ['Network', 'Stellar'],
                      ['Fees', 'Low-cost transfers'],
                      ['Controls', 'Payments, escrow, invoices'],
                    ].map(([label, value]) => (
                      <Stack
                        key={label}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={2}
                        sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>
                          {value}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h4"
                component="h2"
                sx={{ mb: 1, fontSize: { xs: '1.55rem', md: '1.75rem' }, letterSpacing: 0 }}
              >
                What would you like to do?
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Choose the path that matches the payment job in front of you.
              </Typography>
            </Box>

            <Grid container spacing={{ xs: 1.75, md: 3 }} sx={{ mb: { xs: 3, md: 4 } }}>
              {primaryActions.map((action) => (
                <Grid item xs={12} sm={6} md={3} key={action.title}>
                  <Card
                    sx={{
                      height: '100%',
                      cursor: 'pointer',
                      borderRadius: 2,
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 5,
                        borderColor: 'secondary.main',
                      },
                    }}
                    onClick={() => navigate(action.path)}
                  >
                    <CardContent sx={{ p: { xs: 2, md: 3 }, height: '100%' }}>
                      <Stack
                        direction={{ xs: 'row', sm: 'column' }}
                        spacing={{ xs: 1.75, md: 2 }}
                        alignItems={{ xs: 'center', sm: 'flex-start' }}
                        sx={{ height: '100%' }}
                      >
                        <Box
                          sx={{
                            width: { xs: 48, md: 58 },
                            height: { xs: 48, md: 58 },
                            borderRadius: 2,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            color: 'secondary.main',
                            bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.18)',
                            '& svg': { fontSize: { xs: 28, md: 34 } },
                          }}
                        >
                          {action.icon}
                        </Box>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                            {action.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {action.description}
                          </Typography>
                        </Box>
                        <Button
                          endIcon={<ArrowForward />}
                          sx={{
                            alignSelf: { xs: 'center', sm: 'flex-start' },
                            minWidth: { xs: 40, sm: 'auto' },
                            px: { xs: 0.5, sm: 0 },
                            '& .MuiButton-endIcon': { mx: 0 },
                          }}
                          aria-label={`Open ${action.title}`}
                        >
                          Open
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{
                p: { xs: 1.5, md: 2.5 },
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {additionalTools.map((tool) => (
                <Button
                  key={tool.label}
                  onClick={() => navigate(tool.path)}
                  startIcon={tool.icon}
                  endIcon={<ArrowForward />}
                  sx={{
                    flex: 1,
                    justifyContent: 'space-between',
                    p: { xs: 1.5, md: 2 },
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'text.primary',
                    textAlign: 'left',
                    '& .MuiButton-startIcon': { color: 'secondary.main' },
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography component="span" sx={{ display: 'block', fontWeight: 700 }}>
                      {tool.label}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
                      {tool.helper}
                    </Typography>
                  </Box>
                </Button>
              ))}
            </Stack>
          </Box>
        } />
        
        <Route path="/dashboard" element={<Dashboard />} />
        
        <Route path="/transactions" element={<TransactionsPage />} />
        
        <Route path="/escrow" element={<EscrowPage />} />
        
        <Route path="/invoices" element={<InvoicePage />} />
        
        <Route path="/p2p" element={<P2PPage />} />
        
        <Route path="/x402" element={<X402Page />} />
        
        <Route path="/client/*" element={<ClientPortalPage />} />
      </Routes>
    </Layout>
  )
}

export default App
