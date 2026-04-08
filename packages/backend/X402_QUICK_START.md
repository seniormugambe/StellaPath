# X402 Quick Start Guide

## What is X402?

X402 is an open protocol for HTTP-native payments that enables AI agents to pay for APIs and services autonomously. Built on Stellar for fast, low-cost settlements.

## Setup (5 minutes)

### 1. Configure Environment

Add to `packages/backend/.env`:

```bash
X402_MERCHANT_ADDRESS=your-stellar-address
X402_FACILITATOR_URL=https://relayer.openzeppelin.com
X402_DEFAULT_ASSET_CODE=USDC
X402_DEFAULT_ASSET_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
```

### 2. Start Server

```bash
cd packages/backend
npm run dev
```

The x402 endpoints are now available at `/api/x402/*`

## Quick Test

### Test Payment Flow

```bash
# 1. Request a resource (returns 402)
curl http://localhost:3001/api/x402/resource/test

# Response:
# {
#   "success": false,
#   "error": { "code": "PAYMENT_REQUIRED" },
#   "payment": {
#     "resourceUrl": "/api/x402/resource/test",
#     "price": "$0.001",
#     "network": "stellar:testnet",
#     "payTo": "GMERCHANT..."
#   }
# }

# 2. Process payment
curl -X POST http://localhost:3001/api/x402/pay \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "GYOUR_WALLET...",
    "resourceUrl": "/api/x402/resource/test",
    "amount": 0.001,
    "payTo": "GMERCHANT...",
    "asset": "USDC"
  }'

# 3. View payment history
curl http://localhost:3001/api/x402/history \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/x402/pay` | POST | Process payment |
| `/api/x402/resource/:id` | GET | Request resource (returns 402) |
| `/api/x402/verify` | POST | Verify payment |
| `/api/x402/session` | POST | Create payment session |
| `/api/x402/history` | GET | Get payment history |
| `/api/x402/estimate` | GET | Estimate cost |

## Code Examples

### Protect an Endpoint

```typescript
import { requireX402Payment } from './middleware/x402Middleware';

app.get('/api/weather', 
  requireX402Payment(0.001), // $0.001 per request
  weatherController
);
```

### Process Payment

```typescript
import { X402Service } from './services/X402Service';

const result = await x402Service.processPayment({
  userId: 'user_123',
  walletAddress: 'GWALLET...',
  resourceUrl: '/api/weather',
  amount: 0.001,
  payTo: 'GMERCHANT...',
  asset: 'USDC'
});
```

### AI Agent Flow

```typescript
// 1. Agent requests resource
const response = await fetch('/api/x402/resource/weather');

// 2. Server returns 402 with payment details
if (response.status === 402) {
  const { payment } = await response.json();
  
  // 3. Agent authorizes payment
  await fetch('/api/x402/pay', {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: agentWallet,
      resourceUrl: payment.resourceUrl,
      amount: parseFloat(payment.price.replace('$', '')),
      payTo: payment.payTo
    })
  });
  
  // 4. Access resource
  const data = await fetch('/api/x402/resource/weather');
}
```

## Key Features

✅ **No accounts** - No signups or API keys required  
✅ **Instant** - ~5 second settlement on Stellar  
✅ **Low cost** - ~$0.00001 network fees  
✅ **Autonomous** - AI agents can pay automatically  
✅ **Micropayments** - Support for sub-cent pricing  
✅ **Multi-asset** - USDC, PYUSD, USDY, XLM  

## Resources

- **Full Documentation**: [X402_INTEGRATION.md](src/docs/X402_INTEGRATION.md)
- **Code Examples**: [x402Example.ts](src/examples/x402Example.ts)
- **Stellar x402 Docs**: https://stellar.org/x402
- **Protocol Spec**: https://x402.org
- **OpenZeppelin Facilitator**: https://docs.openzeppelin.com/relayer

## Support

- Stellar Discord: #x402 channel
- GitHub Issues: Report bugs or request features
- Documentation: Check the integration guide

## Next Steps

1. ✅ Configure environment variables
2. ✅ Test payment flow with curl
3. 🔲 Protect your API endpoints
4. 🔲 Integrate with AI agents
5. 🔲 Deploy to production

---

**Ready to build the agent economy? Start accepting x402 payments today!** 🚀
