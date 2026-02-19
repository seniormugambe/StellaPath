/**
 * WalletButton Component
 * Button for connecting/disconnecting wallet
 */

import { useState } from 'react'
import { Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material'
import {
  AccountBalanceWallet as WalletIcon,
  Logout as LogoutIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material'
import { useWallet } from '../../hooks/useWallet'
import { WalletManager } from '../../utils/wallets'
import { WalletSelectionDialog } from './WalletSelectionDialog'

/**
 * Wallet Button Component
 * Displays wallet connection status and provides connect/disconnect actions
 * Validates: Requirements 6.1, 6.4
 */
export const WalletButton = () => {
  const { connected, accountId, walletType, disconnect } = useWallet()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (connected) {
      setAnchorEl(event.currentTarget)
    } else {
      setDialogOpen(true)
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleDisconnect = async () => {
    handleClose()
    await disconnect()
  }

  const formatAddress = (address: string | null): string => {
    if (!address) return ''
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`
  }

  return (
    <>
      <Button
        color="inherit"
        startIcon={<WalletIcon />}
        onClick={handleClick}
        variant={connected ? 'outlined' : 'contained'}
        sx={{
          borderColor: connected ? 'inherit' : undefined,
          '&:hover': {
            borderColor: connected ? 'inherit' : undefined,
          },
        }}
      >
        {connected ? formatAddress(accountId) : 'Connect Wallet'}
      </Button>

      {/* Connected wallet menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem disabled>
          <ListItemIcon>
            <CheckIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText
            primary={walletType ? WalletManager.getWalletDisplayName(walletType) : 'Connected'}
            secondary={formatAddress(accountId)}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDisconnect}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Disconnect" />
        </MenuItem>
      </Menu>

      {/* Wallet selection dialog */}
      <WalletSelectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  )
}
