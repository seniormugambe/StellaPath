import { Routes, Route } from 'react-router-dom'
import { Box, Typography, Card, CardActionArea, CardContent, Button, Stack, Chip } from '@mui/material'
import {
  AccountBalanceWallet,
  Lock,
  Receipt,
  Send,
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
  const featureLocked = !connected

  const openWalletDialog = () => {
    window.dispatchEvent(new Event('stellarpath:wallet:open'))
  }

  const openFeature = (path: string) => {
    if (featureLocked) return
    navigate(path)
  }

  const renderLockedFeature = (featureName: string) => (
    <Box
      sx={{
        display: 'grid',
        placeItems: 'center',
        minHeight: { xs: '55vh', md: '62vh' },
        px: { xs: 1, sm: 2 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 560,
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          textAlign: 'center',
          boxShadow: 2,
        }}
      >
        <Box
          sx={{
            width: 60,
            height: 60,
            mx: 'auto',
            mb: 2,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: 'secondary.main',
            bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.18)',
          }}
        >
          <Lock sx={{ fontSize: 34 }} />
        </Box>
        <Typography variant="h4" component="h1" sx={{ mb: 1, fontSize: { xs: '1.65rem', md: '2rem' } }}>
          Connect your wallet to use {featureName}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Stellar payment tools stay disabled until a wallet is connected and ready to sign.
        </Typography>
        <Button variant="contained" size="large" onClick={openWalletDialog} fullWidth sx={{ width: { sm: 'auto' } }}>
          Connect wallet
        </Button>
      </Box>
    </Box>
  )

  const primaryFeatureCards = [
    {
      title: 'Transactions',
      helper: 'Send XLM',
      icon: <SwapHoriz sx={{ fontSize: 34 }} />,
      path: '/transactions',
    },
    {
      title: 'Invoices',
      helper: 'Request payment',
      icon: <Receipt sx={{ fontSize: 34 }} />,
      path: '/invoices',
    },
    {
      title: 'Escrow',
      helper: 'Hold funds',
      icon: <Lock sx={{ fontSize: 34 }} />,
      path: '/escrow',
    },
  ]

  const secondaryFeatureCards = [
    {
      title: 'P2P Payments',
      helper: 'Wallet to wallet',
      icon: <AccountBalanceWallet sx={{ fontSize: 34 }} />,
      path: '/p2p',
    },
    {
      title: 'X402',
      helper: 'Agent payments',
      icon: <SmartToy sx={{ fontSize: 34 }} />,
      path: '/x402',
    },
  ]

  const renderFeatureCard = (
    feature: typeof primaryFeatureCards[number],
    size: 'primary' | 'secondary' = 'primary',
  ) => (
    <Card key={feature.title} sx={{ height: '100%', borderRadius: 2 }}>
      <CardActionArea
        onClick={() => openFeature(feature.path)}
        sx={{
          height: '100%',
          p: 0,
          '&:hover .feature-icon': {
            bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.26)',
          },
        }}
      >
        <CardContent
          sx={{
            height: '100%',
            p: { xs: 1.5, sm: 2, md: size === 'primary' ? 3 : 2.5 },
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: size === 'primary' ? 'column' : 'row' }}
            spacing={{ xs: 1.25, sm: 2 }}
            alignItems={{ xs: 'center', sm: size === 'primary' ? 'flex-start' : 'center' }}
            textAlign={{ xs: 'center', sm: 'left' }}
            sx={{ minHeight: size === 'primary' ? { xs: 118, sm: 168 } : { xs: 112, sm: 96 } }}
          >
            <Box
              className="feature-icon"
              sx={{
                width: { xs: 46, md: size === 'primary' ? 64 : 54 },
                height: { xs: 46, md: size === 'primary' ? 64 : 54 },
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                color: 'secondary.main',
                bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.18)',
                transition: 'background-color 0.2s ease',
                '& svg': { fontSize: { xs: 28, md: size === 'primary' ? 36 : 30 } },
              }}
            >
              {feature.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1rem', md: size === 'primary' ? '1.45rem' : '1.2rem' },
                  lineHeight: 1.18,
                }}
              >
                {feature.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500, fontSize: { xs: '0.78rem', md: '0.875rem' } }}>
                {feature.helper}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )

  console.log('🏠 App render - wallet connected:', connected)

  return (
    <Layout>
      <Routes>
        <Route path="/" element={
          <Box sx={{ pb: { xs: 3, md: 6 }, overflow: 'hidden' }}>
            {!connected ? (
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
                    icon={<Shield />}
                    label="Freighter, Albedo, and WalletConnect supported"
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
                    Connect your wallet to unlock Stellar payment tools.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: { xs: 3, md: 4 } }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={openWalletDialog}
                      fullWidth
                      sx={{ px: 4, py: 1.5, width: { sm: 'auto' } }}
                    >
                      Connect wallet
                    </Button>
                  </Stack>
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
                          Wallet required
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
                      <Typography variant="h6">
                        Connect your wallet to unlock features
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            ) : (
              <Stack spacing={{ xs: 2.5, md: 3.5 }}>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                    Start here
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
                      gap: { xs: 1.5, md: 2.5 },
                      mt: 1,
                    }}
                  >
                    {primaryFeatureCards.map((feature) => renderFeatureCard(feature))}
                  </Box>
                </Box>

                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                    More tools
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))' },
                      gap: { xs: 1.5, md: 2.5 },
                      mt: 1,
                    }}
                  >
                    {secondaryFeatureCards.map((feature) => renderFeatureCard(feature, 'secondary'))}
                  </Box>
                </Box>
              </Stack>
            )}
          </Box>
        } />
        
        <Route path="/dashboard" element={connected ? <Dashboard /> : renderLockedFeature('the dashboard')} />
        
        <Route path="/transactions" element={connected ? <TransactionsPage /> : renderLockedFeature('transactions')} />
        
        <Route path="/escrow" element={connected ? <EscrowPage /> : renderLockedFeature('escrow')} />
        
        <Route path="/invoices" element={connected ? <InvoicePage /> : renderLockedFeature('invoices')} />
        
        <Route path="/p2p" element={connected ? <P2PPage /> : renderLockedFeature('P2P payments')} />
        
        <Route path="/x402" element={connected ? <X402Page /> : renderLockedFeature('X402 payments')} />
        
        <Route path="/client/*" element={<ClientPortalPage />} />
      </Routes>
    </Layout>
  )
}

export default App
