/**
 * Jest test setup for backend
 */

// Setup test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/stellar_dapp_test';
process.env['REDIS_URL'] = 'redis://localhost:6379/1';
process.env['JWT_SECRET'] = 'test-secret-key';

// Mock external services in tests
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../utils/logger', () => ({
  createLogger: () => mockLogger,
  logger: mockLogger,
}));

// Global test timeout
jest.setTimeout(10000);