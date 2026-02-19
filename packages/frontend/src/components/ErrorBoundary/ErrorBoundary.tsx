import React, { Component, ErrorInfo } from 'react'
import { Box, Typography, Button, Paper, Alert } from '@mui/material'
import { ErrorOutline, Refresh, Home } from '@mui/icons-material'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * React Error Boundary that catches rendering errors and displays
 * a user-friendly fallback UI with recovery options.
 * Satisfies Requirements 8.1, 8.2, 8.3.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    // Log error for debugging while protecting user privacy (Req 8.5)
    console.error('[ErrorBoundary]', error.message)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', p: 3 }}>
          <Paper sx={{ maxWidth: 520, width: '100%', p: 4, textAlign: 'center' }}>
            <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
              Something went wrong
            </Typography>
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Try refreshing the component or returning to the home page. If the problem persists, please check your wallet connection and try again.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="contained" startIcon={<Refresh />} onClick={this.handleRetry}>
                Try Again
              </Button>
              <Button variant="outlined" startIcon={<Home />} onClick={this.handleGoHome}>
                Go Home
              </Button>
            </Box>
          </Paper>
        </Box>
      )
    }

    return this.props.children
  }
}
