/**
 * SEP 24 (Stellar Protocol for Regulated Asset Transfers) Ramp Configuration
 * Supports multiple regulated fiat-to-crypto ramps like Moneygram and Binance
 */

const raw = import.meta.env as Record<string, string | undefined>

export interface Sep24RampProvider {
  id: string
  name: string
  description: string
  baseUrl: string
  accountQueryKey: string
  amountQueryKey?: string
  assetQueryKey?: string
  enabled: boolean
  logoUrl?: string
  supportedAssets?: string[]
}

export const sep24RampProviders: Sep24RampProvider[] = [
  {
    id: 'moneygram',
    name: 'Moneygram Ramp',
    description: 'Buy crypto with cash at Moneygram locations worldwide',
    baseUrl: String(raw.VITE_MONEYGRAM_RAMP_URL ?? 'https://ramp.moneygram.com'),
    accountQueryKey: 'account',
    amountQueryKey: 'amount',
    assetQueryKey: 'asset',
    enabled: String(raw.VITE_MONEYGRAM_RAMP_ENABLED ?? 'true').toLowerCase() === 'true',
    supportedAssets: ['USDC', 'XLM'],
  },
  {
    id: 'binance',
    name: 'Binance Ramp',
    description: 'Fast crypto purchases with multiple payment methods',
    baseUrl: String(raw.VITE_BINANCE_RAMP_URL ?? 'https://ramp.binance.com'),
    accountQueryKey: 'account',
    amountQueryKey: 'amount',
    assetQueryKey: 'asset',
    enabled: String(raw.VITE_BINANCE_RAMP_ENABLED ?? 'true').toLowerCase() === 'true',
    supportedAssets: ['USDC', 'XLM', 'BTC'],
  },
  {
    id: 'stellar-org',
    name: 'Stellar.org Ramp',
    description: 'Official Stellar anchor directory',
    baseUrl: String(raw.VITE_STELLAR_RAMP_URL ?? 'https://stellar.org/learn/anchors'),
    accountQueryKey: 'account',
    amountQueryKey: 'amount',
    enabled: String(raw.VITE_STELLAR_RAMP_ENABLED ?? 'true').toLowerCase() === 'true',
    supportedAssets: ['USDC', 'XLM'],
  },
]

export const sep24Config = {
  enabled: sep24RampProviders.some(provider => provider.enabled),
  providers: sep24RampProviders.filter(provider => provider.enabled),
}

export function buildSep24RampHref(
  providerId: string,
  opts: {
    accountId?: string
    amount?: number
    asset?: string
  }
): string {
  const provider = sep24RampProviders.find(p => p.id === providerId)
  if (!provider) {
    throw new Error(`Unknown SEP 24 provider: ${providerId}`)
  }

  let url: URL
  try {
    url = new URL(provider.baseUrl)
  } catch {
    return provider.baseUrl
  }

  if (opts.accountId) {
    url.searchParams.set(provider.accountQueryKey, opts.accountId)
  }
  if (provider.amountQueryKey && opts.amount != null && opts.amount > 0) {
    url.searchParams.set(provider.amountQueryKey, String(opts.amount))
  }
  if (provider.assetQueryKey && opts.asset) {
    url.searchParams.set(provider.assetQueryKey, opts.asset)
  }

  return url.toString()
}

export function getEnabledSep24Providers(): Sep24RampProvider[] {
  return sep24RampProviders.filter(provider => provider.enabled)
}