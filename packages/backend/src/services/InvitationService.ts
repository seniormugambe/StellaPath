import { NotificationRepository } from '../repositories/NotificationRepository';
import { UserRepository } from '../repositories/UserRepository';
import { NotificationType, User } from '../types/database';
import { sendEmail } from '../config/email';
import { logger } from '../utils/logger';

interface InvitationTarget {
  user?: User | null;
  email?: string | null;
}

interface InvitationParams {
  target: InvitationTarget;
  title: string;
  message: string;
  actionUrl?: string;
  emailSubject: string;
  emailHtml: string;
  emailText: string;
  metadata?: Record<string, unknown>;
}

export interface InvitationDeliveryResult {
  notificationCreated: boolean;
  emailStatus: 'sent' | 'failed' | 'skipped';
  messageId?: string;
  error?: string;
}

export class InvitationService {
  constructor(
    private notificationRepository: NotificationRepository,
    private userRepository: UserRepository
  ) {}

  async findUserByWalletAddress(walletAddress?: string | null): Promise<User | null> {
    if (!walletAddress) return null;
    return this.userRepository.findByWalletAddress(walletAddress);
  }

  async findUserByEmail(email?: string | null): Promise<User | null> {
    if (!email) return null;
    return this.userRepository.findByEmail(email);
  }

  async sendInvitation(params: InvitationParams): Promise<InvitationDeliveryResult> {
    const targetEmail = params.target.email || params.target.user?.email;
    const delivery: InvitationDeliveryResult = {
      notificationCreated: false,
      emailStatus: targetEmail ? 'failed' : 'skipped',
    };

    if (params.target.user) {
      await this.notificationRepository.create({
        userId: params.target.user.id,
        type: NotificationType.SYSTEM_ALERT,
        title: params.title,
        message: params.message,
        ...(params.actionUrl ? { actionUrl: params.actionUrl } : {}),
        metadata: params.metadata || {},
      });
      delivery.notificationCreated = true;
    }

    if (targetEmail) {
      const result = await sendEmail({
        to: targetEmail,
        subject: params.emailSubject,
        html: params.emailHtml,
        text: params.emailText,
      });

      if (!result.success) {
        delivery.emailStatus = 'failed';
        delivery.error = result.error || 'Invitation email was not sent';
        logger.warn('Invitation email was not sent', {
          email: targetEmail,
          error: result.error,
        });
      } else {
        delivery.emailStatus = 'sent';
        if (result.messageId) {
          delivery.messageId = result.messageId;
        }
      }
    }

    if (!params.target.user && !targetEmail) {
      logger.info('Invitation skipped because no reachable target was available', {
        title: params.title,
        metadata: params.metadata,
      });
    }

    return delivery;
  }
}
