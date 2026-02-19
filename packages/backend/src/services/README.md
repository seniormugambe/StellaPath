# Service Layer Implementation

This directory contains the service layer implementation for the Stellar Smart Contract DApp backend. The service layer provides business logic and orchestration for all transaction types.

## Services

### TransactionManager
**File**: `TransactionManager.ts`

The central orchestrator for all transaction types, providing a unified interface for transaction management.

**Key Features**:
- Create basic Stellar transactions
- Validate addresses and balances
- Track transaction status
- Integrate with Stellar SDK for network communication
- Persist transaction records to database

**Main Methods**:
- `createBasicTransaction(params)` - Create and submit a basic transaction
- `getTransactionStatus(txHash)` - Get current status from Stellar network
- `getTransactionHistory(userId, filters, pagination)` - Retrieve transaction history
- `validateAddress(address)` - Validate Stellar address format and existence
- `validateBalance(accountId, amount)` - Check if account has sufficient balance

### EscrowService
**File**: `EscrowService.ts`

Manages conditional transactions with automated release mechanisms.

**Key Features**:
- Create escrow contracts with conditions
- Monitor and evaluate conditions (time-based, oracle-based, manual approval)
- Automatic fund release when conditions are met
- Automatic refund on timeout
- Integration with smart contract escrow functions

**Main Methods**:
- `createEscrow(params)` - Create a new escrow contract
- `checkConditions(escrowId)` - Evaluate all conditions for an escrow
- `releaseEscrow(escrowId)` - Release funds to recipient
- `refundEscrow(escrowId)` - Refund funds to sender
- `getEscrowDetails(escrowId)` - Get complete escrow information
- `processExpiredEscrows()` - Batch process expired escrows

**Condition Types**:
- `time_based` - Release after a specific time
- `oracle_based` - Release based on external oracle data (placeholder)
- `manual_approval` - Release after manual approval

### P2PHandler
**File**: `P2PHandler.ts`

Processes direct peer-to-peer transactions with minimal overhead.

**Key Features**:
- Direct payment processing
- Recipient validation
- Fee estimation
- Payment history tracking
- Real-time notifications

**Main Methods**:
- `sendPayment(params)` - Process a P2P payment
- `validateRecipient(address)` - Validate recipient address
- `estimateFees(amount)` - Calculate transaction fees
- `getPaymentHistory(userId, pagination)` - Retrieve payment history
- `getPaymentDetails(txHash)` - Get specific payment details

### InvoiceManager
**File**: `InvoiceManager.ts`

Handles invoice creation, approval workflows, and automated execution.

**Key Features**:
- Invoice creation and management
- Client approval workflow
- Automatic payment execution
- Invoice expiration handling
- Approval token generation and validation

**Main Methods**:
- `createInvoice(params)` - Create a new invoice
- `sendInvoice(invoiceId)` - Send invoice to client
- `approveInvoice(invoiceId, clientInfo)` - Approve an invoice
- `executeInvoice(invoiceId)` - Execute approved invoice payment
- `rejectInvoice(invoiceId, reason)` - Reject an invoice
- `validateApprovalToken(token)` - Validate approval token
- `processExpiredInvoices()` - Batch process expired invoices

## Configuration

Each service requires a configuration object:

### TransactionManagerConfig
```typescript
{
  networkPassphrase: string;  // Stellar network passphrase
  horizonUrl: string;         // Horizon server URL
  contractId?: string;        // Optional smart contract ID
}
```

### EscrowServiceConfig
```typescript
{
  networkPassphrase: string;  // Stellar network passphrase
  horizonUrl: string;         // Horizon server URL
  contractId: string;         // Smart contract ID for escrow
}
```

### P2PHandlerConfig
```typescript
{
  networkPassphrase: string;  // Stellar network passphrase
  horizonUrl: string;         // Horizon server URL
}
```

### InvoiceManagerConfig
```typescript
{
  networkPassphrase: string;  // Stellar network passphrase
  horizonUrl: string;         // Horizon server URL
  contractId?: string;        // Optional smart contract ID
  baseUrl: string;            // Base URL for approval links
}
```

## Usage Example

```typescript
import { PrismaClient } from '@prisma/client';
import { 
  TransactionManager, 
  EscrowService, 
  P2PHandler, 
  InvoiceManager 
} from './services';
import { 
  TransactionRepository, 
  EscrowRepository, 
  InvoiceRepository 
} from './repositories';

const prisma = new PrismaClient();

// Initialize repositories
const transactionRepo = new TransactionRepository(prisma);
const escrowRepo = new EscrowRepository(prisma);
const invoiceRepo = new InvoiceRepository(prisma);

// Initialize services
const transactionManager = new TransactionManager(transactionRepo, {
  networkPassphrase: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org'
});

const escrowService = new EscrowService(escrowRepo, transactionRepo, {
  networkPassphrase: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  contractId: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
});

const p2pHandler = new P2PHandler(transactionRepo, {
  networkPassphrase: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org'
});

const invoiceManager = new InvoiceManager(invoiceRepo, transactionRepo, {
  networkPassphrase: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  baseUrl: 'https://app.example.com'
});

// Use services
const result = await transactionManager.createBasicTransaction({
  userId: 'user123',
  sender: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  recipient: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
  amount: 100,
  memo: 'Payment for services'
});
```

## Integration with Controllers

These services are designed to be used by the controller layer. Controllers handle HTTP requests, validate input, call service methods, and format responses.

## Error Handling

All services return structured results with success/error information:

```typescript
interface Result {
  success: boolean;
  data?: any;
  error?: string;
}
```

Services log errors using the Winston logger but do not throw exceptions for business logic errors. Network and database errors may still throw and should be caught by the controller layer.

## Testing

Unit tests for services should mock:
- Repository methods
- Stellar SDK calls
- Logger calls

Integration tests should use:
- Test database
- Stellar testnet
- Real Stellar SDK calls

## Future Enhancements

- Implement oracle-based condition evaluation for escrows
- Add support for multi-signature transactions
- Implement transaction batching for efficiency
- Add support for custom assets beyond native XLM
- Implement webhook notifications for transaction events
