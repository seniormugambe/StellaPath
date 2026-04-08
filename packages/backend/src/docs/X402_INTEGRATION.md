# X402 Protocol Integration Guide

## Overview

This system now supports the **x402 protocol** - an open standard for internet-native payments that enables AI agents and applications to make autonomous micropayments on Stellar.

X402 activates the HTTP 402 "Payment Required" status code, allowing any API or service to charge per request without accounts, API keys, or billing systems.

## What is x402?

X402 is a payment protocol designed for the agent economy:

- **HTTP-native**: Payments embedded directly in HTTP requests
- **No accounts**: No signups, API keys, or subscriptions required
- **Autonomous**: AI agents can pay for services automatically
- **Micropayments**: Supports fractional-cent pricing at scale
- **Multi-chain**: Works across multiple blockchains (Stellar optimized)
- **Instant settlement**: Payments settle in ~5 seconds on Stellar

## Architecture

### Payment Flow

```
1. Client requests resource → GET /api/x402/resource/weather
2. Server responds with 402 → Payment Required + payment details
3. Client authorizes payment → POST /api/x402/pay
4. Payment settles on Stellar → ~5 seconds
5. Server grants access → Resource delivered
```

### Components

- **X402Service**: Core payment processing logic
- **X402Controller**: HTTP endpoints for x402 operations
- **X402Routes**: Express routes with validation
- **X402Validators**: Request validation schemas
- **OpenZeppelin Facilitator**: Handles blockchain complexity (optional)

## API Endpoints

### 1. Process Payment

**POST** `/api/x402/pay`

Authorize and process an x402 payment.

**Request:**
```json
{
  "walletAddress": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "resourceUrl": "/api/x402/resource/weather",
  "amount": 0.001,
  "payTo": "GMERCHANTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "asset": "USDC",
  "memo": "Weather API access"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "abc123...",
    "transaction": {
      "id": "tx_123",
      "type": "P2P",
      "amount": 0.001,
      "status": "CONFIRMED"
    }
  }
}
```

### 2. Request Resource (Returns 402)

**GET** `/api/x402/resource/:resourceId`

Request a paid resource. Returns 402 with payment details.

**Response (402):**
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_REQUIRED",
    "message": "Payment required to access this resource"
  },
  "payment": {
    "resourceUrl": "/api/x402/resource/weather",
    "price": "$0.001",
    "network": "stellar:testnet",
    "payTo": "GMERCHANTADDRESS...",
    "description": "Weather report"
  }
}
```

### 3. Verify Payment

**POST** `/api/x402/verify`

Verify that payment was made for a resource.

**Request:**
```json
{
  "resourceUrl": "/api/x402/resource/weather",
  "requiredAmount": 0.001
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "message": "Payment verified, access granted"
  }
}
```

### 4. Create Session (v2 Feature)

**POST** `/api/x402/session`

Create a reusable payment session with spending limits.

**Request:**
```json
{
  "maxSpend": 1.0,
  "expiresIn": 3600,
  "allowedResources": [
    "/api/x402/resource/weather",
    "/api/x402/resource/news"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "x402_1234567890_abc123",
    "expiresAt": "2026-04-03T12:00:00Z",
    "maxSpend": 1.0
  }
}
```

### 5. Payment History

**GET** `/api/x402/history?page=1&limit=20`

Get x402 payment history for authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "tx_123",
        "txHash": "abc123...",
        "amount": 0.001,
        "resourceUrl": "/api/x402/resource/weather",
        "timestamp": "2026-04-03T10:30:00Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

### 6. Estimate Cost

**GET** `/api/x402/estimate?amount=0.001`

Estimate total cost including network fees.

**Response:**
```json
{
  "success": true,
  "data": {
    "amount": 0.001,
    "networkFee": 0.00001,
    "totalCost": 0.00101
  }
}
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
# X402 Protocol Configuration
X402_MERCHANT_ADDRESS=GYOURSTELLARADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
X402_FACILITATOR_URL=https://relayer.openzeppelin.com
X402_DEFAULT_ASSET_CODE=USDC
X402_DEFAULT_ASSET_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
```

### Supported Assets

- **USDC**: Circle USD Coin (default)
- **PYUSD**: PayPal USD
- **USDY**: Ondo USD Yield
- **XLM**: Native Stellar Lumens

## Integration Examples

### Example 1: Protect an API Endpoint

```typescript
import { X402Service } from './services/X402Service';

