import { AnchorMetadata } from '../types/database';

export function attachAnchorMetadata(
  metadata: Record<string, any> = {},
  details: Partial<AnchorMetadata> = {}
): Record<string, any> {
  const existingAnchor = (metadata['anchor'] as Record<string, any>) || {};
  const defaultDepositUrl = process.env['STELLAR_ANCHOR_DEPOSIT_URL'];

  const anchor: AnchorMetadata = {
    provider: process.env['STELLAR_ANCHOR_PROVIDER'] || 'stellar-ramp',
    network: process.env['STELLAR_NETWORK'] || 'testnet',
    timestamp: new Date().toISOString(),
    ...(defaultDepositUrl ? { depositUrl: defaultDepositUrl } : {}),
    ...existingAnchor,
    ...details,
  };

  return {
    ...metadata,
    anchor,
  };
}
