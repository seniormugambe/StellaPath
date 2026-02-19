import { PrismaClient } from '@prisma/client';
import { 
  NotificationRecord, 
  CreateNotificationRequest,
  NotificationType,
  PaginationOptions,
  PaginatedResponse
} from '../types/database';

export class NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateNotificationRequest): Promise<NotificationRecord> {
    const notification = await this.prisma.notificationRecord.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl ?? null,
        metadata: data.metadata || {}
      },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return this.mapToNotification(notification);
  }

  async findById(id: string): Promise<NotificationRecord | null> {
    const notification = await this.prisma.notificationRecord.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return notification ? this.mapToNotification(notification) : null;
  }

  async findByUserId(
    userId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<NotificationRecord>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    // Sorting
    const orderBy: any = {};
    if (pagination?.sortBy) {
      orderBy[pagination.sortBy] = pagination.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notificationRecord.findMany({
        where: { userId },
        take: limit,
        skip,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              walletAddress: true,
              displayName: true,
              email: true
            }
          }
        }
      }),
      this.prisma.notificationRecord.count({ where: { userId } })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: notifications.map(notification => this.mapToNotification(notification)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  async findUnreadByUserId(userId: string): Promise<NotificationRecord[]> {
    const notifications = await this.prisma.notificationRecord.findMany({
      where: { 
        userId,
        read: false
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return notifications.map(notification => this.mapToNotification(notification));
  }

  async markAsRead(id: string): Promise<NotificationRecord> {
    const notification = await this.prisma.notificationRecord.update({
      where: { id },
      data: { read: true },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return this.mapToNotification(notification);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notificationRecord.updateMany({
      where: { 
        userId,
        read: false
      },
      data: { read: true }
    });

    return result.count;
  }

  async markAsUnread(id: string): Promise<NotificationRecord> {
    const notification = await this.prisma.notificationRecord.update({
      where: { id },
      data: { read: false },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    return this.mapToNotification(notification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.prisma.notificationRecord.count({
      where: { 
        userId,
        read: false
      }
    });
  }

  async findByType(
    userId: string, 
    type: NotificationType,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<NotificationRecord>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const orderBy: any = {};
    if (pagination?.sortBy) {
      orderBy[pagination.sortBy] = pagination.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notificationRecord.findMany({
        where: { userId, type },
        take: limit,
        skip,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              walletAddress: true,
              displayName: true,
              email: true
            }
          }
        }
      }),
      this.prisma.notificationRecord.count({ where: { userId, type } })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: notifications.map(notification => this.mapToNotification(notification)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  async deleteOldNotifications(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.notificationRecord.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        read: true
      }
    });

    return result.count;
  }

  async getNotificationStats(userId?: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
    readRate: number;
  }> {
    const where = userId ? { userId } : {};

    const [total, unread, byType] = await Promise.all([
      this.prisma.notificationRecord.count({ where }),
      this.prisma.notificationRecord.count({ where: { ...where, read: false } }),
      this.prisma.notificationRecord.groupBy({
        by: ['type'],
        where,
        _count: { type: true }
      })
    ]);

    const typeStats = Object.values(NotificationType).reduce((acc, type) => {
      acc[type] = byType.find(item => item.type === type)?._count.type || 0;
      return acc;
    }, {} as Record<NotificationType, number>);

    const readRate = total > 0 ? ((total - unread) / total) * 100 : 0;

    return {
      total,
      unread,
      byType: typeStats,
      readRate: Math.round(readRate * 100) / 100
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.notificationRecord.delete({
      where: { id }
    });
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.prisma.notificationRecord.deleteMany({
      where: { userId }
    });

    return result.count;
  }

  // Bulk operations
  async createBulk(notifications: CreateNotificationRequest[]): Promise<NotificationRecord[]> {
    await this.prisma.notificationRecord.createMany({
      data: notifications.map(notification => ({
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl ?? null,
        metadata: notification.metadata || {}
      }))
    });

    // Return the created notifications (note: createMany doesn't return the created records)
    // So we need to fetch them separately
    const createdNotifications = await this.prisma.notificationRecord.findMany({
      where: {
        userId: { in: notifications.map(n => n.userId) },
        createdAt: { gte: new Date(Date.now() - 1000) } // Within the last second
      },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: notifications.length
    });

    return createdNotifications.map(notification => this.mapToNotification(notification));
  }

  private mapToNotification(notification: any): NotificationRecord {
    return {
      ...notification,
      metadata: typeof notification.metadata === 'string' 
        ? JSON.parse(notification.metadata) 
        : notification.metadata
    };
  }
}