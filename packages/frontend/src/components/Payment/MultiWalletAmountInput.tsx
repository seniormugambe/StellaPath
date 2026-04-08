/**
 * MultiWalletAmountInput Component
 * Combines amount input with wallet selection dropdown for better UX
 * Supports SEP 24 ramps and wallet connections
 */

import React, { useState } from 'react'
import {
  Box,
  TextField,
  FormControl,
  Select,
  MenuItem,
  InputAdornment,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material'
import {
  AccountBalanceWallet as WalletIcon,
  ShoppingCart as RampIcon,
  ExpandMore as ExpandIcon,
} from '@mui/icons-material'
import { useWallet } from '../../hooks/useWallet'
import { WalletManager, type WalletType } from '../../utils/wallets'
import { sep24Config, buildSep24RampHref, type Sep24RampProvider } from '../../config/sep24'
import { WalletSelectionDialog } from '../Wallet/WalletSelectionDialog'

export type PaymentSource = 'wallet' | 'sep24'

export interface SelectedWallet {
  type: 'wallet'
  walletType: WalletType
  accountId: string | null
}

export interface SelectedRamp {
  type: 'sep24'
  provider: Sep24RampProvider
}

export type AmountInputSelection = SelectedWallet | SelectedRamp | null

export interface MultiWalletAmountInputProps {
  value: number
  onChange: (value: number) => void
  onSelectionChange: (selection: AmountInputSelection) => void
  selection: AmountInputSelection
  label?: string
  placeholder?: string
  asset?: string
  disabled?: boolean
  error?: string
  helperText?: string
  minAmount?: number
  maxAmount?: number
  step?: number
  showRampOption?: boolean
}

export const MultiWalletAmountInput: React.FC<MultiWalletAmountInputProps> = ({
  value,
  onChange,
  onSelectionChange,
  selection,
  label = 'Amount',
  placeholder = '0.00',
  asset = 'XLM',
  disabled = false,
  error,
  helperText,
  minAmount = 0,
  maxAmount,
  step = 0.0000001,
  showRampOption = true,
}) => {
  const { connected, accountId, walletType, availableWallets } = useWallet()
  const [walletDialogOpen, setWalletDialogOpen] = useState(false)
  const [rampDialogOpen, setRampDialogOpen] = useState(false)
  const [selectedRampProvider, setSelectedRampProvider] = useState<Sep24RampProvider | null>(null)

  const handleWalletSelect = () => {
    if (connected && walletType && accountId) {
      const walletSelection: SelectedWallet = {
        type: 'wallet',
        walletType,
        accountId,
      }
      onSelectionChange(walletSelection)
    } else {
      setWalletDialogOpen(true)
    }
  }

  const handleRampSelect = (provider: Sep24RampProvider) => {
    const rampSelection: SelectedRamp = {
      type: 'sep24',
      provider,
    }
    onSelectionChange(rampSelection)
    setSelectedRampProvider(provider)
    setRampDialogOpen(true)
  }

  const handleRampConfirm = () => {
    if (selectedRampProvider && value > 0) {
      const rampUrl = buildSep24RampHref(selectedRampProvider.id, {
        accountId: accountId || undefined,
        amount: value,
        asset,
      })
      window.open(rampUrl, '_blank', 'noopener,noreferrer')
    }
    setRampDialogOpen(false)
  }

  const getSelectionDisplay = (): { text: string; icon: React.ReactElement; color: string } => {
    if (!selection) {
      return {
        text: 'Select payment method',
        icon: <WalletIcon />,
        color: 'text.secondary',
      }
    }

    if (selection.type === 'wallet') {
      return {
        text: `${WalletManager.getWalletDisplayName(selection.walletType)} (${selection.accountId ? selection.accountId.substring(0, 8) + '...' : 'No account'})`,
        icon: <WalletIcon />,
        color: 'primary.main',
      }
    }

    if (selection.type === 'sep24') {
      return {
        text: `${selection.provider.name} Ramp`,
        icon: <RampIcon />,
        color: 'secondary.main',
      }
    }

    // Fallback
    return {
      text: 'Select payment method',
      icon: <WalletIcon />,
      color: 'text.secondary',
    }
  }

  const selectionDisplay = getSelectionDisplay()

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {label}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            fullWidth
            type="number"
            placeholder={placeholder}
            value={value || ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            error={!!error}
            helperText={error || helperText}
            disabled={disabled}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <strong>{asset}</strong>
                </InputAdornment>
              ),
              inputProps: {
                min: minAmount,
                max: maxAmount,
                step,
              },
            }}
            sx={{ flex: 1 }}
          />

          <FormControl sx={{ minWidth: 200 }}>
            <Select
              value=""
              displayEmpty
              disabled={disabled}
              renderValue={() => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {selectionDisplay.icon}
                  <Typography variant="body2" color={selectionDisplay.color}>
                    {selectionDisplay.text}
                  </Typography>
                  <ExpandIcon fontSize="small" />
                </Box>
              )}
              sx={{
                '& .MuiSelect-select': {
                  py: 1.5,
                  px: 2,
                },
              }}
            >
              {/* Wallet Options */}
              {availableWallets.length > 0 && (
                <MenuItem onClick={handleWalletSelect}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WalletIcon fontSize="small" />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {connected && walletType
                          ? `Connected: ${WalletManager.getWalletDisplayName(walletType)}`
                          : 'Connect Wallet'
                        }
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Pay directly from your wallet
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              )}

              {/* SEP 24 Ramp Options */}
              {showRampOption && sep24Config.enabled && sep24Config.providers.map((provider) => (
                <MenuItem
                  key={provider.id}
                  onClick={() => handleRampSelect(provider)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RampIcon fontSize="small" />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {provider.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {provider.description}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}

              {/* No wallets available */}
              {availableWallets.length === 0 && !sep24Config.enabled && (
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    No payment methods available
                  </Typography>
                </MenuItem>
              )}
            </Select>
          </FormControl>
        </Box>

        {selection && (
          <Box sx={{ mt: 1 }}>
            {selection.type === 'wallet' && (
              <Chip
                size="small"
                label={`Wallet: ${selection.accountId ? selection.accountId.substring(0, 12) + '...' : 'No account'}`}
                color="primary"
                variant="outlined"
              />
            )}
            {selection.type === 'sep24' && (
              <Chip
                size="small"
                label={`Ramp: ${selection.provider.name}`}
                color="secondary"
                variant="outlined"
              />
            )}
          </Box>
        )}
      </Box>

      {/* Wallet Selection Dialog */}
      <WalletSelectionDialog
        open={walletDialogOpen}
        onClose={() => setWalletDialogOpen(false)}
      />

      {/* SEP 24 Ramp Dialog */}
      <Dialog
        open={rampDialogOpen}
        onClose={() => setRampDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Complete Purchase with {selectedRampProvider?.name}
        </DialogTitle>
        <DialogContent>
          {selectedRampProvider && (
            <Box sx={{ py: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  You'll be redirected to {selectedRampProvider.name} to complete your purchase of {value} {asset}.
                  Funds will be deposited to your connected wallet after the transaction completes.
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Amount:</Typography>
                <Typography variant="body2" fontWeight={500}>{value} {asset}</Typography>
              </Box>

              {!accountId && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Please connect your wallet first to receive the purchased assets.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRampDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRampConfirm}
            variant="contained"
            disabled={!selectedRampProvider || value <= 0}
          >
            Continue to {selectedRampProvider?.name}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}