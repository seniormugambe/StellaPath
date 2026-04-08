/** Jest stub — avoids parsing `import.meta` in ts-jest (see jest.config.cjs moduleNameMapper). */
export const stellarRampConfig = {
  enabled: true,
  baseUrl: 'https://stellar.org/learn/anchors',
  accountQueryKey: 'account',
  amountQueryKey: '',
} as const

export function buildStellarRampHref(opts: { accountId?: string; amount?: number }): string {
  const url = new URL(stellarRampConfig.baseUrl)
  if (opts.accountId) {
    url.searchParams.set(stellarRampConfig.accountQueryKey, opts.accountId)
  }
  if (stellarRampConfig.amountQueryKey && opts.amount != null && opts.amount > 0) {
    url.searchParams.set(stellarRampConfig.amountQueryKey, String(opts.amount))
  }
  return url.toString()
}
