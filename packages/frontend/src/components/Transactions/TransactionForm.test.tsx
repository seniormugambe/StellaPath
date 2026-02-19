import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionForm } from './TransactionForm'

describe('TransactionForm', () => {
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    mockOnSubmit.mockClear()
  })

  it('renders all form fields', () => {
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    expect(screen.getByLabelText(/transaction type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/memo/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create transaction/i })).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    const submitButton = screen.getByRole('button', { name: /create transaction/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/recipient address is required/i)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('validates recipient address format', async () => {
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    const recipientInput = screen.getByLabelText(/recipient address/i)
    await userEvent.type(recipientInput, 'invalid-address')

    const submitButton = screen.getByRole('button', { name: /create transaction/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid stellar address format/i)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('validates positive amount', async () => {
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    const amountInput = screen.getByLabelText(/amount/i)
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '0')

    const submitButton = screen.getByRole('button', { name: /create transaction/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('submits form with valid data', async () => {
    mockOnSubmit.mockResolvedValue(undefined)
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    // Fill in the form
    const typeSelect = screen.getByLabelText(/transaction type/i)
    fireEvent.mouseDown(typeSelect)
    const p2pOption = screen.getByRole('option', { name: /peer-to-peer payment/i })
    fireEvent.click(p2pOption)

    const recipientInput = screen.getByLabelText(/recipient address/i)
    await userEvent.type(recipientInput, 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')

    const amountInput = screen.getByLabelText(/amount/i)
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '100')

    const memoInput = screen.getByLabelText(/memo/i)
    await userEvent.type(memoInput, 'Test payment')

    const submitButton = screen.getByRole('button', { name: /create transaction/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        type: 'p2p',
        recipient: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        amount: 100,
        memo: 'Test payment',
      })
    })
  })

  it('resets form after successful submission', async () => {
    mockOnSubmit.mockResolvedValue(undefined)
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    const recipientInput = screen.getByLabelText(/recipient address/i)
    await userEvent.type(recipientInput, 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')

    const amountInput = screen.getByLabelText(/amount/i)
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '50')

    const submitButton = screen.getByRole('button', { name: /create transaction/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled()
    })

    // Check that form is reset
    expect(recipientInput).toHaveValue('')
    expect(amountInput).toHaveValue(null)
  })

  it('displays error message on submission failure', async () => {
    const errorMessage = 'Insufficient funds'
    mockOnSubmit.mockRejectedValue(new Error(errorMessage))
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    const recipientInput = screen.getByLabelText(/recipient address/i)
    await userEvent.type(recipientInput, 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')

    const amountInput = screen.getByLabelText(/amount/i)
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '1000')

    const submitButton = screen.getByRole('button', { name: /create transaction/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('disables form during submission', async () => {
    render(<TransactionForm onSubmit={mockOnSubmit} loading={true} />)

    const typeSelect = screen.getByLabelText(/transaction type/i)
    const recipientInput = screen.getByLabelText(/recipient address/i)
    const amountInput = screen.getByLabelText(/amount/i)
    const memoInput = screen.getByLabelText(/memo/i)
    const submitButton = screen.getByRole('button', { name: /processing/i })

    expect(typeSelect).toBeDisabled()
    expect(recipientInput).toBeDisabled()
    expect(amountInput).toBeDisabled()
    expect(memoInput).toBeDisabled()
    expect(submitButton).toBeDisabled()
  })

  it('clears validation errors when user corrects input', async () => {
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    const submitButton = screen.getByRole('button', { name: /create transaction/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/recipient address is required/i)).toBeInTheDocument()
    })

    const recipientInput = screen.getByLabelText(/recipient address/i)
    await userEvent.type(recipientInput, 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')

    await waitFor(() => {
      expect(screen.queryByText(/recipient address is required/i)).not.toBeInTheDocument()
    })
  })

  it('supports all transaction types', async () => {
    render(<TransactionForm onSubmit={mockOnSubmit} />)

    const typeSelect = screen.getByLabelText(/transaction type/i)
    
    // Test each transaction type
    const types = ['basic', 'p2p', 'escrow', 'invoice']
    
    for (const type of types) {
      fireEvent.mouseDown(typeSelect)
      const option = screen.getByRole('option', { name: new RegExp(type, 'i') })
      fireEvent.click(option)
      
      // Verify the selection
      expect(typeSelect).toHaveTextContent(new RegExp(type, 'i'))
    }
  })
})
