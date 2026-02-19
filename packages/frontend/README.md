# Stellar Smart Contract DApp - Frontend

React-based frontend application for the Stellar Smart Contract DApp, providing a comprehensive user interface for transaction management on the Stellar blockchain.

## Features

- **Wallet Integration**: Support for Freighter, Albedo, Rabet, and WalletConnect
- **Transaction Management**: Create and track basic transactions, escrow, P2P payments, and invoices
- **Real-time Updates**: Live transaction status updates and notifications
- **Responsive Design**: Material-UI components with mobile-first approach
- **Type Safety**: Full TypeScript implementation with strict type checking
- **State Management**: Redux Toolkit for predictable state management
- **Routing**: React Router for seamless navigation

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Material-UI (MUI) v5
- **State Management**: Redux Toolkit with React-Redux
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors
- **Form Handling**: React Hook Form with Zod validation
- **Stellar Integration**: Stellar SDK and Freighter API
- **Testing**: Jest with React Testing Library and fast-check for property-based testing

## Project Structure

```
src/
├── components/        # Reusable UI components
│   └── Layout/       # Layout components (Header, Footer, etc.)
├── constants/        # Application constants and configuration
├── store/            # Redux store configuration
│   ├── slices/      # Redux slices (wallet, transactions, etc.)
│   └── hooks.ts     # Typed Redux hooks
├── types/            # TypeScript type definitions
├── utils/            # Utility functions and helpers
│   └── api.ts       # API client configuration
├── App.tsx           # Main application component
└── main.tsx          # Application entry point
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running on port 3001 (or configured in .env)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment configuration:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Building

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Linting

Check code quality:
```bash
npm run lint
```

Fix linting issues:
```bash
npm run lint:fix
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3001` |
| `VITE_STELLAR_NETWORK` | Stellar network (testnet/mainnet) | `testnet` |
| `VITE_STELLAR_HORIZON_URL` | Horizon server URL | `https://horizon-testnet.stellar.org` |
| `VITE_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `VITE_APP_NAME` | Application name | `Stellar DApp` |

### Redux Store

The application uses Redux Toolkit for state management with the following slices:

- **wallet**: Wallet connection state and user account information
- **transactions**: Transaction history, filters, and real-time updates

### API Client

The API client (`src/utils/api.ts`) provides:
- Automatic JWT token injection
- Request/response interceptors
- Error handling and transformation
- Type-safe API calls

## Development Guidelines

### Component Structure

- Use functional components with hooks
- Implement proper TypeScript typing
- Follow Material-UI theming conventions
- Keep components focused and reusable

### State Management

- Use Redux for global state (wallet, transactions)
- Use local state for component-specific data
- Leverage Redux Toolkit's `createSlice` for reducers
- Use typed hooks (`useAppDispatch`, `useAppSelector`)

### Styling

- Use Material-UI's `sx` prop for component styling
- Follow the theme configuration in `main.tsx`
- Maintain responsive design principles
- Use consistent spacing and typography

### Type Safety

- Define interfaces for all data structures
- Use strict TypeScript configuration
- Avoid `any` types
- Export types from `src/types/index.ts`

## Wallet Integration

The application supports multiple Stellar wallets:

1. **Freighter**: Browser extension wallet
2. **Albedo**: Web-based wallet
3. **Rabet**: Browser extension wallet
4. **WalletConnect**: Mobile wallet connection

Wallet integration will be implemented in task 9.2.

## Routing

Application routes:

- `/` - Home page
- `/dashboard` - User dashboard
- `/transactions` - Transaction history and management
- `/escrow` - Escrow creation and monitoring
- `/invoices` - Invoice management
- `/p2p` - Peer-to-peer payments
- `/client/*` - Client portal for invoice approval

## Contributing

1. Follow the existing code structure and conventions
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before committing
5. Use conventional commit messages

## License

Part of the Stellar Smart Contract DApp project.
