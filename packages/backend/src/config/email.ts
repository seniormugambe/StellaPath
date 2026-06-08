/**
 * Email service configuration
 *
 * Sends email through the Resend API. Configuration is driven by environment
 * variables, with legacy FROM_* aliases supported for existing deployments.
 */

import { logger } from '../utils/logger';

export interface EmailConfig {
  provider: 'resend';
  from: string;
  fromName: string;
  resendApiKey?: string | undefined;
  resendApiUrl: string;
}

export function getEmailConfig(): EmailConfig {
  return {
    provider: 'resend',
    from: process.env['EMAIL_FROM'] || process.env['FROM_EMAIL'] || 'noreply@stellar-dapp.com',
    fromName: process.env['EMAIL_FROM_NAME'] || process.env['FROM_NAME'] || 'Stellar DApp',
    resendApiKey: process.env['RESEND_API_KEY'],
    resendApiUrl: process.env['RESEND_API_URL'] || 'https://api.resend.com/emails',
  };
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

export interface EmailClient {
  send(options: SendEmailOptions, config?: EmailConfig): Promise<SendEmailResult>;
}

/**
 * Creates an email client backed by the Resend REST API.
 */
export function createEmailClient(config?: EmailConfig): EmailClient {
  const emailConfig = config || getEmailConfig();

  logger.info('Configuring email client with Resend', {
    apiUrl: emailConfig.resendApiUrl,
    from: emailConfig.from,
  });

  return {
    send: (options: SendEmailOptions, overrideConfig?: EmailConfig) =>
      sendEmail(options, overrideConfig || emailConfig),
  };
}

/**
 * Sends an email through the Resend API.
 */
export async function sendEmail(
  options: SendEmailOptions,
  config?: EmailConfig
): Promise<SendEmailResult> {
  const emailConfig = config || getEmailConfig();

  if (!emailConfig.resendApiKey) {
    const error = 'RESEND_API_KEY is not configured';
    logger.error('Failed to send email', {
      to: options.to,
      subject: options.subject,
      error,
    });
    return { success: false, error };
  }

  try {
    const response = await fetch(emailConfig.resendApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${emailConfig.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `"${emailConfig.fromName}" <${emailConfig.from}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const responseBody = await response.json().catch(() => ({})) as {
      id?: string;
      message?: string;
      error?: string | { message?: string };
    };

    if (!response.ok) {
      const responseError =
        typeof responseBody.error === 'string'
          ? responseBody.error
          : responseBody.error?.message || responseBody.message || `Resend API returned ${response.status}`;
      throw new Error(responseError);
    }

    logger.info('Email sent successfully', {
      messageId: responseBody.id,
      to: options.to,
      subject: options.subject,
    });

    const result: SendEmailResult = { success: true };
    if (responseBody.id) {
      result.messageId = responseBody.id;
    }
    return result;
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
