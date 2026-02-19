import {
  Box,
  Typography,
  Chip,
  Paper,
  Stack,
  LinearProgress,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material'
import { ConditionStatusItem } from '../../store/slices/escrowSlice'

interface EscrowConditionStatusProps {
  conditions: ConditionStatusItem[]
  loading?: boolean
}

const getConditionIcon = (type: string) => {
  switch (type) {
    case 'time_based':
      return <ScheduleIcon fontSize="small" />
    case 'manual_approval':
      return <PersonIcon fontSize="small" />
    case 'oracle_based':
      return <CloudIcon fontSize="small" />
    default:
      return <ScheduleIcon fontSize="small" />
  }
}

const getConditionLabel = (type: string) => {
  switch (type) {
    case 'time_based':
      return 'Time-Based'
    case 'manual_approval':
      return 'Manual Approval'
    case 'oracle_based':
      return 'Oracle-Based'
    default:
      return type
  }
}

export const EscrowConditionStatus = ({ conditions, loading = false }: EscrowConditionStatusProps) => {
  const metCount = conditions.filter(c => c.met).length
  const totalCount = conditions.length
  const progress = totalCount > 0 ? (metCount / totalCount) * 100 : 0

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Conditions ({metCount}/{totalCount} met)
        </Typography>
        <Chip
          label={metCount === totalCount ? 'All Met' : 'Pending'}
          color={metCount === totalCount ? 'success' : 'warning'}
          size="small"
        />
      </Box>

      <LinearProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={progress}
        sx={{ mb: 2, borderRadius: 1, height: 6 }}
        color={metCount === totalCount ? 'success' : 'primary'}
      />

      <Stack spacing={1.5}>
        {conditions.map((cs, index) => (
          <Paper
            key={index}
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              borderColor: cs.met ? 'success.main' : 'divider',
              bgcolor: cs.met ? 'success.main' : 'transparent',
              ...(cs.met && { bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(46,125,50,0.05)' : 'rgba(46,125,50,0.1)' }),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {cs.met ? (
                <CheckIcon color="success" fontSize="small" />
              ) : (
                <CancelIcon color="disabled" fontSize="small" />
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {getConditionIcon(cs.condition.type)}
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {getConditionLabel(cs.condition.type)}
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {cs.checkedAt ? `Checked: ${new Date(cs.checkedAt).toLocaleString()}` : ''}
              </Typography>
            </Box>
            {cs.evidence && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block', mt: 0.5 }}>
                {cs.evidence}
              </Typography>
            )}
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}
