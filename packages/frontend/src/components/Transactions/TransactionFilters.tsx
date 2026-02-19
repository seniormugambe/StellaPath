import { useState } from 'react'
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Grid,
} from '@mui/material'
import { TransactionType, TransactionStatus } from '../../types'

interface TransactionFiltersProps {
  onFilterChange: (filters: FilterValues) => void
}

export interface FilterValues {
  type?: TransactionType
  status?: TransactionStatus
  dateFrom?: string
  dateTo?: string
}

export const TransactionFilters = ({ onFilterChange }: TransactionFiltersProps) => {
  const [filters, setFilters] = useState<FilterValues>({})

  const handleFilterChange = (field: keyof FilterValues, value: any) => {
    const newFilters = { ...filters, [field]: value || undefined }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleClearFilters = () => {
    setFilters({})
    onFilterChange({})
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined)

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={filters.type || ''}
              label="Type"
              onChange={(e) => handleFilterChange('type', e.target.value as TransactionType)}
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="basic">Basic</MenuItem>
              <MenuItem value="p2p">P2P</MenuItem>
              <MenuItem value="escrow">Escrow</MenuItem>
              <MenuItem value="invoice">Invoice</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status || ''}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value as TransactionStatus)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            label="From Date"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <TextField
            fullWidth
            size="small"
            label="To Date"
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid item xs={12} sm={12} md={2}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            sx={{ height: '40px' }}
          >
            Clear Filters
          </Button>
        </Grid>
      </Grid>
    </Box>
  )
}
