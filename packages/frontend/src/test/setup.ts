import '@testing-library/jest-dom'

// Mock import.meta.env
;(global as any).importMeta = {
  env: {
    VITE_API_BASE_URL: 'http://localhost:3001',
    VITE_CLIENT_PORTAL_URL: 'http://localhost:3000/client',
    VITE_STELLAR_NETWORK: 'testnet',
    VITE_STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
    VITE_STELLAR_PASSPHRASE: 'Test SDF Network ; September 2015',
    VITE_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    VITE_SOROBAN_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    VITE_APP_NAME: 'Stellar DApp',
    VITE_APP_VERSION: '1.0.0',
    VITE_ENABLE_TESTNET: 'true',
    VITE_ENABLE_MAINNET: 'false',
    VITE_ENABLE_DEBUG_MODE: 'true',
  },
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
} as any

// Suppress console errors in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
