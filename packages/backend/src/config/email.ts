/**
 * Email service configuration
 * 
 * Supports both SendGrid (via API key) and generic SMTP (via Nodemailer).
 * Configuration is driven by environment variables.
 */

import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailConfig {
  provider: 'sendgrid' | 'smtp';
  from: string;
  fromName: string;
  // SendGrid-specific
  sendgridApiKey?: string | undefined;
  // SMTP-specific
  smtpHost?: string | undefined;
  smtpPort?: number | undefined;
  smtpSecure?: boolean | undefined;
  smtpUser?: string | undefined;
  smtpPass?: string | undefined;
}

export function getEmailConfig(): EmailConfig {
  const provider = (process.env['EMAIL_PROVIDER'] || 'smtp') as 'sendgrid' | 'smtp';

  return {
    provider,
    from: process.env['EMAIL_FROM'] || 'noreply@stellar-dapp.com',
    fromName: process.env['EMAIL_FROM_NAME'] || 'Stellar DApp',
    sendgridApiKey: process.env['SENDGRID_API_KEY'],
    smtpHost: process.env['SMTP_HOST'] || 'localhost',
    smtpPort: parseInt(process.env['SMTP_PORT'] || '587', 10),
    smtpSecure: process.env['SMTP_SECURE'] === 'true',
    smtpUser: process.env['SMTP_USER'],
    smtpPass: process.env['SMTP_PASS'],
  };
}

/**
 * Creates a Nodemailer transporter based on the email configuration.
 * 
 * - For SendGrid: uses SMTP relay with API key as password.
 * - For generic SMTP: uses the provided host/port/credentials.
 */
export function createEmailTransporter(config?: EmailConfig): nodemailer.Transporter {
  const emailConfig = config || getEmailConfig();

  if (emailConfig.provider === 'sendgrid' && emailConfig.sendgridApiKey) {
    logger.info('Configuring email transport with SendGrid');
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: emailConfig.sendgridApiKey,
      },
    });
  }

  logger.info('Configuring email transport with SMTP', {
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort,
  });

  return nodemailer.createTransport({
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort,
    secure: emailConfig.smtpSecure,
    auth: emailConfig.smtpUser
      ? {
          user: emailConfig.smtpUser,
          pass: emailConfig.smtpPass,
        }
      : undefined,
  });
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends an email using the provided transporter.
 */
export async function sendEmail(
  transporter: nodemailer.Transporter,
  options: SendEmailOptions,
  config?: EmailConfig
): Promise<SendEmailResult> {
  const emailConfig = config || getEmailConfig();

  try {
    const info = await transporter.sendMail({
      from: `"${emailConfig.fromName}" <${emailConfig.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info('Email sent successfully', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    logger.error('Failed to send email', {
      to: options.to,
      subject: options.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
