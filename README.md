# Stellar Smart Contract DApp

A comprehensive transaction management system built on the Stellar blockchain, providing secure and efficient handling of basic transactions, escrow services, peer-to-peer payments, and invoice management.

## 🌟 Features

- **Basic Transactions**: Send and receive payments on the Stellar network
- **Escrow Services**: Conditional payment workflows with smart-contract custody planned
- **P2P Payments**: Direct peer-to-peer transfers with minimal overhead
- **Invoice Management**: Create, send, and manage invoices with approval workflows
- **X402 Protocol**: AI agent payments and micropayments for the agent economy
- **Smart Contract Security**: Contract validation and property tests, with backend audit trails
- **Wallet Integration**: Support for Freighter and Albedo; WalletConnect scaffolding is present but disabled until fully configured

## 🏗️ Architecture

This project follows a monorepo structure with three main packages:

```
stellar-smart-contract-dapp/
├── packages/
│   ├── backend/          # Node.js/Express API server
│   ├── frontend/         # React/TypeScript web application
│   └── contracts/        # Rust/Soroban smart contracts
├── docker-compose.yml    # Local development environment
└── package.json          # Workspace configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Rust 1.71+ (for smart contracts)
- Soroban CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stellar-smart-contract-dapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Backend
   cp packages/backend/.env.example packages/backend/.env
   
   # Frontend
   cp packages/frontend/.env.example packages/frontend/.env
   
   # Contracts
   cp packages/contracts/.env.example packages/contracts/.env
   ```

4. **Start development environment**
   ```bash
   npm run setup
   ```

This will:
- Install all dependencies
- Start PostgreSQL and Redis containers
- Run database migrations
- Start the development servers

### Development Servers

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **pgAdmin** (optional): http://localhost:8080
- **Redis Commander** (optional): http://localhost:8081

## 📦 Package Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build all packages
- `npm run test` - Run tests across all packages
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services

### Backend (`packages/backend`)
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run test` - Run Jest tests
- `npm run db:migrate` - Run Prisma migrations
- `npm run db:seed` - Seed database with test data

### Frontend (`packages/frontend`)
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run Jest tests

### Smart Contracts (`packages/contracts`)
- `make build` - Build smart contracts
- `make test` - Run contract tests
- `make deploy-testnet` - Deploy to Stellar testnet
- `make setup-all` - Complete development setup

## 🔧 Configuration

### Environment Variables

#### Backend Configuration
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `STELLAR_NETWORK` - Stellar network (testnet/mainnet)
- `SOROBAN_RPC_URL` - Soroban RPC endpoint
- `RESEND_API_KEY` - Resend API key for notification emails

#### Frontend Configuration
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_STELLAR_NETWORK` - Stellar network configuration
- `VITE_SOROBAN_RPC_URL` - Soroban RPC endpoint

#### Smart Contract Configuration
- `SOROBAN_NETWORK_PASSPHRASE` - Network passphrase
- `DEPLOYER_SECRET_KEY` - Deployment account secret key

## 🧪 Testing

The project includes comprehensive testing with both unit tests and property-based tests:

```bash
# Run all tests
npm run test

# Run backend tests only
npm run test --workspace=backend

# Run frontend tests only
npm run test --workspace=frontend

# Run smart contract tests
cd packages/contracts && make test
```

### Property-Based Testing

The system includes property-based tests that validate correctness properties across all transaction types. These tests use:
- **fast-check** for TypeScript components
- **proptest** for Rust smart contracts

## 📚 API Documentation

Once the backend is running, API documentation is available at:
- Swagger UI: http://localhost:3001/api/docs
- OpenAPI JSON: http://localhost:3001/api/docs.json

## 🔒 Escrow Trust Model

The intended escrow model is trust-minimized: user funds should be controlled by a Stellar/Soroban smart contract, not by the backend server. In the complete flow, a user signs a wallet transaction that transfers funds into an escrow contract. The contract then releases funds to the recipient only when the configured conditions are met, or refunds them to the sender when the escrow expires.

Current implementation status:

- The backend creates escrow records, stores conditions, evaluates release/refund eligibility, records transaction hashes, and provides audit/history data.
- The Soroban contract package includes escrow state, condition checks, release/refund status transitions, and property-based tests.
- The current escrow contract code still marks actual token transfers as a planned integration step with comments such as “in real implementation, this would transfer funds to contract.”

Because of that, the current escrow workflow should be treated as orchestration and tracking until the contract token-transfer path is fully wired into the frontend and backend. A production-grade trustless escrow release requires:

- Wallet-signed funding transaction from the sender.
- On-chain transfer of funds into the escrow contract.
- On-chain release/refund transaction after conditions or expiry are verified.
- Backend status updates only after confirmed on-chain transaction hashes.

Until those pieces are connected and deployed, users should not assume funds are actually locked by the escrow contract.

## 🔐 Security

The system implements multiple security layers:
- Smart contract validation and property-based tests
- JWT-based authentication with wallet signatures
- Input validation and sanitization
- Rate limiting and CORS protection
- Comprehensive audit logging

## 🚢 Deployment

### Development
```bash
npm run docker:up
npm run dev
```

### Production
1. Build all packages: `npm run build`
2. Deploy smart contracts: `cd packages/contracts && make deploy-mainnet`
3. Deploy backend and frontend to your hosting platform
4. Update environment variables with production values

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in each package's README
- Review the API documentation at `/api/docs`

## 🗺️ Roadmap

- [x] X402 protocol integration for AI agent payments
- [ ] MCP integration for AI agent discovery
- [ ] Multi-signature wallet support
- [ ] Wire escrow funding, release, and refund to on-chain Soroban token transfers
- [ ] Advanced escrow conditions (oracles, time locks)
- [ ] Mobile application
- [ ] Integration with additional Stellar wallets
- [ ] Advanced analytics and reporting
- [ ] Multi-language support

## 🤖 X402 Protocol Support

This system supports the **x402 protocol** for AI agent payments and micropayments on Stellar. X402 enables:

- HTTP-native payments without accounts or API keys
- Autonomous AI agent payments
- Micropayments with sub-cent pricing
- ~5 second settlement on Stellar
- Programmable spending limits

See [X402 Integration Guide](packages/backend/src/docs/X402_INTEGRATION.md) for details.

# StellaPath
