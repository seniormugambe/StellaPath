import walletReducer, {
  connectWallet,
  disconnectWallet,
  setNetwork,
  WalletState,
} from '../store/slices/walletSlice'

describe('walletSlice', () => {
  const initialState: WalletState = {
    connected: false,
    accountId: null,
    publicKey: null,
    network: 'testnet',
    walletType: null,
  }

  it('should return the initial state', () => {
    expect(walletReducer(undefined, { type: 'unknown' })).toEqual(initialState)
  })

  it('should handle connectWallet', () => {
    const walletData = {
      accountId: 'GABC123...',
      publicKey: 'GPUB456...',
      walletType: 'freighter' as const,
    }
    
    const actual = walletReducer(initialState, connectWallet(walletData))
    
    expect(actual.connected).toBe(true)
    expect(actual.accountId).toBe(walletData.accountId)
    expect(actual.publicKey).toBe(walletData.publicKey)
    expect(actual.walletType).toBe(walletData.walletType)
  })

  it('should handle disconnectWallet', () => {
    const connectedState: WalletState = {
      connected: true,
      accountId: 'GABC123...',
      publicKey: 'GPUB456...',
      network: 'testnet',
      walletType: 'freighter',
    }
    
    const actual = walletReducer(connectedState, disconnectWallet())
    
    expect(actual.connected).toBe(false)
    expect(actual.accountId).toBeNull()
    expect(actual.publicKey).toBeNull()
    expect(actual.walletType).toBeNull()
  })

  it('should handle setNetwork', () => {
    const actual = walletReducer(initialState, setNetwork('mainnet'))
    expect(actual.network).toBe('mainnet')
  })

  it('should preserve network setting when connecting wallet', () => {
    const mainnetState = walletReducer(initialState, setNetwork('mainnet'))
    
    const walletData = {
      accountId: 'GABC123...',
      publicKey: 'GPUB456...',
      walletType: 'freighter' as const,
    }
    
    const actual = walletReducer(mainnetState, connectWallet(walletData))
    
    expect(actual.network).toBe('mainnet')
    expect(actual.connected).toBe(true)
  })
})
