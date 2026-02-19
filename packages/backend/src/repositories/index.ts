export { UserRepository } from './UserRepository';
export { TransactionRepository } from './TransactionRepository';
export { InvoiceRepository } from './InvoiceRepository';
export { EscrowRepository } from './EscrowRepository';
export { NotificationRepository } from './NotificationRepository';

// Repository factory for dependency injection
import { PrismaClient } from '@prisma/client';
import { UserRepository } from './UserRepository';
import { TransactionRepository } from './TransactionRepository';
import { InvoiceRepository } from './InvoiceRepository';
import { EscrowRepository } from './EscrowRepository';
import { NotificationRepository } from './NotificationRepository';

export interface Repositories {
  user: UserRepository;
  transaction: TransactionRepository;
  invoice: InvoiceRepository;
  escrow: EscrowRepository;
  notification: NotificationRepository;
}

export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    user: new UserRepository(prisma),
    transaction: new TransactionRepository(prisma),
    invoice: new InvoiceRepository(prisma),
    escrow: new EscrowRepository(prisma),
    notification: new NotificationRepository(prisma)
  };
}

// Singleton instance for easy access
let repositories: Repositories | null = null;

export function getRepositories(prisma?: PrismaClient): Repositories {
  if (!repositories) {
    if (!prisma) {
      throw new Error('Prisma client must be provided for first initialization');
    }
    repositories = createRepositories(prisma);
  }
  return repositories;
}

export function resetRepositories(): void {
  repositories = null;
}