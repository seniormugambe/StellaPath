/**
 * WalletSelectionDialog Component
 * Dialog for selecting and connecting to a wallet
 */

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material'
import {
  AccountBalanceWallet as WalletIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material'
import { useWallet } from '../../hooks/useWallet'
import { WalletManager, type WalletType } from '../../utils/wallets'

interface WalletSelectionDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Wallet Selection Dialog Component
 * Allows users to choose and connect to a supported wallet
 * Validates: Requirement 6.1 - Secure wallet connection
 */
export const WalletSelectionDialog = ({ open, onClose }: WalletSelectionDialogProps) => {
  const { connect, availableWallets, isConnecting, error, clearError } = useWallet()
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null)

  const handleWalletSelect = async (walletType: WalletType) => {
    setSelectedWallet(walletType)
    clearError()

    try {
      await connect(walletType)
      // Close dialog on successful connection
      onClose()
    } catch (err) {
      // Error is handled by the hook
      console.error('Connection failed:', err)
    } finally {
      setSelectedWallet(null)
    }
  }

  const handleClose = () => {
    if (!isConnecting) {
      clearError()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Connect Wallet
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {availableWallets.length === 0 && !isConnecting && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No wallets detected. Please install Freighter or use Albedo.
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose a wallet to connect to the Stellar network
        </Typography>

        <List>
          {(['freighter', 'albedo', 'walletconnect'] as WalletType[]).map((walletType) => {
            const isAvailable = availableWallets.includes(walletType)
            const isLoading = isConnecting && selectedWallet === walletType

            return (
              <ListItem key={walletType} disablePadding>
                <ListItemButton
                  onClick={() => handleWalletSelect(walletType)}
                  disabled={!isAvailable || isConnecting}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <ListItemIcon>
                    {isLoading ? (
                      <CircularProgress size={24} />
                    ) : isAvailable ? (
                      <CheckIcon color="success" />
                    ) : (
                      <WalletIcon color="disabled" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={WalletManager.getWalletDisplayName(walletType)}
                    secondary={
                      isAvailable
                        ? WalletManager.getWalletDescription(walletType)
                        : 'Not available'
                    }
                    primaryTypographyProps={{
                      fontWeight: isAvailable ? 'medium' : 'normal',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>

        {isConnecting && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Connecting to wallet...
            </Typography>
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            <strong>Note:</strong> WalletConnect requires additional setup. 
            For now, please use Freighter (browser extension) or Albedo (web-based).
          </Typography>
        </Alert>
      </DialogContent>
    </Dialog>
  )
}
