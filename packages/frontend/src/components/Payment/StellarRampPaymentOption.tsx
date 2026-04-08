import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Button,
  Alert,
} from '@mui/material'
import { stellarRampConfig, buildStellarRampHref } from '../../config/stellarRamp'

export type PaymentMethodOption = 'wallet' | 'stellar_ramp'

export interface StellarRampPaymentOptionProps {
  /** Connected wallet public key — passed to ramp URL when present */
  accountId?: string | null
  /** Optional amount hint for ramp URL (when VITE_STELLAR_RAMP_AMOUNT_PARAM is set) */
  amount?: number
  paymentMethod: PaymentMethodOption
  onPaymentMethodChange: (method: PaymentMethodOption) => void
  /** Label for the default on-chain path */
  walletLabel?: string
  disabled?: boolean
}

export function StellarRampPaymentOption({
  accountId,
  amount,
  paymentMethod,
  onPaymentMethodChange,
  walletLabel = 'Pay with connected wallet',
  disabled = false,
}: StellarRampPaymentOptionProps) {
  if (!stellarRampConfig.enabled) {
    return null
  }

  const rampHref = buildStellarRampHref({
    accountId: accountId ?? undefined,
    amount,
  })

  return (
    <Box sx={{ mb: 3 }}>
      <FormControl component="fieldset" variant="standard" fullWidth disabled={disabled}>
        <FormLabel component="legend">Payment option</FormLabel>
        <RadioGroup
          row={false}
          value={paymentMethod}
          onChange={(_, v) => onPaymentMethodChange(v as PaymentMethodOption)}
        >
          <FormControlLabel value="wallet" control={<Radio />} label={walletLabel} />
          <FormControlLabel
            value="stellar_ramp"
            control={<Radio />}
            label="Stellar Ramp (anchor) — add funds, then pay with wallet"
          />
        </RadioGroup>
      </FormControl>

      {paymentMethod === 'stellar_ramp' && (
        <Alert severity="info" sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Use Stellar Ramp or your anchor’s deposit flow to fund this account. When your balance is
            ready, select <strong>{walletLabel}</strong> and submit the payment here.
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            href={rampHref}
            target="_blank"
            rel="noopener noreferrer"
            component="a"
            disabled={disabled}
          >
            Open Stellar Ramp
          </Button>
        </Alert>
      )}
    </Box>
  )
}
