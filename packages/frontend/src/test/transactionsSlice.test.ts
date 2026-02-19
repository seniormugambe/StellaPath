import transactionsReducer, {
  setTransactions,
  addTransaction,
  updateTransaction,
  setLoading,
  setError,
  setFilters,
  clearFilters,
  TransactionsState,
  Transaction,
} from '../store/slices/transactionsSlice'

describe('transactionsSlice', () => {
  const initialState: TransactionsState = {
    transactions: [],
    loading: false,
    error: null,
    filters: {},
  }

  const mockTransaction: Transaction = {
    id: '1',
    type: 'basic',
    sender: 'GABC123...',
    recipient: 'GDEF456...',
    amount: 100,
    status: 'pending',
    timestamp: new Date('2024-01-01'),
    txHash: 'hash123',
  }

  it('should return the initial state', () => {
    expect(transactionsReducer(undefined, { type: 'unknown' })).toEqual(initialState)
  })

  it('should handle setTransactions', () => {
    const transactions = [mockTransaction]
    const actual = transactionsReducer(initialState, setTransactions(transactions))
    
    expect(actual.transactions).toEqual(transactions)
    expect(actual.loading).toBe(false)
    expect(actual.error).toBeNull()
  })

  it('should handle addTransaction', () => {
    const actual = transactionsReducer(initialState, addTransaction(mockTransaction))
    
    expect(actual.transactions).toHaveLength(1)
    expect(actual.transactions[0]).toEqual(mockTransaction)
  })

  it('should add new transaction to the beginning of the list', () => {
    const existingState: TransactionsState = {
      ...initialState,
      transactions: [mockTransaction],
    }
    
    const newTransaction: Transaction = {
      ...mockTransaction,
      id: '2',
      amount: 200,
    }
    
    const actual = transactionsReducer(existingState, addTransaction(newTransaction))
    
    expect(actual.transactions).toHaveLength(2)
    expect(actual.transactions[0]).toEqual(newTransaction)
    expect(actual.transactions[1]).toEqual(mockTransaction)
  })

  it('should handle updateTransaction', () => {
    const existingState: TransactionsState = {
      ...initialState,
      transactions: [mockTransaction],
    }
    
    const updates = {
      id: '1',
      updates: { status: 'confirmed' as const },
    }
    
    const actual = transactionsReducer(existingState, updateTransaction(updates))
    
    expect(actual.transactions[0].status).toBe('confirmed')
    expect(actual.transactions[0].amount).toBe(100) // Other fields unchanged
  })

  it('should not modify state when updating non-existent transaction', () => {
    const existingState: TransactionsState = {
      ...initialState,
      transactions: [mockTransaction],
    }
    
    const updates = {
      id: 'non-existent',
      updates: { status: 'confirmed' as const },
    }
    
    const actual = transactionsReducer(existingState, updateTransaction(updates))
    
    expect(actual.transactions).toEqual(existingState.transactions)
  })

  it('should handle setLoading', () => {
    const actual = transactionsReducer(initialState, setLoading(true))
    expect(actual.loading).toBe(true)
  })

  it('should handle setError', () => {
    const error = 'Network error'
    const actual = transactionsReducer(initialState, setError(error))
    
    expect(actual.error).toBe(error)
    expect(actual.loading).toBe(false)
  })

  it('should handle setFilters', () => {
    const filters = {
      type: 'escrow' as const,
      status: 'confirmed' as const,
    }
    
    const actual = transactionsReducer(initialState, setFilters(filters))
    expect(actual.filters).toEqual(filters)
  })

  it('should handle clearFilters', () => {
    const existingState: TransactionsState = {
      ...initialState,
      filters: {
        type: 'escrow',
        status: 'confirmed',
      },
    }
    
    const actual = transactionsReducer(existingState, clearFilters())
    expect(actual.filters).toEqual({})
  })
})
