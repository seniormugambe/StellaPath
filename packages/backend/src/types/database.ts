import { 
  User as PrismaUser,
  InvoiceRecord as PrismaInvoiceRecord,
  TransactionRecord as PrismaTransactionRecord,
  EscrowRecord as PrismaEscrowRecord,
  NotificationRecord as PrismaNotificationRecord,
  TransactionType,
  TransactionStatus,
  InvoiceStatus,
  EscrowStatus,
  NotificationType
} from '@prisma/client';

// Re-export Prisma enums
export {
  TransactionType,
  TransactionStatus,
  InvoiceStatus,
  EscrowStatus,
  NotificationType
};

// Extended User type with parsed preferences
export interface User extends Omit<PrismaUser, 'preferences' | 'notificationSettings' | 'email' | 'displayName'> {
  email?: string;
  displayName?: string;
  preferences: UserPreferences;
  notificationSettings: NotificationSettings;
}

export interface UserPreferences {
  currency: string;
  timezone: string;
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface NotificationSettings {
  invoiceUpdates: boolean;
  transactionConfirmations: boolean;
  escrowUpdates: boolean;
  systemAlerts: boolean;
}

/** Partial that explicitly allows undefined values (compatible with exactOptionalPropertyTypes) */
type LoosePartial<T> = { [K in keyof T]?: T[K] | undefined };

// Extended Invoice type with parsed metadata
export interface InvoiceRecord extends Omit<PrismaInvoiceRecord, 'metadata'> {
  metadata: InvoiceMetadata;
}

export interface InvoiceMetadata {
  projectId?: string;
  hourlyRate?: number;
  hoursWorked?: number;
  clientName?: string;
  milestones?: string[];
  [key: string]: any;
}

// Extended Transaction type with parsed metadata
export interface TransactionRecord extends Omit<PrismaTransactionRecord, 'metadata'> {
  metadata: TransactionMetadata;
}

export interface TransactionMetadata {
  memo?: string;
  timestamp?: string;
  contractAddress?: string;
  gasUsed?: number;
  [key: string]: any;
}

// Extended Escrow type with parsed conditions
export interface EscrowRecord extends Omit<PrismaEscrowRecord, 'conditions'> {
  conditions: Condition[];
}

export interface Condition {
  type: 'time_based' | 'oracle_based' | 'manual_approval';
  parameters: Record<string, any>;
  validator: string;
}

// Extended Notification type with parsed metadata
export interface NotificationRecord extends Omit<PrismaNotificationRecord, 'metadata'> {
  metadata: NotificationMetadata;
}

export interface NotificationMetadata {
  transactionId?: string;
  invoiceId?: string;
  escrowId?: string;
  amount?: number;
  recipient?: string;
  clientEmail?: string;
  [key: string]: any;
}

// Additional types for API responses
export interface UserProfile {
  id: string;
  walletAddress: string;
  email?: string;
  displayName?: string;
  preferences: UserPreferences;
  notificationSettings: NotificationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicInvoice {
  id: string;
  amount: number;
  description: string;
  creatorName: string;
  dueDate: Date;
  status: InvoiceStatus;
  // Sensitive information excluded
}

export interface ClientInfo {
  name?: string;
  email: string;
  walletAddress?: string;
  approvalTimestamp: Date;
  ipAddress: string;
  userAgent: string;
}

export interface ApprovalResult {
  invoiceId: string;
  approved: boolean;
  clientInfo: ClientInfo;
  approvalToken: string;
  timestamp: Date;
}

export interface ConditionStatus {
  condition: Condition;
  met: boolean;
  checkedAt: Date;
  evidence?: string;
}

// Database query filters
export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  clientEmail?: string;
}

// Create request types
export interface CreateUserRequest {
  walletAddress: string;
  email?: string | undefined;
  displayName?: string | undefined;
  preferences?: LoosePartial<UserPreferences> | undefined;
  notificationSettings?: LoosePartial<NotificationSettings> | undefined;
}

export interface CreateInvoiceRequest {
  creatorId: string;
  clientEmail: string;
  amount: number;
  description: string;
  dueDate: Date;
  metadata?: InvoiceMetadata;
}

export interface CreateTransactionRequest {
  userId: string;
  type: TransactionType;
  txHash: string;
  amount: number;
  sender: string;
  recipient: string;
  fees?: number;
  metadata?: TransactionMetadata;
}

export interface CreateEscrowRequest {
  contractId: string;
  creatorId: string;
  recipientId?: string;
  amount: number;
  conditions: Condition[];
  expiresAt: Date;
}

export interface CreateNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: NotificationMetadata;
}

// Update request types
export interface UpdateUserRequest {
  email?: string | undefined;
  displayName?: string | undefined;
  preferences?: LoosePartial<UserPreferences> | undefined;
  notificationSettings?: LoosePartial<NotificationSettings> | undefined;
}

export interface UpdateTransactionStatusRequest {
  status: TransactionStatus;
  blockHeight?: number;
  metadata?: Partial<TransactionMetadata>;
}

export interface UpdateInvoiceStatusRequest {
  status: InvoiceStatus;
  approvedAt?: Date;
  executedAt?: Date;
  txHash?: string;
  metadata?: Partial<InvoiceMetadata>;
}

export interface UpdateEscrowStatusRequest {
  status: EscrowStatus;
  releasedAt?: Date;
  txHash?: string;
}

// Pagination types
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}