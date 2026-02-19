/**
 * Notification templates for all event types.
 * 
 * Each template provides:
 * - subject: email subject line
 * - title: in-app notification title
 * - html: email HTML body (with {{placeholder}} interpolation)
 * - text: plain-text fallback
 * - message: in-app notification message
 * 
 * Validates: Requirements 3.3, 4.2, 4.4
 */

import { NotificationType } from '../types/database';

export interface NotificationTemplate {
  type: NotificationType;
  subject: string;
  title: string;
  html: string;
  text: string;
  message: string;
}

export interface TemplateData {
  recipientName?: string;
  senderName?: string;
  amount?: string;
  currency?: string;
  invoiceId?: string;
  invoiceDescription?: string;
  approvalUrl?: string;
  transactionHash?: string;
  escrowId?: string;
  reason?: string;
  alertTitle?: string;
  alertMessage?: string;
  dueDate?: string;
  [key: string]: string | undefined;
}

/**
 * Replaces {{key}} placeholders in a template string with values from data.
 */
export function interpolateTemplate(template: string, data: TemplateData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return data[key] ?? '';
  });
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stellar DApp Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { color: #1a1a2e; font-size: 24px; margin: 0; }
    .content { color: #333; line-height: 1.6; }
    .highlight { background: #f0f4ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
    .amount { font-size: 28px; font-weight: bold; color: #1a1a2e; }
    .btn { display: inline-block; padding: 12px 24px; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .btn:hover { background: #2563eb; }
    .btn-danger { background: #ef4444; }
    .btn-success { background: #22c55e; }
    .footer { text-align: center; margin-top: 24px; color: #888; font-size: 12px; }
    .mono { font-family: 'Courier New', monospace; font-size: 13px; background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${body}
    </div>
    <div class="footer">
      <p>Stellar Smart Contract DApp &mdash; Secure Blockchain Transactions</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

const templates: Record<NotificationType, Omit<NotificationTemplate, 'type'>> = {
  [NotificationType.INVOICE_RECEIVED]: {
    subject: 'New Invoice Received - {{amount}} {{currency}}',
    title: 'New Invoice Received',
    html: wrapHtml(`
      <div class="header"><h1>📄 New Invoice</h1></div>
      <div class="content">
        <p>Hello {{recipientName}},</p>
        <p>You have received a new invoice from <strong>{{senderName}}</strong>.</p>
        <div class="highlight">
          <p class="amount">{{amount}} {{currency}}</p>
          <p><strong>Description:</strong> {{invoiceDescription}}</p>
          <p><strong>Invoice ID:</strong> <span class="mono">{{invoiceId}}</span></p>
          <p><strong>Due Date:</strong> {{dueDate}}</p>
        </div>
        <p>Please review the invoice and approve or reject it:</p>
        <a href="{{approvalUrl}}" class="btn">Review Invoice</a>
      </div>
    `),
    text: 'Hello {{recipientName}}, you have received a new invoice for {{amount}} {{currency}} from {{senderName}}. Description: {{invoiceDescription}}. Invoice ID: {{invoiceId}}. Due Date: {{dueDate}}. Review it at: {{approvalUrl}}',
    message: 'New invoice received for {{amount}} {{currency}} from {{senderName}}',
  },

  [NotificationType.INVOICE_APPROVED]: {
    subject: 'Invoice Approved - {{invoiceId}}',
    title: 'Invoice Approved',
    html: wrapHtml(`
      <div class="header"><h1>✅ Invoice Approved</h1></div>
      <div class="content">
        <p>Hello {{recipientName}},</p>
        <p>Your invoice has been approved by the client.</p>
        <div class="highlight">
          <p class="amount">{{amount}} {{currency}}</p>
          <p><strong>Invoice ID:</strong> <span class="mono">{{invoiceId}}</span></p>
          <p><strong>Description:</strong> {{invoiceDescription}}</p>
        </div>
        <p>The payment will be processed automatically.</p>
      </div>
    `),
    text: 'Hello {{recipientName}}, your invoice {{invoiceId}} for {{amount}} {{currency}} has been approved. Payment will be processed automatically.',
    message: 'Invoice {{invoiceId}} approved - {{amount}} {{currency}}',
  },

  [NotificationType.INVOICE_REJECTED]: {
    subject: 'Invoice Rejected - {{invoiceId}}',
    title: 'Invoice Rejected',
    html: wrapHtml(`
      <div class="header"><h1>❌ Invoice Rejected</h1></div>
      <div class="content">
        <p>Hello {{recipientName}},</p>
        <p>Your invoice has been rejected by the client.</p>
        <div class="highlight">
          <p><strong>Invoice ID:</strong> <span class="mono">{{invoiceId}}</span></p>
          <p><strong>Amount:</strong> {{amount}} {{currency}}</p>
          <p><strong>Reason:</strong> {{reason}}</p>
        </div>
        <p>You may create a new invoice or contact the client for further discussion.</p>
      </div>
    `),
    text: 'Hello {{recipientName}}, your invoice {{invoiceId}} for {{amount}} {{currency}} has been rejected. Reason: {{reason}}',
    message: 'Invoice {{invoiceId}} rejected: {{reason}}',
  },

  [NotificationType.TRANSACTION_CONFIRMED]: {
    subject: 'Transaction Confirmed - {{transactionHash}}',
    title: 'Transaction Confirmed',
    html: wrapHtml(`
      <div class="header"><h1>🎉 Transaction Confirmed</h1></div>
      <div class="content">
        <p>Hello {{recipientName}},</p>
        <p>Your transaction has been confirmed on the Stellar network.</p>
        <div class="highlight">
          <p class="amount">{{amount}} {{currency}}</p>
          <p><strong>Transaction Hash:</strong> <span class="mono">{{transactionHash}}</span></p>
        </div>
        <p>The funds have been successfully transferred.</p>
      </div>
    `),
    text: 'Hello {{recipientName}}, your transaction for {{amount}} {{currency}} has been confirmed. Transaction hash: {{transactionHash}}',
    message: 'Transaction confirmed: {{amount}} {{currency}} ({{transactionHash}})',
  },

  [NotificationType.ESCROW_RELEASED]: {
    subject: 'Escrow Funds Released - {{escrowId}}',
    title: 'Escrow Released',
    html: wrapHtml(`
      <div class="header"><h1>🔓 Escrow Released</h1></div>
      <div class="content">
        <p>Hello {{recipientName}},</p>
        <p>The escrow funds have been released.</p>
        <div class="highlight">
          <p class="amount">{{amount}} {{currency}}</p>
          <p><strong>Escrow ID:</strong> <span class="mono">{{escrowId}}</span></p>
          <p><strong>Transaction Hash:</strong> <span class="mono">{{transactionHash}}</span></p>
        </div>
        <p>All conditions have been met and the funds have been transferred to the recipient.</p>
      </div>
    `),
    text: 'Hello {{recipientName}}, escrow {{escrowId}} has been released. Amount: {{amount}} {{currency}}. Transaction hash: {{transactionHash}}',
    message: 'Escrow {{escrowId}} released: {{amount}} {{currency}}',
  },

  [NotificationType.ESCROW_REFUNDED]: {
    subject: 'Escrow Refunded - {{escrowId}}',
    title: 'Escrow Refunded',
    html: wrapHtml(`
      <div class="header"><h1>↩️ Escrow Refunded</h1></div>
      <div class="content">
        <p>Hello {{recipientName}},</p>
        <p>The escrow has been refunded.</p>
        <div class="highlight">
          <p class="amount">{{amount}} {{currency}}</p>
          <p><strong>Escrow ID:</strong> <span class="mono">{{escrowId}}</span></p>
          <p><strong>Reason:</strong> {{reason}}</p>
        </div>
        <p>The funds have been returned to the original sender.</p>
      </div>
    `),
    text: 'Hello {{recipientName}}, escrow {{escrowId}} has been refunded. Amount: {{amount}} {{currency}}. Reason: {{reason}}',
    message: 'Escrow {{escrowId}} refunded: {{amount}} {{currency}}',
  },

  [NotificationType.SYSTEM_ALERT]: {
    subject: '⚠️ System Alert - {{alertTitle}}',
    title: 'System Alert',
    html: wrapHtml(`
      <div class="header"><h1>⚠️ System Alert</h1></div>
      <div class="content">
        <p>Hello {{recipientName}},</p>
        <div class="highlight">
          <p><strong>{{alertTitle}}</strong></p>
          <p>{{alertMessage}}</p>
        </div>
        <p>If you have questions, please contact support.</p>
      </div>
    `),
    text: 'Hello {{recipientName}}, system alert: {{alertTitle}} - {{alertMessage}}',
    message: '{{alertTitle}}: {{alertMessage}}',
  },
};

/**
 * Retrieves a notification template for the given type.
 */
export function getNotificationTemplate(type: NotificationType): NotificationTemplate {
  const template = templates[type];
  if (!template) {
    throw new Error(`No template found for notification type: ${type}`);
  }
  return { type, ...template };
}

/**
 * Returns all available notification templates.
 */
export function getAllNotificationTemplates(): NotificationTemplate[] {
  return Object.entries(templates).map(([type, template]) => ({
    type: type as NotificationType,
    ...template,
  }));
}

/**
 * Renders a notification template with the provided data.
 */
export function renderNotificationTemplate(
  type: NotificationType,
  data: TemplateData
): { subject: string; title: string; html: string; text: string; message: string } {
  const template = getNotificationTemplate(type);

  return {
    subject: interpolateTemplate(template.subject, data),
    title: interpolateTemplate(template.title, data),
    html: interpolateTemplate(template.html, data),
    text: interpolateTemplate(template.text, data),
    message: interpolateTemplate(template.message, data),
  };
}
