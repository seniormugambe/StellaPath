/// <reference types="jest" />

import { InvitationService } from '../services/InvitationService';
import { NotificationType } from '../types/database';
import { sendEmail } from '../config/email';

jest.mock('../config/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'email-1' }),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    walletAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    email: 'recipient@example.com',
    displayName: 'Recipient',
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      currency: 'XLM',
      timezone: 'UTC',
      language: 'en',
      emailNotifications: true,
      pushNotifications: true,
    },
    notificationSettings: {
      invoiceUpdates: true,
      transactionConfirmations: true,
      escrowUpdates: true,
      systemAlerts: true,
    },
    ...overrides,
  } as any;
}

function createService() {
  const notificationRepository = {
    create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
  };
  const userRepository = {
    findByWalletAddress: jest.fn(),
    findByEmail: jest.fn(),
  };
  const service = new InvitationService(notificationRepository as any, userRepository as any);
  return { service, notificationRepository, userRepository };
}

describe('InvitationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an in-app notification and sends email for a registered user', async () => {
    const { service, notificationRepository } = createService();
    const user = createMockUser();

    const result = await service.sendInvitation({
      target: { user },
      title: 'Escrow Invitation',
      message: 'You were invited to an escrow.',
      actionUrl: 'https://app.example.com/escrow',
      emailSubject: 'Escrow invitation',
      emailHtml: '<p>Escrow invitation</p>',
      emailText: 'Escrow invitation',
      metadata: { escrowId: 'escrow-1' },
    });

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: NotificationType.SYSTEM_ALERT,
        title: 'Escrow Invitation',
        actionUrl: 'https://app.example.com/escrow',
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Escrow invitation',
      })
    );
    expect(result).toEqual({
      notificationCreated: true,
      emailStatus: 'sent',
      messageId: 'email-1',
    });
  });

  it('sends email-only invitations for external recipients', async () => {
    const { service, notificationRepository } = createService();

    const result = await service.sendInvitation({
      target: { email: 'client@example.com' },
      title: 'Invoice Invitation',
      message: 'You were invited to review an invoice.',
      emailSubject: 'Invoice invitation',
      emailHtml: '<p>Invoice invitation</p>',
      emailText: 'Invoice invitation',
    });

    expect(notificationRepository.create).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: 'Invoice invitation',
      })
    );
    expect(result).toEqual({
      notificationCreated: false,
      emailStatus: 'sent',
      messageId: 'email-1',
    });
  });

  it('reports failed email delivery without throwing', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce({ success: false, error: 'RESEND_API_KEY is not configured' });
    const { service } = createService();

    await expect(service.sendInvitation({
      target: { email: 'client@example.com' },
      title: 'Invoice Invitation',
      message: 'You were invited to review an invoice.',
      emailSubject: 'Invoice invitation',
      emailHtml: '<p>Invoice invitation</p>',
      emailText: 'Invoice invitation',
    })).resolves.toEqual({
      notificationCreated: false,
      emailStatus: 'failed',
      error: 'RESEND_API_KEY is not configured',
    });
  });

  it('looks up users by wallet address and email', async () => {
    const { service, userRepository } = createService();
    const user = createMockUser();
    userRepository.findByWalletAddress.mockResolvedValue(user);
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(service.findUserByWalletAddress(user.walletAddress)).resolves.toBe(user);
    await expect(service.findUserByEmail(user.email)).resolves.toBe(user);
  });
});
