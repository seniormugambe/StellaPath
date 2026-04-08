# X402 Frontend User Flow - Enhanced Implementation

## Overview

The frontend X402 user flow has been enhanced to provide a clear, step-by-step journey for accessing x402-enabled services. The entire cycle completes within ~5 seconds, implementing the streamlined payment workflow described in "x402 on Stellar: unlocking payments for the new agent economy."

## User Flow Steps

### Step 1: Request Resource
**User Action:** Enter a resource ID and click "Request Resource"

```
User initiates request → API endpoint receives GET /x402/resource/:id → 
Backend processes and responds with HTTP 402 Payment Required
```

**What Happens:**
- User enters resource identifier (e.g., "weather", "news", "data")
- Frontend makes request via `requestX402Resource(resourceId)`
- Backend returns HTTP 402 with payment details in response headers
- Frontend extracts and displays payment requirements (amount, recipient, network)
- Cost estimation is calculated (base amount + network fees)

**UI:** Step 1 - Request Resource form with resource ID input

---

### Step 2: Review Payment
**User Action:** Verify transaction details and click "Approve & Pay"

**What Happens:**
- Payment details are displayed in an easy-to-read card format
- User reviews:
  - Resource URL
  - Price/amount required
  - Network fees
  - Total cost
  - Asset type (USDC, XLM, etc.)
- User confirms they have sufficient balance in their wallet
- User clicks "Approve & Pay" to proceed to signing

**UI:** Step 2 - Payment Details Review with cost breakdown

---

### Step 3: Sign Authorization
**User Action:** Wallet confirmation popup appears

**What Happens:**
- Payment authorization is prepared (amount, recipient, network)
- User's wallet (Freighter, Albedo, etc.) shows confirmation dialog
- User signs the transaction with their private key
- Signature is returned to frontend

**UI:** Step 3 - Loading state with message "Waiting for wallet signature..."

**Expected Duration:** 1-2 seconds (user confirms wallet popup)

---

### Step 4: Complete Transaction
**User Action:** Transaction is processed on Stellar

**What Happens:**
- Signed authorization is sent to backend via `processX402Payment()`
- Backend broadcasts transaction to Stellar network
- Transaction is confirmed (typically <2 seconds on testnet)
- Backend returns transaction hash
- Resource becomes accessible

**UI:** Step 4 - Success screen with transaction hash and elapsed time

**Expected Duration:** 2-3 seconds (network processing)

---

## Complete Flow Timeline

```
Start: User clicks "Request Resource"
├─ ~0.5s: Fetch resource details and 402 response
├─ ~0.2s: Calculate cost estimate
│
User clicks "Approve & Pay"
├─ ~1.0s: Wallet confirmation popup
├─ ~0.3s: User signs transaction
├─ ~0.5s: Send to backend
├─ ~2.0s: Stellar network broadcasts and confirms
│
✓ Complete: ~4-5 seconds total
```

## Implementation Components

### New Hook: `useX402Flow`

Location: `packages/frontend/src/hooks/useX402Flow.ts`

```typescript
const {
  step,                    // Current flow step: 'idle' | 'requesting' | 'signing' | 'processing' | 'complete'
  resourceId,              // Current resource being requested
  paymentDetails,          // Payment details from 402 response
  costEstimate,            // Calculated cost with fees
  txHash,                  // Transaction hash (on completion)
  error,                   // Error message (if any)
  elapsedSeconds,          // Time taken to complete payment
  canProceedToPayment,     // Boolean: ready to sign?
  isProcessing,            // Boolean: waiting for async operation?
  requestResource,         // Function: initiate resource request
  confirmPayment,          // Function: sign and process payment
  reset,                   // Function: reset flow to initial state
} = useX402Flow()
```

**Features:**
- Automatic elapsed time tracking
- Type-safe step transitions
- Built-in error handling with clear messages
- Visual progress through Stepper component

### Updated Component: `X402PaymentForm`

Location: `packages/frontend/src/components/X402/X402PaymentForm.tsx`

**Features:**
- 4-step visual Stepper showing flow progress
- Clear descriptions at each step
- Step-specific UI for each phase
- Real-time feedback during processing
- Transaction hash display on completion
- Easy reset to start new payment

**Props:** None (uses Redux wallet state and custom hook)

**Example Usage:**
```tsx
<X402PaymentForm />
```

## Error Handling

Common error scenarios and user feedback:

