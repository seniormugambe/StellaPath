/**
 * Stellar Smart Contract DApp Backend Server
 * 
 * Main entry point for the Express.js API server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { createLogger } from './utils/logger';
import {
  requestLogger,
  errorHandler,
  notFoundHandler,
  sanitizeInput,
  auditLogger,
} from './middleware';
import userRoutes from './routes/userRoutes';
import transactionRoutes from './routes/transactionRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import escrowRoutes from './routes/escrowRoutes';

// Load environment variables
dotenv.config();

const app = express();
const logger = createLogger();
const PORT = process.env['PORT'] || 3001;

// Security middleware — comprehensive CSP and headers (Req 5.3, 5.4)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://horizon-testnet.stellar.org', 'https://soroban-testnet.stellar.org'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // allow Stellar SDK requests
}));

app.use(cors({
  origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
  max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.', recovery: 'Wait a moment before retrying.' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Stricter rate limiting for auth and mutation-heavy endpoints (DDoS protection)
const strictLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests to this endpoint.', recovery: 'Please wait before trying again.' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/users/auth', strictLimiter);
app.use('/api/invoices/approve', strictLimiter);
app.use('/api/invoices/reject', strictLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization — runs after body parsing, before routes (Req 5.4)
app.use(sanitizeInput);

// Request logging
app.use(requestLogger);

// Audit logging for transaction-related mutations (Req 5.5, 8.5)
app.use(auditLogger);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env['NODE_ENV'] || 'development',
  });
});

// API documentation (Swagger UI)
// Load the OpenAPI spec and serve Swagger UI at /api/docs
const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
app.use(
  '/api/docs',
  // Relax CSP for Swagger UI assets (inline scripts/styles)
  (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    );
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'Stellar DApp API Docs',
  }),
);

// API routes
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/escrows', escrowRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
if (process.env['NODE_ENV'] !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Stellar DApp Backend Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
    logger.info(`CORS Origin: ${process.env['CORS_ORIGIN'] || 'http://localhost:3000'}`);
  });
}

export default app;
