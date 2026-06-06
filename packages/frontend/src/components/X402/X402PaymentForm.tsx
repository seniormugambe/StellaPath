/**
 * X402 Payment Form Component
 * Implements the complete user flow for X402 payments:
 * 1. Request resource → 2. Receive 402 response → 3. Sign payment → 4. Complete transaction
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { useAppSelector } from '../../store/hooks';
import { useX402Flow } from '../../hooks/useX402Flow';
import { x402Config } from '../../config/x402';

export const X402PaymentForm: React.FC = () => {
  const { accountId } = useAppSelector((state) => state.wallet);
  const {
    step,
    paymentDetails,
    costEstimate,
    unsignedXdr,
    unsignedTxHash,
    error,
    elapsedSeconds,
    canProceedToPayment,
    isProcessing,
    requestResource,
    confirmPayment,
    reset,
  } = useX402Flow();

  const [inputResourceId, setInputResourceId] = useState('');

  const handleRequestResource = () => {
    requestResource(inputResourceId);
  };

  const handleConfirmPayment = async () => {
    await confirmPayment('USDC');
  };

  const stepLabels = [
    { label: 'Request Resource', description: 'Enter resource ID and request payment details' },
    { label: 'Review Payment', description: 'Verify amount and transaction details' },
    { label: 'Prepare Authorization', description: 'Create an unsigned transaction for your wallet' },
    { label: 'Prepared', description: 'Transaction is ready to sign' },
  ];

  const getActiveStep = () => {
    if (step === 'idle' && paymentDetails === null) return 0;
    if (step === 'idle' && paymentDetails !== null) return 1;
    if (step === 'signing') return 2;
    if (step === 'complete') return 3;
    return 0;
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        X402 Payment Flow
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Complete payment authorization in ~5 seconds: Request → Sign → Complete
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => reset()}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={getActiveStep()} orientation="vertical" sx={{ mb: 3 }}>
        {stepLabels.map((item, index) => (
          <Step key={index} completed={index < getActiveStep() || (index === 3 && step === 'complete')}>
            <StepLabel>{item.label}</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {item.description}
              </Typography>

              {index === 0 && (
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Resource ID"
                    value={inputResourceId}
                    onChange={(e) => setInputResourceId(e.target.value)}
                    placeholder={`e.g., ${x402Config.defaultResourceId}`}
                    disabled={isProcessing || step === 'complete'}
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleRequestResource}
                    disabled={!inputResourceId || isProcessing || step === 'complete'}
                    sx={{ mb: 1 }}
                  >
                    {step === 'requesting' ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Requesting...
                      </>
                    ) : (
                      'Request Resource'
                    )}
                  </Button>
                </Box>
              )}

              {index === 1 && paymentDetails && (
                <Box sx={{ mb: 2 }}>
                  <Card sx={{ mb: 2, bgcolor: 'background.default' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Resource
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {paymentDetails.resourceUrl}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Description
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {paymentDetails.description}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Price
                      </Typography>
                      <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                        {paymentDetails.price}
                      </Typography>

                      {costEstimate && (
                        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Typography variant="body2" fontWeight="bold" gutterBottom>
                            Cost Breakdown
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="body2">Amount:</Typography>
                            <Typography variant="body2">${costEstimate.amount}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Network Fee:</Typography>
                            <Typography variant="body2">${costEstimate.networkFee}</Typography>
                          </Box>
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              mt: 1, 
                              pt: 1, 
                              borderTop: 1, 
                              borderColor: 'divider' 
                            }}
                          >
                            <Typography variant="body1" fontWeight="bold">Total:</Typography>
                            <Typography variant="body1" fontWeight="bold">${costEstimate.totalCost}</Typography>
                          </Box>
                        </Box>
                      )}

                      <Box sx={{ mt: 2 }}>
                        <Chip label={paymentDetails.network} size="small" sx={{ mr: 1 }} />
                        <Chip label="USDC" size="small" color="primary" />
                      </Box>
                    </CardContent>
                  </Card>

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleConfirmPayment}
                    disabled={!canProceedToPayment || isProcessing}
                    sx={{ mb: 1 }}
                  >
                    {step === 'signing' || step === 'processing' ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                      {step === 'signing' ? 'Preparing...' : 'Preparing...'}
                      </>
                    ) : (
                      'Prepare Payment'
                    )}
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={reset}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                </Box>
              )}

              {index === 2 && (step === 'signing' || step === 'processing') && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <CircularProgress size={32} />
                  <Box>
                    <Typography variant="body1">
                      {step === 'signing' ? 'Preparing unsigned transaction...' : 'Preparing payment...'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The next step is wallet signing
                    </Typography>
                  </Box>
                </Box>
              )}

              {index === 3 && step === 'complete' && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CheckCircleIcon sx={{ color: 'success.main', fontSize: 32 }} />
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        Payment Prepared
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Prepared in {elapsedSeconds}s
                      </Typography>
                    </Box>
                  </Box>

                  {unsignedTxHash && (
                    <Card sx={{ bgcolor: 'success.light', mb: 2 }}>
                      <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Unsigned Transaction Hash
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            wordBreak: 'break-all',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                          }}
                        >
                          {unsignedTxHash}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}

                  {unsignedXdr && (
                    <Card sx={{ bgcolor: 'background.default', mb: 2 }}>
                      <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Unsigned XDR
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            wordBreak: 'break-all',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                          }}
                        >
                          {unsignedXdr}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={reset}
                  >
                    Start New Payment
                  </Button>
                </Box>
              )}
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {!accountId && (
        <Alert severity="warning" icon={<ScheduleIcon />}>
          Please connect your wallet to make payments
        </Alert>
      )}
    </Paper>
  );
};
