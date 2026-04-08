/**
 * X402 Integration Examples
 * 
 * This file demonstrates how to use the x402 protocol in your application
 */

import { X402Service } from '../services/X402Service';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { prisma } from '../utils/database';

// Initialize services
const transactionRepository = new TransactionRepository(prisma);
const userRepository = new UserRepository(prisma);

const x402Service = new X402Service(
  transactionRepository,
  userRepository,
  {
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    facilitatorUrl: 'https://relayer.openzeppelin.com',
    defaultAsset: {
      code: 'USDC',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    }
  }
);

/**
 * Example 1: Process a simple x402 payment
 */
async function example1_SimplePayment() {
  const result = await x402Service.processPayment({
    userId: 'user_123',
    walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    resourceUrl: '/api/weather',
    amount: 0.001,
    payTo: 'GMERCHANTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    asset: 'USDC',
    memo: 'Weather API access'
  });

  if (result.success) {
    console.log('Payment successful!');
    console.log('Transaction hash:', result.txHash);
    console.log('Transaction:', result.transaction);
  } else {
    console.error('Payment failed:', result.error);
  }
}

/**
 * Example 2: Generate payment request (402 response)
 */
function example2_GeneratePaymentRequest() {
  const paymentRequest = x402Service.generatePaymentRequest({
    path: '/api/weather',
    price: '$0.001',
    description: 'Real-time weather data',
    payTo: 'GMERCHANTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    network: 'stellar:testnet'
  });

  console.log('Payment request:', paymentRequest);
  
  // Return this in a 402 response:
  // res.status(402).json({
  //   error: 'Payment Required',
  //   payment: paymentRequest
  // });
}

/**
 * Example 3: Verify payment before granting access
 */
async function example3_VerifyPayment() {
  const isValid = await x402Service.verifyPayment(
    'user_123',
    '/api/weather',
    0.001
  );

  if (isValid) {
    console.log('Payment verified! Granting access...');
    // Grant access to resource
  } else {
    console.log('Payment not found or invalid');
    // Return 402 Payment Required
  }
}

/**
 * Example 4: Create a reusable session
 */
async function example4_CreateSession() {
  const result = await x402Service.createSession({
    sessionId: 'session_abc123',
    userId: 'user_123',
    maxSpend: 5.0,
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
    allowedResources: ['/api/weather', '/api/news']
  });

  if (result.success) {
    console.log('Session created:', result.sessionId);
    // Agent can now make multiple payments up to $5 within 1 hour
  }
}

/**
 * Example 5: Get payment history
 */
async function example5_PaymentHistory() {
  const history = await x402Service.getPaymentHistory('user_123', {
    page: 1,
    limit: 10
  });

  console.log('Payment history:');
  history.forEach(payment => {
    const metadata = payment.metadata as { resourceUrl?: string };
    console.log(`- ${payment.amount} USDC for ${metadata.resourceUrl}`);
    console.log(`  TX: ${payment.txHash}`);
    console.log(`  Time: ${payment.timestamp}`);
  });
}

/**
 * Example 6: Estimate payment cost
 */
async function example6_EstimateCost() {
  const estimate = await x402Service.estimateCost(0.001);

  console.log('Cost estimate:');
  console.log(`- Payment amount: $${estimate.amount}`);
  console.log(`- Network fee: $${estimate.networkFee}`);
  console.log(`- Total cost: $${estimate.totalCost}`);
}

/**
 * Example 7: AI Agent autonomous payment flow
 */
async function example7_AgentFlow() {
  console.log('AI Agent Payment Flow:');
  
  // Step 1: Agent discovers resource
  console.log('1. Agent requests resource...');
  const paymentRequest = x402Service.generatePaymentRequest({
    path: '/api/weather',
    price: '$0.001',
    description: 'Weather data',
    payTo: 'GMERCHANTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    network: 'stellar:testnet'
  });
  console.log('   Server responds with 402:', paymentRequest);

  // Step 2: Agent checks spending limits
  console.log('2. Agent checks spending limits...');
  const estimate = await x402Service.estimateCost(0.001);
  console.log(`   Total cost: $${estimate.totalCost}`);

  // Step 3: Agent authorizes payment
  console.log('3. Agent authorizes payment...');
  const result = await x402Service.processPayment({
    userId: 'agent_ai_123',
    walletAddress: 'GAGENTWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    resourceUrl: paymentRequest.resourceUrl,
    amount: parseFloat(paymentRequest.price.replace('$', '')),
    payTo: paymentRequest.payTo,
    asset: 'USDC'
  });

  if (result.success) {
    console.log('4. Payment confirmed:', result.txHash);
    console.log('5. Agent accesses resource');
    // Agent can now access the weather data
  }
}

/**
 * Example 8: Protect Express endpoint with x402
 */
function example8_ProtectEndpoint() {
  // In your Express route:
  /*
  import { requireX402Payment } from '../middleware/x402Middleware';

  app.get('/api/weather', 
    requireX402Payment({
      price: 0.001,
      asset: 'USDC',
      description: 'Weather API access',
      merchantAddress: process.env.X402_MERCHANT_ADDRESS
    }),
    weatherController
  );
  */

  console.log('See x402Middleware.ts for endpoint protection examples');
}

// Run examples (uncomment to test)
// example1_SimplePayment();
// example2_GeneratePaymentRequest();
// example3_VerifyPayment();
// example4_CreateSession();
// example5_PaymentHistory();
// example6_EstimateCost();
// example7_AgentFlow();
// example8_ProtectEndpoint();

export {
  example1_SimplePayment,
  example2_GeneratePaymentRequest,
  example3_VerifyPayment,
  example4_CreateSession,
  example5_PaymentHistory,
  example6_EstimateCost,
  example7_AgentFlow,
  example8_ProtectEndpoint
};
