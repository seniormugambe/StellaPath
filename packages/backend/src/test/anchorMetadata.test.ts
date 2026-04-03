import { attachAnchorMetadata } from '../utils/anchorMetadata';

describe('attachAnchorMetadata', () => {
  const originalProvider = process.env['STELLAR_ANCHOR_PROVIDER'];
  const originalNetwork = process.env['STELLAR_NETWORK'];
  const originalDepositUrl = process.env['STELLAR_ANCHOR_DEPOSIT_URL'];

  beforeEach(() => {
    delete process.env['STELLAR_ANCHOR_PROVIDER'];
    delete process.env['STELLAR_NETWORK'];
    delete process.env['STELLAR_ANCHOR_DEPOSIT_URL'];
  });

  afterEach(() => {
    process.env['STELLAR_ANCHOR_PROVIDER'] = originalProvider;
    process.env['STELLAR_NETWORK'] = originalNetwork;
    process.env['STELLAR_ANCHOR_DEPOSIT_URL'] = originalDepositUrl;
  });

  it('attaches default anchor metadata when none exists', () => {
    const metadata = attachAnchorMetadata({ memo: 'Test transaction' });

    expect(metadata['memo']).toBe('Test transaction');
    expect(metadata['anchor']).toBeDefined();
    expect(metadata['anchor']['provider']).toBe('stellar-ramp');
    expect(metadata['anchor']['network']).toBe('testnet');
    expect(metadata['anchor']['timestamp']).toBeDefined();
  });

  it('uses configured provider, network, and deposit URL when provided', () => {
    process.env['STELLAR_ANCHOR_PROVIDER'] = 'custom-anchor';
    process.env['STELLAR_NETWORK'] = 'mainnet';
    process.env['STELLAR_ANCHOR_DEPOSIT_URL'] = 'https://deposit.anchor.example.com';

    const metadata = attachAnchorMetadata({});

    expect(metadata['anchor']['provider']).toBe('custom-anchor');
    expect(metadata['anchor']['network']).toBe('mainnet');
    expect(metadata['anchor']['depositUrl']).toBe('https://deposit.anchor.example.com');
  });

  it('merges anchor details with existing metadata.anchor', () => {
    const metadata = attachAnchorMetadata(
      { anchor: { anchorAccount: 'GA...' } },
      { anchorMemo: 'deposit-memo' }
    );

    expect(metadata['anchor']['anchorAccount']).toBe('GA...');
    expect(metadata['anchor']['anchorMemo']).toBe('deposit-memo');
  });
});
