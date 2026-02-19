import { PrismaClient } from '@prisma/client';
import { 
  User, 
  UserProfile, 
  CreateUserRequest, 
  UpdateUserRequest,
  UserPreferences,
  NotificationSettings
} from '../types/database';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateUserRequest): Promise<User> {
    const userData: any = {
      walletAddress: data.walletAddress,
      email: data.email || null,
      displayName: data.displayName || null,
      preferences: data.preferences || this.getDefaultPreferences(),
      notificationSettings: data.notificationSettings || this.getDefaultNotificationSettings()
    };

    const user = await this.prisma.user.create({
      data: userData
    });

    return this.mapToUser(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id }
    });

    return user ? this.mapToUser(user) : null;
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress }
    });

    return user ? this.mapToUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { email }
    });

    return user ? this.mapToUser(user) : null;
  }

  async update(id: string, data: UpdateUserRequest): Promise<User> {
    const updateData: any = {};

    if (data.email !== undefined) updateData.email = data.email;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.preferences) updateData.preferences = data.preferences;
    if (data.notificationSettings) updateData.notificationSettings = data.notificationSettings;

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData
    });

    return this.mapToUser(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id }
    });
  }

  async list(limit = 50, offset = 0): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' }
    });

    return users.map(user => this.mapToUser(user));
  }

  async count(): Promise<number> {
    return await this.prisma.user.count();
  }

  async getUserProfile(id: string): Promise<UserProfile | null> {
    const user = await this.findById(id);
    if (!user) return null;

    const profile: UserProfile = {
      id: user.id,
      walletAddress: user.walletAddress,
      preferences: user.preferences,
      notificationSettings: user.notificationSettings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    if (user.email) profile.email = user.email;
    if (user.displayName) profile.displayName = user.displayName;

    return profile;
  }

  private mapToUser(user: any): User {
    const mappedUser: User = {
      id: user.id,
      walletAddress: user.walletAddress,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      preferences: typeof user.preferences === 'string' 
        ? JSON.parse(user.preferences) 
        : user.preferences,
      notificationSettings: typeof user.notificationSettings === 'string'
        ? JSON.parse(user.notificationSettings)
        : user.notificationSettings
    };

    if (user.email) mappedUser.email = user.email;
    if (user.displayName) mappedUser.displayName = user.displayName;

    return mappedUser;
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      currency: 'XLM',
      timezone: 'UTC',
      language: 'en',
      emailNotifications: true,
      pushNotifications: true
    };
  }

  private getDefaultNotificationSettings(): NotificationSettings {
    return {
      invoiceUpdates: true,
      transactionConfirmations: true,
      escrowUpdates: true,
      systemAlerts: true
    };
  }
}