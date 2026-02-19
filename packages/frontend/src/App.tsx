import { Routes, Route } from 'react-router-dom'
import { Box, Typography, Card, CardContent, Grid, Button } from '@mui/material'
import { AccountBalanceWallet, SwapHoriz, Lock, Receipt } from '@mui/icons-material'
import { Layout } from './components/Layout'
import { TransactionsPage } from './components/Transactions'
import { EscrowPage } from './components/Escrow'
import { InvoicePage } from './components/Invoice'
import { P2PPage } from './components/P2P'
import { ClientPortalPage } from './components/ClientPortal'
import { useAppSelector } from './store/hooks'
import { useNavigate } from 'react-router-dom'
import './App.css'

function App() {
  const navigate = useNavigate()
  const { connected } = useAppSelector((state) => state.wallet)

  return (
    <Layout>
      <Routes>
        <Route path="/" element={
          <Box>
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography 
                variant="h2" 
                component="h1" 
                gutterBottom 
                sx={{ 
                  fontWeight: 700, 
                  mb: 2,
                  background: 'linear-gradient(135deg, #9A8577 0%, #D4AF37 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Stellar Payment Platform
              </Typography>
              <Typography variant="h5" component="h2" color="text.secondary" sx={{ mb: 4, fontWeight: 400 }}>
                Secure, fast, and transparent blockchain transactions
              </Typography>
              
              {!connected && (
                <Box sx={{ 
                  p: 4, 
                  background: (theme) => theme.palette.mode === 'light'
                    ? 'linear-gradient(135deg, rgba(154, 133, 119, 0.1) 0%, rgba(212, 175, 55, 0.1) 100%)'
                    : 'linear-gradient(135deg, rgba(154, 133, 119, 0.2) 0%, rgba(212, 175, 55, 0.2) 100%)',
                  borderRadius: 3,
                  maxWidth: 700,
                  mx: 'auto',
                  border: '2px solid',
                  borderColor: 'primary.light',
                  backdropFilter: 'blur(10px)',
                }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'text.primary', fontWeight: 600 }}>
                    Connect your Stellar wallet to get started
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    Supports Freighter, Albedo, and WalletConnect
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  height: '100%', 
                  cursor: connected ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                  border: '2px solid',
                  borderColor: 'transparent',
                  background: (theme) => theme.palette.mode === 'light'
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)'
                    : 'linear-gradient(135deg, rgba(37,34,32,0.9) 0%, rgba(37,34,32,0.7) 100%)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': connected ? { 
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                    borderColor: 'secondary.main',
                    background: (theme) => theme.palette.mode === 'light'
                      ? 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(37,34,32,1) 0%, rgba(37,34,32,0.95) 100%)',
                  } : {}
                }}
                onClick={() => connected && navigate('/transactions')}>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <SwapHoriz sx={{ fontSize: 56, color: 'secondary.main', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Transactions
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Send and receive XLM instantly with low fees
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  height: '100%', 
                  cursor: connected ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                  border: '2px solid',
                  borderColor: 'transparent',
                  background: (theme) => theme.palette.mode === 'light'
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)'
                    : 'linear-gradient(135deg, rgba(37,34,32,0.9) 0%, rgba(37,34,32,0.7) 100%)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': connected ? { 
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                    borderColor: 'secondary.main',
                    background: (theme) => theme.palette.mode === 'light'
                      ? 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(37,34,32,1) 0%, rgba(37,34,32,0.95) 100%)',
                  } : {}
                }}
                onClick={() => connected && navigate('/escrow')}>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Lock sx={{ fontSize: 56, color: 'secondary.main', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Escrow
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Secure payments with conditional release
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  height: '100%', 
                  cursor: connected ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                  border: '2px solid',
                  borderColor: 'transparent',
                  background: (theme) => theme.palette.mode === 'light'
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)'
                    : 'linear-gradient(135deg, rgba(37,34,32,0.9) 0%, rgba(37,34,32,0.7) 100%)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': connected ? { 
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                    borderColor: 'secondary.main',
                    background: (theme) => theme.palette.mode === 'light'
                      ? 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(37,34,32,1) 0%, rgba(37,34,32,0.95) 100%)',
                  } : {}
                }}
                onClick={() => connected && navigate('/invoices')}>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Receipt sx={{ fontSize: 56, color: 'secondary.main', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Invoices
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create and manage payment requests
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  height: '100%', 
                  cursor: connected ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                  border: '2px solid',
                  borderColor: 'transparent',
                  background: (theme) => theme.palette.mode === 'light'
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)'
                    : 'linear-gradient(135deg, rgba(37,34,32,0.9) 0%, rgba(37,34,32,0.7) 100%)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': connected ? { 
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                    borderColor: 'secondary.main',
                    background: (theme) => theme.palette.mode === 'light'
                      ? 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(37,34,32,1) 0%, rgba(37,34,32,0.95) 100%)',
                  } : {}
                }}
                onClick={() => connected && navigate('/p2p')}>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <AccountBalanceWallet sx={{ fontSize: 56, color: 'secondary.main', mb: 2 }} />
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                      P2P Payments
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Direct peer-to-peer transfers
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {connected && (
              <Box sx={{ textAlign: 'center', mt: 6 }}>
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={() => navigate('/transactions')}
                  sx={{ 
                    px: 6, 
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    boxShadow: 4,
                    '&:hover': {
                      boxShadow: 8,
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  Start Transacting →
                </Button>
              </Box>
            )}
          </Box>
        } />
        
        <Route path="/dashboard" element={
          <Typography variant="h4" align="center">
            Dashboard - Coming Soon
          </Typography>
        } />
        
        <Route path="/transactions" element={<TransactionsPage />} />
        
        <Route path="/escrow" element={<EscrowPage />} />
        
        <Route path="/invoices" element={<InvoicePage />} />
        
        <Route path="/p2p" element={<P2PPage />} />
        
        <Route path="/client/*" element={<ClientPortalPage />} />
      </Routes>
    </Layout>
  )
}

export default App