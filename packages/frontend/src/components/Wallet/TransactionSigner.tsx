/**
 * TransactionSigner Component
 * Utility component for signing transactions
 */

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  Typography,
  CircularProgress,
  Divider,
} from '@mui/material'
import { useWallet } from '../../hooks/useWallet'
import type { SignatureRequest } from '../../types'

interface TransactionSignerProps {
  open: boolean
  request: SignatureRequest | null
  onClose: () => void
  onSuccess: (signedXdr: string) => void
  onError?: (error: Error) => void
}

/**
 * Transaction Signer Component
 * Handles transaction signing with user confirmation
 * Validates: Requirement 6.2 - Transaction signing with user authorization
 * Validates: Requirement 6.5 - Display transaction details before approval
 */
export const TransactionSigner = ({
  open,
  request,
  onClose,
  onSuccess,
  onError,
}: TransactionSignerProps) => {
  const { signTransaction, connected, walletType } = useWallet()
  const [isSigning, setIsSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSign = async () => {
    if (!request || !connected) {
      return
    }

    setIsSigning(true)
    setError(null)

    try {
      const signedXdr = await signTransaction(request)
      onSuccess(signedXdr)
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign transaction'
      setError(errorMessage)
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage))
      }
    } finally {
      setIsSigning(false)
    }
  }

  const handleClose = () => {
    if (!isSigning) {
      setError(null)
      onClose()
    }
  }

  if (!request) {
    return null
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Sign Transaction
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!connected && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Wallet is not connected. Please connect your wallet first.
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review the transaction details below and approve in your wallet
        </Typography>

        {/* Transaction Details */}
        <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1, border: 1, borderColor: 'divider' }}>
          {request.metadata?.description && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {request.metadata.description}
              </Typography>
            </>
          )}

          {request.metadata?.amount !== undefined && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                Amount
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {request.metadata.amount} XLM
              </Typography>
            </>
          )}

          {request.metadata?.recipient && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                Recipient
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {request.metadata.recipient}
              </Typography>
            </>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" color="text.secondary">
            Network
          </Typography>
          <Typography variant="body1" sx={{ mb: 2, textTransform: 'capitalize' }}>
            {request.network}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary">
            Signing Account
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {request.accountId}
          </Typography>
        </Box>

        {isSigning && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Waiting for wallet approval...
            </Typography>
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            Your {walletType} wallet will prompt you to review and approve this transaction.
            Make sure to verify all details before approving.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSigning}>
          Cancel
        </Button>
        <Button
          onClick={handleSign}
          variant="contained"
          disabled={!connected || isSigning}
        >
          {isSigning ? 'Signing...' : 'Sign Transaction'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
