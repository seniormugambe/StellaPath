# Wallet Integration

This directory contains the wallet integration components for the Stellar Smart Contract DApp. The implementation supports multiple wallet types and provides a unified interface for wallet connection and transaction signing.

## Features

- **Multi-Wallet Support**: Freighter, Albedo, and WalletConnect (partial)
- **Secure Connection**: Validates wallet connections and Stellar addresses
- **Transaction Signing**: User-friendly transaction signing interface
- **Session Management**: Proper cleanup on disconnect
- **Error Handling**: Comprehensive error messages and recovery

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 6.1**: Secure wallet connection with validation
- **Requirement 6.2**: Transaction signing with user authorization
- **Requirement 6.3**: Stellar address validation
- **Requirement 6.4**: Session cleanup on disconnect
- **Requirement 6.5**: Display transaction details before approval

## Components

### WalletButton

Main button component for wallet connection/disconnection.

```tsx
import { WalletButton } from './components/Wallet'

<WalletButton />
```

### WalletSelectionDialog

Dialog for selecting and connecting to a wallet.

```tsx
import { WalletSelectionDialog } from './components/Wallet'

<WalletSelectionDialog
  open={open}
  onClose={() => setOpen(false)}
/>
```

### TransactionSigner

Component for signing transactions with user confirmation.

```tsx
import { TransactionSigner } from './components/Wallet'

<TransactionSigner
  open={open}
  request={signatureRequest}
  onClose={() => setOpen(false)}
  onSuccess={(signedXdr) => console.log('Signed:', signedXdr)}
  onError={(error) => console.error('Error:', error)}
/>
```

## Hooks

### useWallet

Custom React hook for wallet management.

```tsx
import { useWallet } from '../../hooks/useWallet'

const MyComponent = () => {
  const {
    connected,
    accountId,
    publicKey,
    network,
    walletType,
    isConnecting,
    error,
    availableWallets,
    connect,
    disconnect,
    signTransaction,
    clearError,
  } = useWallet()

  // Use wallet functionality
}
```

## Wallet Utilities

### WalletManager

Unified interface for all wallet types.

```typescript
import { WalletManager } from '../utils/wallets'

// Get available wallets
const wallets = await WalletManager.getAvailableWallets()

// Connect to a wallet
const connection = await WalletManager.connect('freighter')

// Sign a transaction
const signedXdr = await WalletManager.signTransaction('freighter', {
  transaction: xdr,
  accountId: account,
  network: 'testnet',
  metadata: {
    description: 'Payment',
    amount: 100,
    recipient: 'GDEST...',
  },
})

// Disconnect
await WalletManager.disconnect('freighter')
```

### Individual Wallet Adapters

Each wallet has its own adapter:

- `FreighterWallet`: Browser extension wallet
- `AlbedoWallet`: Web-based wallet
- `WalletConnectWallet`: Mobile wallet connection (partial implementation)

## Supported Wallets

### Freighter

**Status**: ✅ Fully Implemented

Freighter is a browser extension wallet for Stellar. It provides the best user experience for desktop users.

**Installation**: [Freighter Extension](https://www.freighter.app/)

### Albedo

**Status**: ✅ Fully Implemented

Albedo is a web-based wallet that doesn't require installation. It's loaded dynamically from CDN.

**Website**: [Albedo](https://albedo.link/)

### WalletConnect

**Status**: ⚠️ Partial Implementation

WalletConnect support is partially implemented. Full implementation requires:

```bash
npm install @walletconnect/client @walletconnect/qrcode-modal
```

The interface is ready, but the actual WalletConnect integration needs the above packages.

## Usage Example

```tsx
import { useWallet } from '../../hooks/useWallet'
import { WalletButton } from './components/Wallet'

function MyApp() {
  const { connected, signTransaction } = useWallet()

  const handlePayment = async () => {
    if (!connected) {
      alert('Please connect your wallet')
      return
    }

    try {
      const signedXdr = await signTransaction({
        transaction: buildTransactionXdr(),
        accountId: myAccount,
        network: 'testnet',
        metadata: {
          description: 'Payment to merchant',
          amount: 50,
          recipient: merchantAddress,
        },
      })

      // Submit signed transaction to network
      await submitTransaction(signedXdr)
    } catch (error) {
      console.error('Payment failed:', error)
    }
  }

  return (
    <div>
      <WalletButton />
      {connected && (
        <button onClick={handlePayment}>
          Make Payment
        </button>
      )}
    </div>
  )
}
```

## Testing

Unit tests are provided in `src/test/walletIntegration.test.ts`:

```bash
npm test -- walletIntegration.test.ts
```

Tests cover:
- Wallet availability detection
- Connection validation
- Address validation
- Transaction signing interface
- Error handling
- Network support

## Security Considerations

1. **Address Validation**: All Stellar addresses are validated before use
2. **User Authorization**: All transactions require explicit user approval
3. **Session Management**: Wallet sessions are properly cleaned up on disconnect
4. **Error Handling**: Comprehensive error handling prevents security issues
5. **Transaction Details**: Users see full transaction details before signing

## Future Enhancements

1. **WalletConnect Full Implementation**: Complete WalletConnect integration
2. **Hardware Wallet Support**: Add Ledger support
3. **Multi-Account Support**: Allow users to switch between accounts
4. **Transaction History**: Track signed transactions
5. **Network Switching**: Allow users to switch between testnet and mainnet

## Troubleshooting

### Wallet Not Detected

If a wallet is not detected:
1. Ensure the wallet extension is installed (for Freighter)
2. Check browser compatibility
3. Refresh the page
4. Check browser console for errors

### Connection Failed

If connection fails:
1. Check that the wallet is unlocked
2. Verify network connectivity
3. Try disconnecting and reconnecting
4. Check wallet extension permissions

### Signing Failed

If transaction signing fails:
1. Ensure wallet is still connected
2. Check transaction XDR is valid
3. Verify account has sufficient balance
4. Check network matches wallet network

## API Reference

See the TypeScript interfaces in `src/types/index.ts` for complete API documentation.
