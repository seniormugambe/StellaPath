import { Box, AppBar, Toolbar, Typography, Button, Container } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { APP_NAME } from '../../constants'
import { WalletButton } from '../Wallet'
import { ThemeToggle } from '../ThemeToggle'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate()
  const { connected } = useAppSelector((state) => state.wallet)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ py: 1 }}>
          <Typography
            variant="h5"
            component="div"
            sx={{ 
              flexGrow: 1, 
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              letterSpacing: '-0.02em'
            }}
            onClick={() => navigate('/')}
          >
            {APP_NAME}
          </Typography>
          
          {connected && (
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
              <Button 
                color="inherit" 
                onClick={() => navigate('/dashboard')}
                sx={{ 
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                Dashboard
              </Button>
              <Button 
                color="inherit" 
                onClick={() => navigate('/transactions')}
                sx={{ 
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                Transactions
              </Button>
              <Button 
                color="inherit" 
                onClick={() => navigate('/escrow')}
                sx={{ fontWeight: 500, opacity: 0.5 }}
                disabled
              >
                Escrow
              </Button>
              <Button 
                color="inherit" 
                onClick={() => navigate('/invoices')}
                sx={{ fontWeight: 500, opacity: 0.5 }}
                disabled
              >
                Invoices
              </Button>
              <Button 
                color="inherit" 
                onClick={() => navigate('/p2p')}
                sx={{ 
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                P2P
              </Button>
            </Box>
          )}
          
          <ThemeToggle />
          <WalletButton />
        </Toolbar>
      </AppBar>

      <Container component="main" sx={{ flexGrow: 1, py: 4, maxWidth: 'xl' }}>
        {children}
      </Container>

      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          background: 'linear-gradient(135deg, rgba(235, 227, 219, 0.5) 0%, rgba(245, 241, 237, 0.5) 100%)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center" sx={{ fontWeight: 500 }}>
            {APP_NAME} © {new Date().getFullYear()} • Powered by Stellar
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}
