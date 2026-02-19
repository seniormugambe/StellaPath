/**
 * WalletDemo Component
 * Example component demonstrating wallet integration usage
 */

import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Divider,
} from '@mui/material'
import { useWallet } from '../../hooks/useWallet'
import { TransactionSigner } from './TransactionSigner'
import type { SignatureRequest } from '../../types'

/**
 * Demo component showing how to use wallet integration
 * This demonstrates:
 * - Wallet connection status
 * - Transaction signing
 * - Error handling
 */
export const WalletDemo = () => {
  const { connected, accountId, network, walletType } = useWallet()
  const [signerOpen, setSignerOpen] = useState(false)
  const [signatureRequest, setSignatureRequest] = useState<SignatureRequest | null>(null)
  const [signedXdr, setSignedXdr] = useState<string | null>(null)

  const handleTestSign = () => {
    // Create a test signature request
    const request: SignatureRequest = {
      transaction: 'AAAAAgAAAAA...', // This would be a real XDR in production
      accountId: accountId || '',
      network: network,
      metadata: {
        description: 'Test Transaction',
        amount: 10,
        recipient: 'GDEST...',
      },
    }

    setSignatureRequest(request)
    setSignerOpen(true)
  }

  const handleSignSuccess = (xdr: string) => {
    setSignedXdr(xdr)
    console.log('Transaction signed:', xdr)
  }

  const handleSignError = (error: Error) => {
    console.error('Signing error:', error)
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Wallet Integration Demo
          </Typography>

          <Divider sx={{ my: 2 }} />

          {connected ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Wallet Connected
              </Alert>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Wallet Type
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {walletType}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Account ID
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {accountId}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Network
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {network}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="contained"
                onClick={handleTestSign}
                fullWidth
                sx={{ mb: 2 }}
              >
                Test Transaction Signing
              </Button>

              {signedXdr && (
                <Alert severity="success">
                  <Typography variant="subtitle2">Transaction Signed!</Typography>
                  <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                    {signedXdr.substring(0, 50)}...
                  </Typography>
                </Alert>
              )}
            </>
          ) : (
            <Alert severity="info">
              Please connect your wallet using the button in the top right corner
            </Alert>
          )}
        </CardContent>
      </Card>

      <TransactionSigner
        open={signerOpen}
        request={signatureRequest}
        onClose={() => setSignerOpen(false)}
        onSuccess={handleSignSuccess}
        onError={handleSignError}
      />
    </Box>
  )
}
