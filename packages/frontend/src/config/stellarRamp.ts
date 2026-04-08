/**
 * Stellar Ramp / anchor onboarding URL (optional query params for account & amount).
 * Point VITE_STELLAR_RAMP_URL at your anchor’s hosted deposit or Stellar Ramp entry.
 */
const raw = import.meta.env as Record<string, string | undefined>

export const stellarRampConfig = {
  enabled: String(raw.VITE_STELLAR_RAMP_ENABLED ?? 'true').toLowerCase() !== 'false',
  baseUrl: String(raw.VITE_STELLAR_RAMP_URL ?? 'https://stellar.org/learn/anchors'),
  /** Query key for the user’s Stellar address (anchors vary: account, destination, etc.) */
  accountQueryKey: String(raw.VITE_STELLAR_RAMP_ACCOUNT_PARAM ?? 'account').trim() || 'account',
  /** If set, amount is appended under this key (omit env to skip amount in URL) */
  amountQueryKey: String(raw.VITE_STELLAR_RAMP_AMOUNT_PARAM ?? '').trim(),
} as const

export function buildStellarRampHref(opts: { accountId?: string; amount?: number }): string {
  let url: URL
  try {
    url = new URL(stellarRampConfig.baseUrl)
  } catch {
    return stellarRampConfig.baseUrl
  }
  if (opts.accountId) {
    url.searchParams.set(stellarRampConfig.accountQueryKey, opts.accountId)
  }
  if (stellarRampConfig.amountQueryKey && opts.amount != null && opts.amount > 0) {
    url.searchParams.set(stellarRampConfig.amountQueryKey, String(opts.amount))
  }
  return url.toString()
}
