import React from 'react'
import { Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate } from 'react-router-dom'

interface BackButtonProps {
  to?: string
}

export const BackButton = ({ to }: BackButtonProps) => {
  const navigate = useNavigate()
  return (
    <Button
      variant="outlined"
      startIcon={<ArrowBackIcon />}
      onClick={() => (to ? navigate(to) : navigate(-1))}
      sx={{ mb: 2 }}
    >
      Back
    </Button>
  )
}

export default BackButton
