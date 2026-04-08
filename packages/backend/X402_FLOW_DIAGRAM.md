# X402 Payment Flow Diagram

## Standard Payment Flow

```
┌─────────────┐                                    ┌─────────────┐
│             │                                    │             │
│  AI Agent   │                                    │   Server    │
│  or Client  │                                    │   (Your     │
│             │                                    │    API)     │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │  1. GET /api/x402/resource/weather              │
       │─────────────────────────────────────────────────>│
       │                                                  │
       │  2. 402 Payment Required                        │
       │     {                                            │
       │       "payment": {                               │
       │         "price": "$0.001",                       │
       │         "payTo": "GMERCHANT...",                 │
       │         "network": "stellar:testnet"             │
       │       }                                          │
       │     }                                            │
       │<─────────────────────────────────────────────────│
       │                                                  │
       │  3. POST /api/x402/pay                          │
       │     {                                            │
       │       "walletAddress": "GAGENT...",              │
       │       "amount": 0.001,                           │
       │       "payTo": "GMERCHANT...",                   │
       │       "asset": "USDC"                            │
       │     }                                            │
       │─────────────────────────────────────────────────>│
       │                                                  │
       │                                                  │  4. Submit to
       │                                                  │     Stellar
       │                                                  │─────────────┐
       │                                                  │             │
       │                                                  │             ▼
       │                                                  │     ┌───────────────┐
       │                                                  │     │               │
       │                                                  │     │    Stellar    │
       │                                                  │     │   Network     │
       │                                                  │     │               │
       │                                                  │     │  ~5 seconds   │
       │                                                  │     │   finality    │
       │                                                  │     │               │
       │                                                  │     └───────┬───────┘
       │                                                  │             │
       │                                                  │  5. Confirm │
       │                                                  │<────────────┘
       │                                                  │
       │  6. 200 OK                                      │
       │     {                                            │
       │       "success": true,                           │
       │       "txHash": "abc123..."                      │
       │     }                                            │
       │<─────────────────────────────────────────────────│
       │                                                  │
       │  7. GET /api/x402/resource/weather              │
       │     (with payment proof)                         │
       │─────────────────────────────────────────────────>│
       │                                                  │
       │  8. 200 OK + Resource Data                      │
       │     { "weather": "sunny, 72°F" }                 │
       │<─────────────────────────────────────────────────│
       │                                                  │
```

## Session-Based Payment Flow (v2)

```
┌─────────────┐                                    ┌─────────────┐
│             │                                    │             │
│  AI Agent   │                                    │   Server    │
│             │                                    │             │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │  1. POST /api/x402/session                      │
       │     {                                            │
       │       "maxSpend": 5.0,                           │
       │       "expiresIn": 3600,                         │
       │       "allowedResources": [...]                  │
       │     }                                            │
       │─────────────────────────────────────────────────>│
       │                                                  │
       │  2. Session Created                             │
       │     {                                            │
       │       "sessionId": "x402_123...",                │
       │       "maxSpend": 5.0,                           │
       │       "expiresAt": "2026-04-03T12:00:00Z"        │
       │     }                                            │
       │<─────────────────────────────────────────────────│
       │                                                  │
       │  3. Multiple Payments Within Session            │
       │     (Agent can autonomously pay up to $5)        │
       │                                                  │
       │  GET /resource/1 → Pay $0.001 → Access          │
       │  GET /resource/2 → Pay $0.002 → Access          │
       │  GET /resource/3 → Pay $0.001 → Access          │
       │  ...                                             │
       │  (continues until maxSpend or expiry)            │
       │                                                  │
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Application                      │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │                │  │                │  │              │  │
│  │  Controllers   │  │   Services     │  │  Middleware  │  │
│  │                │  │                │  │              │  │
│  │  x402          │──│  X402Service   │  │  x402        │  │
│  │  Controller    │  │                │  │  Middleware  │  │
│  │                │  │                │  │              │  │
│  └────────┬───────┘  └────────┬───────┘  └──────┬───────┘  │
│           │                   │                  │          │
└───────────┼───────────────────┼──────────────────┼──────────┘
            │                   │                  │
            │                   │                  │
            ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      Stellar Network                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │              │  │              │  │              │      │
│  │   Horizon    │  │   Soroban    │  │  OpenZeppelin│      │
│  │     API      │  │   RPC        │  │  Facilitator │      │
│  │              │  │              │  │   (optional) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │              Stellar Blockchain                       │   │
│  │              - USDC, PYUSD, USDY                      │   │
│  │              - ~5 second finality                     │   │
│  │              - $0.00001 fees                          │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Request
   │
   ▼
┌──────────────────┐
│  x402Middleware  │  ← Check if payment required
│  (optional)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  x402Controller  │  ← Handle HTTP request
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  X402Service     │  ← Business logic
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Stellar SDK     │  ← Build transaction
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Stellar Network │  ← Submit & settle
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Database        │  ← Record transaction
└────────┬─────────┘
         │
         ▼
      Response
```