// Configure resource
const resourceConfig = {
  path: '/api/weather',
  price: '$0.001',
  description: 'Weather API access',
  payTo: process.env.X402_MERCHANT_ADDRESS,
  network: 'stellar:testnet'
};

// Generate payment request
const paymentRequest = x402Service.generatePaymentRequest(resourceConfig);

// Return 402 response
res.status(402).json({
  error: 'Payment Required',
  payment: paymentRequest
});
```

### Example 2: AI Agent Payment Flow

```typescript
// Agent discovers resource
const response = await fetch('/api/x402/resource/weather');

if (response.status === 402) {
  const { payment } = await response.json();
  
  // Agent authorizes payment
  await fetch('/api/x402/pay', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer <token>' },
    body: JSON.stringify({
      walletAddress: agentWallet,
      resourceUrl: payment.resourceUrl,
      amount: parseFloat(payment.price.replace('$', '')),
      payTo: payment.payTo,
      asset: 'USDC'
    })
  });
  
  // Access resource after payment
  const weatherData = await fetch('/api/x402/resource/weather');
}
```

### Example 3: Session-Based Payments

```typescript
// Create session with spending limit
const session = await fetch('/api/x402/session', {
  method: 'POST',
  body: JSON.stringify({
    maxSpend: 5.0,
    expiresIn: 3600,
    allowedResources: ['/api/weather', '/api/news']
  })
});

// Make multiple payments within session
// Agent can autonomously pay up to $5 within 1 hour
```

## Why Stellar for x402?

Stellar is optimized for x402 payments:

1. **Fast Settlement**: ~5 second finality
2. **Low Fees**: ~$0.00001 per transaction
3. **Native Stablecoins**: USDC, PYUSD as first-class assets
4. **99.99% Uptime**: Reliable for autonomous agents
5. **Programmable**: Soroban smart contracts for spending limits
6. **Real-world Connectivity**: MoneyGram, Airtm integration

## Security Considerations

### Spending Limits

Use OpenZeppelin smart account contracts for programmable spending rules:

```typescript
// Configure smart wallet with limits
const smartWallet = {
  dailyLimit: 10.0,
  perTransactionLimit: 1.0,
  allowedMerchants: ['GMERCHANT1...', 'GMERCHANT2...']
};
```

### Payment Verification

Always verify payments before granting access:

```typescript
const isValid = await x402Service.verifyPayment(
  userId,
  resourceUrl,
  requiredAmount
);

if (!isValid) {
  return res.status(402).json({ error: 'Payment not verified' });
}
```

### Rate Limiting

Protect x402 endpoints with rate limiting:

```typescript
const x402Limiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 100 // 100 payments per minute
});

app.use('/api/x402/pay', x402Limiter);
```

## Testing

### Test Payment Flow

```bash
# 1. Request resource (get 402)
curl http://localhost:3001/api/x402/resource/test

# 2. Process payment
curl -X POST http://localhost:3001/api/x402/pay \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "GTEST...",
    "resourceUrl": "/api/x402/resource/test",
    "amount": 0.001,
    "payTo": "GMERCHANT...",
    "asset": "USDC"
  }'

# 3. Verify payment
curl -X POST http://localhost:3001/api/x402/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceUrl": "/api/x402/resource/test",
    "requiredAmount": 0.001
  }'
```

## Resources

- **Stellar x402 Docs**: https://developers.stellar.org/docs/build/apps/x402
- **x402 Protocol Spec**: https://x402.org
- **OpenZeppelin Facilitator**: https://docs.openzeppelin.com/relayer/guides/stellar-x402-facilitator-guide
- **Stellar Discord**: #x402 channel

## Roadmap

- [x] Basic x402 payment processing
- [x] Payment verification
- [x] Session support (v2)
- [x] Multi-asset support
- [ ] MCP integration for AI agents
- [ ] Smart wallet integration (OpenZeppelin)
- [ ] Multi-chain cost optimization
- [ ] Advanced spending policies

## Support

For questions or issues:
- Check the [x402 specification](https://x402.org)
- Join [Stellar Discord](https://discord.gg/stellar) #x402 channel
- Review [OpenZeppelin docs](https://docs.openzeppelin.com/relayer)
