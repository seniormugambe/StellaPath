/**
 * Stellar X402 frontend configuration (optional env overrides).
 * Backend uses X402_MERCHANT_ADDRESS, X402_DEFAULT_ASSET_*, etc. — keep them aligned for payments to succeed.
 */
import { stellarRampConfig } from './stellarRamp'

const raw = import.meta.env

export const x402Config = {
  /** Default resource id shown in the payment form placeholder */
  defaultResourceId: String(raw.VITE_X402_DEFAULT_RESOURCE_ID ?? 'demo'),
  /** Public docs */
  specUrl: String(raw.VITE_X402_SPEC_URL ?? 'https://x402.org'),
  stellarX402Blog: String(raw.VITE_STELLAR_X402_URL ?? 'https://stellar.org/blog/developers/x402'),
  stellarRampEnabled: stellarRampConfig.enabled,
  stellarRampUrl: stellarRampConfig.baseUrl,
} as const