## Payment States

```
┌─────────────┐
│   PENDING   │  ← Payment initiated
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SUBMITTING  │  ← Sent to Stellar
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐  ┌─────────────┐
│  CONFIRMED  │  │   FAILED    │
└─────────────┘  └─────────────┘
       │
       ▼
┌─────────────┐
│   VERIFIED  │  ← Access granted
└─────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
│                                                          │
│  1. Authentication (JWT)                                 │
│     └─> Verify user identity                             │
│                                                          │
│  2. Input Validation (Joi)                               │
│     └─> Validate request data                            │
│                                                          │
│  3. Rate Limiting                                        │
│     └─> Prevent abuse                                    │
│                                                          │
│  4. Payment Verification                                 │
│     └─> Confirm on-chain payment                         │
│                                                          │
│  5. Spending Limits (Smart Contracts)                    │
│     └─> Enforce budget controls                          │
│                                                          │
│  6. Session Management                                   │
│     └─> Track and limit spending                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Integration Points

```
Your Application
       │
       ├─> Express Routes (/api/x402/*)
       │   └─> x402Routes.ts
       │
       ├─> Controllers
       │   └─> x402Controller.ts
       │
       ├─> Services
       │   └─> X402Service.ts
       │
       ├─> Middleware
       │   └─> x402Middleware.ts
       │
       ├─> Validators
       │   └─> x402Validators.ts
       │
       └─> Database
           └─> TransactionRepository
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production Setup                      │
│                                                          │
│  ┌──────────────┐                                        │
│  │   Frontend   │                                        │
│  │   (React)    │                                        │
│  └──────┬───────┘                                        │
│         │                                                │
│         ▼                                                │
│  ┌──────────────┐      ┌──────────────┐                 │
│  │   Backend    │──────│  PostgreSQL  │                 │
│  │  (Express)   │      │   Database   │                 │
│  │              │      └──────────────┘                 │
│  │  + x402      │                                        │
│  │  Integration │      ┌──────────────┐                 │
│  │              │──────│    Redis     │                 │
│  └──────┬───────┘      │   (Cache)    │                 │
│         │              └──────────────┘                 │
│         │                                                │
│         ▼                                                │
│  ┌──────────────────────────────────┐                   │
│  │      Stellar Network             │                   │
│  │  - Horizon API                   │                   │
│  │  - Soroban RPC                   │                   │
│  │  - OpenZeppelin Facilitator      │                   │
│  └──────────────────────────────────┘                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Key Concepts

### 402 Status Code
HTTP status code meaning "Payment Required" - activated by x402 protocol

### Facilitator
Optional service (like OpenZeppelin) that abstracts blockchain complexity

### Session
Reusable payment authorization with spending limits

### Smart Wallet
Programmable wallet with built-in spending rules and policies

### Micropayment
Sub-dollar payment, often fractional cents

### Autonomous Payment
Payment authorized by AI agent without human intervention
