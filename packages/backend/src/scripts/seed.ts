import { PrismaClient } from '@prisma/client';
import { TransactionType, TransactionStatus, InvoiceStatus, EscrowStatus, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create test users
  const user1 = await prisma.user.upsert({
    where: { walletAddress: 'GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO7GIBD7JBSV37DPMS2OJGKUSH' },
    update: {},
    create: {
      walletAddress: 'GCKFBEIYTKP6RCZNVPH73XL7XFWTEOAO7GIBD7JBSV37DPMS2OJGKUSH',
      email: 'alice@example.com',
      displayName: 'Alice Johnson',
      preferences: {
        currency: 'XLM',
        timezone: 'UTC',
        language: 'en',
        emailNotifications: true,
        pushNotifications: true
      },
      notificationSettings: {
        invoiceUpdates: true,
        transactionConfirmations: true,
        escrowUpdates: true,
        systemAlerts: true
      }
    }
  });

  const user2 = await prisma.user.upsert({
    where: { walletAddress: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37' },
    update: {},
    create: {
      walletAddress: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37',
      email: 'bob@example.com',
      displayName: 'Bob Smith',
      preferences: {
        currency: 'XLM',
        timezone: 'America/New_York',
        language: 'en',
        emailNotifications: false,
        pushNotifications: true
      },
      notificationSettings: {
        invoiceUpdates: true,
        transactionConfirmations: false,
        escrowUpdates: true,
        systemAlerts: false
      }
    }
  });

  console.log('✅ Created test users:', { user1: user1.id, user2: user2.id });

  // Create sample transactions
  const transaction1 = await prisma.transactionRecord.create({
    data: {
      userId: user1.id,
      type: TransactionType.BASIC,
      txHash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
      status: TransactionStatus.CONFIRMED,
      amount: 100.5,
      sender: user1.walletAddress,
      recipient: user2.walletAddress,
      blockHeight: 12345678,
      fees: 0.00001,
      metadata: {
        memo: 'Test payment from Alice to Bob',
        timestamp: new Date().toISOString()
      }
    }
  });

  const transaction2 = await prisma.transactionRecord.create({
    data: {
      userId: user2.id,
      type: TransactionType.P2P,
      txHash: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567',
      status: TransactionStatus.PENDING,
      amount: 50.25,
      sender: user2.walletAddress,
      recipient: user1.walletAddress,
      fees: 0.00001,
      metadata: {
        memo: 'P2P payment from Bob to Alice',
        timestamp: new Date().toISOString()
      }
    }
  });

  console.log('✅ Created sample transactions:', { transaction1: transaction1.id, transaction2: transaction2.id });

  // Create sample invoices
  const invoice1 = await prisma.invoiceRecord.create({
    data: {
      creatorId: user1.id,
      clientEmail: 'client1@example.com',
      amount: 250.75,
      description: 'Web development services - Q4 2024',
      status: InvoiceStatus.SENT,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      metadata: {
        projectId: 'proj_001',
        hourlyRate: 50,
        hoursWorked: 5.015,
        clientName: 'Acme Corp'
      }
    }
  });

  const invoice2 = await prisma.invoiceRecord.create({
    data: {
      creatorId: user2.id,
      clientEmail: 'client2@example.com',
      amount: 1000.00,
      description: 'Smart contract development and testing',
      status: InvoiceStatus.APPROVED,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      approvedAt: new Date(),
      metadata: {
        projectId: 'proj_002',
        milestones: ['Contract design', 'Implementation', 'Testing'],
        clientName: 'Stellar Foundation'
      }
    }
  });

  console.log('✅ Created sample invoices:', { invoice1: invoice1.id, invoice2: invoice2.id });

  // Create sample escrow records
  const escrow1 = await prisma.escrowRecord.create({
    data: {
      contractId: 'escrow_contract_001',
      creatorId: user1.id,
      recipientId: user2.id,
      amount: 500.00,
      status: EscrowStatus.ACTIVE,
      conditions: [
        {
          type: 'time_based',
          parameters: { releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
          validator: 'time_validator'
        },
        {
          type: 'manual_approval',
          parameters: { approverAddress: user1.walletAddress },
          validator: 'manual_validator'
        }
      ],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  });

  const escrow2 = await prisma.escrowRecord.create({
    data: {
      contractId: 'escrow_contract_002',
      creatorId: user2.id,
      amount: 750.50,
      status: EscrowStatus.CONDITIONS_MET,
      conditions: [
        {
          type: 'oracle_based',
          parameters: { oracleAddress: 'GORACLE123456789ABCDEF', condition: 'price_above_100' },
          validator: 'oracle_validator'
        }
      ],
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      releasedAt: new Date()
    }
  });

  console.log('✅ Created sample escrow records:', { escrow1: escrow1.id, escrow2: escrow2.id });

  // Create sample notifications
  const notification1 = await prisma.notificationRecord.create({
    data: {
      userId: user1.id,
      type: NotificationType.TRANSACTION_CONFIRMED,
      title: 'Transaction Confirmed',
      message: 'Your payment of 100.5 XLM to Bob Smith has been confirmed on the network.',
      actionUrl: `/transactions/${transaction1.id}`,
      metadata: {
        transactionId: transaction1.id,
        amount: 100.5,
        recipient: 'Bob Smith'
      }
    }
  });

  const notification2 = await prisma.notificationRecord.create({
    data: {
      userId: user2.id,
      type: NotificationType.INVOICE_APPROVED,
      title: 'Invoice Approved',
      message: 'Your invoice for $1,000.00 has been approved by the client.',
      read: true,
      actionUrl: `/invoices/${invoice2.id}`,
      metadata: {
        invoiceId: invoice2.id,
        amount: 1000.00,
        clientEmail: 'client2@example.com'
      }
    }
  });

  const notification3 = await prisma.notificationRecord.create({
    data: {
      userId: user1.id,
      type: NotificationType.ESCROW_RELEASED,
      title: 'Escrow Released',
      message: 'Escrow conditions have been met and funds have been released.',
      actionUrl: `/escrows/${escrow2.id}`,
      metadata: {
        escrowId: escrow2.id,
        amount: 750.50,
        recipient: user2.walletAddress
      }
    }
  });

  console.log('✅ Created sample notifications:', { 
    notification1: notification1.id, 
    notification2: notification2.id,
    notification3: notification3.id 
  });

  console.log('🎉 Database seeding completed successfully!');
  
  // Print summary
  const userCount = await prisma.user.count();
  const transactionCount = await prisma.transactionRecord.count();
  const invoiceCount = await prisma.invoiceRecord.count();
  const escrowCount = await prisma.escrowRecord.count();
  const notificationCount = await prisma.notificationRecord.count();

  console.log('\n📊 Database Summary:');
  console.log(`   Users: ${userCount}`);
  console.log(`   Transactions: ${transactionCount}`);
  console.log(`   Invoices: ${invoiceCount}`);
  console.log(`   Escrows: ${escrowCount}`);
  console.log(`   Notifications: ${notificationCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });