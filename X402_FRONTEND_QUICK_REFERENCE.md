# X402 Frontend Implementation Quick Reference

## For Developers

### Using the X402 Flow Hook

```typescript
import { useX402Flow } from '../../hooks/useX402Flow'

export const MyComponent = () => {
  const {
    step,
    paymentDetails,
    costEstimate,
    txHash,
    error,
    requestResource,
    confirmPayment,
    reset,
    canProceedToPayment,
    isProcessing,
  } = useX402Flow()

  const handleRequest = () => {
    requestResource('my-resource-id')
  }

  const handlePay = () => {
    confirmPayment('USDC')  // or 'XLM', 'PYUSD', 'USDY'
  }

  return (
    <div>
      {step === 'idle' && <button onClick={handleRequest}>Request</button>}
      {step === 'complete' && <div>Success! Tx: {txHash}</div>}
      {error && <div>Error: {error}</div>}
    </div>
  )
}
```

### Flow Steps Reference

| Step | State | Description |
|------|-------|-------------|
| `idle` | ✓ Ready | Initial state or between operations |
| `requesting` | ⏳ Loading | Fetching resource and 402 response |
| `signing` | ⏳ Awaiting | Wallet confirmation popup shown |
| `processing` | ⏳ Processing | Sending payment to backend |
| `complete` | ✓ Done | Payment successful, resource ready |
| `error` | ✗ Failed | Error occurred, user can retry |

### Common Patterns

**Pattern 1: Request and Pay in Sequence**
```typescript
const handleRequestAndPay = async () => {
  await requestResource('weather')
  // Wait for step change to payment review
  // Then:
  await confirmPayment('USDC')
}
```

**Pattern 2: Progress Indicator**
```typescript
const getProgressLabel = () => {
  const labels: Record<X402FlowStep, string> = {
    idle: 'Ready',
    requesting: 'Fetching...',
    signing: 'Signing...',
    processing: 'Processing...',
    complete: 'Complete',
    error: 'Error',
  }
  return labels[step]
}
```

**Pattern 3: Conditional Rendering**
```typescript
{isProcessing && <CircularProgress />}
{canProceedToPayment && <button onClick={() => confirmPayment()}>Pay</button>}
{step === 'complete' && <SuccessMessage txHash={txHash} />}
```

## Component Integration

### X402PaymentForm Example

The `X402PaymentForm` component demonstrates full integration:

```tsx
import { X402PaymentForm } from '../../components/X402'

export const PaymentPage = () => {
  return (
    <Container>
      <X402PaymentForm />
    </Container>
  )
}
```

## API Utilities Reference

### `requestX402Resource(resourceId: string)`
**Purpose:** Request a resource and receive 402 response with payment details

**Returns:**
```typescript
{
  success?: boolean
  error?: { code: string; message: string }
  payment?: {
    resourceUrl: string
    price: string
    network: string
    payTo: string
    description: string
  }
}
```

### `processX402Payment(payment: X402PaymentRequest)`
**Purpose:** Submit payment authorization to backend

**Params:**
```typescript
{
  walletAddress: string
  resourceUrl: string
  amount: number
  payTo: string
  asset?: 'XLM' | 'USDC' | 'PYUSD' | 'USDY'
  memo?: string
}
```

**Returns:**
```typescript
{
  success: boolean
  data?: {
    txHash: string
    transaction: unknown
  }
  error?: {
    code: string
    message: string
  }
}
```

### `estimateX402Cost(amount: number)`
**Purpose:** Calculate total cost including network fees

**Returns:**
```typescript
{
  amount: number        // Base payment amount
  networkFee: number    // Stellar network fee
  totalCost: number     // amount + networkFee
}
```

### `parseX402Price(price: string)`
**Purpose:** Parse price string to number

**Example:**
```typescript
parseX402Price('0.50')  // → 0.50
parseX402Price('USD 0.50')  // → 0.50
```

## Styling & Material-UI

The X402 components use Material-UI (MUI) and follow the design system:

### Color Scheme
- **Primary:** Used for confirm buttons, badges
- **Success:** Used for completion states
- **Error:** Used for error messages
- **Info:** Used for informational alerts

### Components Used
- `Stepper` / `Step` / `StepLabel` / `StepContent` - Flow visualization
- `Paper` - Container
- `Card` / `CardContent` - Detail sections
- `TextField` - Input fields
- `Button` - Actions
- `Alert` - Messages
- `CircularProgress` - Loading states
- `Chip` - Badge labels
- `Typography` - Text styling

### Example Styling Pattern
```typescript
<Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
  <Typography variant="h5" gutterBottom>Title</Typography>
  <Alert severity="success">Message</Alert>
</Box>
```

## Testing

### Unit Test Example
```typescript
import { renderHook, act } from '@testing-library/react'
import { useX402Flow } from './useX402Flow'

test('x402 flow progresses correctly', async () => {
  const { result } = renderHook(() => useX402Flow())
  
  expect(result.current.step).toBe('idle')
  
  act(() => {
    result.current.requestResource('test-resource')
  })
  
  expect(result.current.step).toBe('requesting')
})
```

### Integration Test Example
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { X402PaymentForm } from './X402PaymentForm'

test('user flow from request to payment', async () => {
  render(<X402PaymentForm />)
  
  // Step 1: Request resource
  const input = screen.getByLabelText('Resource ID')
  await userEvent.type(input, 'test')
  await userEvent.click(screen.getByText('Request Resource'))
  
  // Wait for Step 2
  await screen.findByText('Payment Required')
  
  // Step 3: Confirm payment
  await userEvent.click(screen.getByText('Approve & Pay'))
})
```

## Troubleshooting

### Issue: "Wallet not connected"
**Solution:** Ensure user has connected wallet via dashboard first

### Issue: "402 not received"
**Solution:** Check backend is responding correctly:
```bash
curl -i http://localhost:3001/api/x402/resource/test
# Should return 402 status code
```

### Issue: "Payment fails after signing"
**Solution:** Check:
1. Backend is running: `npm run dev` in `packages/backend`
2. Backend has access to Stellar network
3. User has sufficient balance

### Issue: "Slow performance"
**Solution:** 
1. Check network latency with DevTools
2. Verify Stellar testnet is responsive
3. Check for Redux state updates causing re-renders

## Performance Tips

1. **Memoize callbacks** to prevent unnecessary re-renders
2. **Debounce user input** when validating resource IDs
3. **Preload wallet** on app startup if user was previously connected
4. **Cache cost estimates** for repeated resources
5. **Monitor elapsed time** to spot bottlenecks

## Security Considerations

1. **Never store private keys** in local state
2. **Always validate from-address** matches connected wallet
3. **Verify recipient address** before confirming payment
4. **Use HTTPS only** in production
5. **Implement rate limiting** to prevent spam
6. **Validate all user input** on backend

## Related Files

| File | Purpose |
|------|---------|
| `src/hooks/useX402Flow.ts` | Payment flow orchestration |
| `src/components/X402/X402PaymentForm.tsx` | Main flow UI |
| `src/utils/x402Api.ts` | API client functions |
| `src/config/x402.ts` | Configuration constants |
| `src/types/index.ts` | TypeScript type definitions |
| `X402_FRONTEND_USER_FLOW.md` | Full documentation |

## Further Learning

- [X402 Spec](https://x402.org)
- [Stellar Docs](https://developers.stellar.org)
- [React Hooks](https://react.dev/reference/react/hooks)
- [Material-UI](https://mui.com)