| Error | Handling |
|-------|----------|
| Resource not found | Display error, suggest valid resource IDs |
| Wallet not connected | Show "connect wallet" message |
| Insufficient balance | Display in review step |
| Wallet rejection | User-friendly message with retry option |
| Network timeout | Retry with exponential backoff |
| Transaction failed | Show error details, reset flow |

## Key Improvements Over Original Implementation

1. **Clear Step-by-Step Flow**
   - Visual Stepper component shows progress
   - Each step has clear purpose and instructions
   - No ambiguity about where user is in process

2. **Better State Management**
   - Centralized flow state in dedicated hook
   - No undefined variables or state conflicts
   - Proper TypeScript typing throughout

3. **Performance Optimization**
   - Parallel cost estimation during request
   - Minimal re-renders via React hooks
   - Optimized for 5-second target completion

4. **Enhanced UX**
   - Elapsed time tracking
   - Transaction hash display
   - Clear error messages
   - Easy restart capability
   - Progress visibility at all times

5. **Type Safety**
   - Removed loose `any` types
   - Proper TypeScript interfaces
   - Better IDE autocomplete support

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Wants to Access X402-Enabled Service                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   Request Resource   │
          │  (Enter resource ID) │
          └──────────┬───────────┘
                     │
                     ▼
     ┌───────────────────────────────────┐
     │ GET /x402/resource/:id            │
     │ Backend: Process request          │
     └─────────────────┬─────────────────┘
                       │
                       ▼
         ┌─────────────────────────────┐
         │ HTTP 402 Payment Required   │
         │ + Payment Details in Header │
         └──────────┬──────────────────┘
                    │
                    ▼
          ┌──────────────────────┐
          │  Review Payment      │
          │ (Verify amount, etc) │
          └──────────┬───────────┘
                     │
                     ▼
    ┌────────────────────────────────┐
    │ Sign Authorization             │
    │ (Wallet popup confirmation)    │
    └──────────────┬─────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────┐
    │ POST /x402/pay                   │
    │ Backend: Process payment         │
    │ Stellar: Broadcast transaction   │
    └──────────────┬──────────────────┘
                   │
                   ▼
        ┌────────────────────────┐
        │ ✓ Payment Complete!    │
        │ Resource accessible    │
        │ Total: ~5 seconds      │
        └────────────────────────┘
```

## Configuration

### Environment Variables
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_STELLAR_NETWORK=testnet
VITE_X402_DEFAULT_RESOURCE_ID=demo
```

### Network Selection
The hook uses the Wallet store's network setting:
- Testnet for development/testing
- Mainnet for production

## Testing the Flow

### Local Development

1. **Start backend:**
   ```bash
   cd packages/backend
   npm run dev
   ```

2. **Start frontend:**
   ```bash
   cd packages/frontend
   npm run dev
   ```

3. **Test x402 endpoint:**
   ```bash
   curl -i http://localhost:3001/api/x402/resource/test
   # Should return 402 with payment details
   ```

4. **Test full flow:**
   - Open http://localhost:3000
   - Connect wallet (Freighter, Albedo, etc.)
   - Navigate to X402 page
   - Enter resource ID: `test`
   - Click "Request Resource"
   - Review payment details
   - Click "Approve & Pay"
   - Confirm in wallet
   - Watch transaction complete

### Expected Timing (Testnet)
- Resource fetch: ~500ms
- Cost calculation: ~200ms
- User wallet confirmation: ~1000ms
- Payment processing: ~2000ms
- **Total: ~4-5 seconds**

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useX402Flow.ts` | NEW - Flow orchestration hook |
| `src/hooks/index.ts` | NEW - Hooks index export |
| `src/components/X402/X402PaymentForm.tsx` | Enhanced with Stepper and flow states |

## Related Documentation

- [X402 Specification](https://x402.org)
- [Stellar X402 Blog](https://stellar.org/blog/developers/x402)
- [Wallet Integration Guide](packages/frontend/src/components/Wallet/README.md)
- [Backend X402 Documentation](packages/backend/src/docs/X402_INTEGRATION.md)

## Future Enhancements

1. **Wallet Agnostic Flow**
   - Support additional wallet types
   - Detect wallet capabilities automatically

2. **Transaction Monitoring**
   - Real-time status updates via WebSocket
   - Better error recovery mechanisms

3. **Batch Payments**
   - Request multiple resources at once
   - Combine payments for efficiency

4. **Payment History Analytics**
   - Track payment patterns
   - Cost optimization suggestions

5. **Offline Support**
   - Queue payments for later submission
   - Sync when connection restored
