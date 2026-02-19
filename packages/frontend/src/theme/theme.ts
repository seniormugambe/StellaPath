import { createTheme, PaletteMode } from '@mui/material/styles'

// Sophisticated nude color palette for fintech
const nudeColors = {
  // Primary nude tones (light mode)
  nude50: '#FAF8F6',
  nude100: '#F5F1ED',
  nude200: '#EBE3DB',
  nude300: '#DDD1C5',
  nude400: '#C9B8A8',
  nude500: '#B5A090',
  nude600: '#9A8577',
  nude700: '#7D6B5D',
  nude800: '#5F5248',
  nude900: '#3D3530',

  // Dark mode nude tones
  darkNude50: '#1A1614',
  darkNude100: '#252220',
  darkNude200: '#332E2B',
  darkNude300: '#423D39',
  darkNude400: '#5F5248',
  darkNude500: '#7D6B5D',
  darkNude600: '#9A8577',
  darkNude700: '#B5A090',
  darkNude800: '#C9B8A8',
  darkNude900: '#DDD1C5',

  // Accent colors
  warmGold: '#D4AF37',
  softGold: '#E8D5B7',
  deepBrown: '#4A3F35',
  cream: '#FFF9F0',
  sage: '#A8B5A0',
  terracotta: '#C97B63',
  slate: '#6B7280',
  
  // Status colors (nude-tinted)
  success: '#8B9D83',
  warning: '#D4A574',
  error: '#C97B7B',
  info: '#9B9B9B',
}

export const createFintechTheme = (mode: PaletteMode) => {
  const isLight = mode === 'light'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? nudeColors.nude600 : nudeColors.darkNude700,
        light: isLight ? nudeColors.nude400 : nudeColors.darkNude800,
        dark: isLight ? nudeColors.nude800 : nudeColors.darkNude500,
        contrastText: isLight ? '#FFFFFF' : nudeColors.darkNude50,
      },
      secondary: {
        main: nudeColors.warmGold,
        light: nudeColors.softGold,
        dark: nudeColors.deepBrown,
        contrastText: isLight ? '#FFFFFF' : nudeColors.darkNude50,
      },
      background: {
        default: isLight ? nudeColors.nude50 : nudeColors.darkNude50,
        paper: isLight ? '#FFFFFF' : nudeColors.darkNude100,
      },
      text: {
        primary: isLight ? nudeColors.nude900 : nudeColors.darkNude900,
        secondary: isLight ? nudeColors.nude700 : nudeColors.darkNude700,
      },
      success: {
        main: nudeColors.success,
        light: '#A8B5A0',
        dark: '#6B7D63',
      },
      warning: {
        main: nudeColors.warning,
        light: '#E8D5B7',
        dark: '#B5885D',
      },
      error: {
        main: nudeColors.error,
        light: '#D99B9B',
        dark: '#A85D5D',
      },
      info: {
        main: nudeColors.info,
        light: '#B8B8B8',
        dark: '#6B6B6B',
      },
      divider: isLight ? nudeColors.nude200 : nudeColors.darkNude300,
    },
    typography: {
      fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
      h1: {
        fontWeight: 700,
        fontSize: '3rem',
        letterSpacing: '-0.02em',
        color: isLight ? nudeColors.nude900 : nudeColors.darkNude900,
      },
      h2: {
        fontWeight: 700,
        fontSize: '2.5rem',
        letterSpacing: '-0.01em',
        color: isLight ? nudeColors.nude900 : nudeColors.darkNude900,
      },
      h3: {
        fontWeight: 600,
        fontSize: '2rem',
        color: isLight ? nudeColors.nude900 : nudeColors.darkNude900,
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.75rem',
        color: isLight ? nudeColors.nude900 : nudeColors.darkNude900,
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.5rem',
        color: isLight ? nudeColors.nude800 : nudeColors.darkNude800,
      },
      h6: {
        fontWeight: 600,
        fontSize: '1.25rem',
        color: isLight ? nudeColors.nude800 : nudeColors.darkNude800,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6,
        color: isLight ? nudeColors.nude800 : nudeColors.darkNude800,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
        color: isLight ? nudeColors.nude700 : nudeColors.darkNude700,
      },
      button: {
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: '0.02em',
      },
    },
    shape: {
      borderRadius: 12,
    },
    shadows: isLight ? [
      'none',
      '0px 2px 4px rgba(61, 53, 48, 0.04)',
      '0px 4px 8px rgba(61, 53, 48, 0.06)',
      '0px 8px 16px rgba(61, 53, 48, 0.08)',
      '0px 12px 24px rgba(61, 53, 48, 0.10)',
      '0px 16px 32px rgba(61, 53, 48, 0.12)',
      '0px 20px 40px rgba(61, 53, 48, 0.14)',
      '0px 24px 48px rgba(61, 53, 48, 0.16)',
      '0px 2px 4px rgba(61, 53, 48, 0.04)',
      '0px 4px 8px rgba(61, 53, 48, 0.06)',
      '0px 8px 16px rgba(61, 53, 48, 0.08)',
      '0px 12px 24px rgba(61, 53, 48, 0.10)',
      '0px 16px 32px rgba(61, 53, 48, 0.12)',
      '0px 20px 40px rgba(61, 53, 48, 0.14)',
      '0px 24px 48px rgba(61, 53, 48, 0.16)',
      '0px 2px 4px rgba(61, 53, 48, 0.04)',
      '0px 4px 8px rgba(61, 53, 48, 0.06)',
      '0px 8px 16px rgba(61, 53, 48, 0.08)',
      '0px 12px 24px rgba(61, 53, 48, 0.10)',
      '0px 16px 32px rgba(61, 53, 48, 0.12)',
      '0px 20px 40px rgba(61, 53, 48, 0.14)',
      '0px 24px 48px rgba(61, 53, 48, 0.16)',
      '0px 2px 4px rgba(61, 53, 48, 0.04)',
      '0px 4px 8px rgba(61, 53, 48, 0.06)',
      '0px 8px 16px rgba(61, 53, 48, 0.08)',
    ] : [
      'none',
      '0px 2px 4px rgba(0, 0, 0, 0.2)',
      '0px 4px 8px rgba(0, 0, 0, 0.25)',
      '0px 8px 16px rgba(0, 0, 0, 0.3)',
      '0px 12px 24px rgba(0, 0, 0, 0.35)',
      '0px 16px 32px rgba(0, 0, 0, 0.4)',
      '0px 20px 40px rgba(0, 0, 0, 0.45)',
      '0px 24px 48px rgba(0, 0, 0, 0.5)',
      '0px 2px 4px rgba(0, 0, 0, 0.2)',
      '0px 4px 8px rgba(0, 0, 0, 0.25)',
      '0px 8px 16px rgba(0, 0, 0, 0.3)',
      '0px 12px 24px rgba(0, 0, 0, 0.35)',
      '0px 16px 32px rgba(0, 0, 0, 0.4)',
      '0px 20px 40px rgba(0, 0, 0, 0.45)',
      '0px 24px 48px rgba(0, 0, 0, 0.5)',
      '0px 2px 4px rgba(0, 0, 0, 0.2)',
      '0px 4px 8px rgba(0, 0, 0, 0.25)',
      '0px 8px 16px rgba(0, 0, 0, 0.3)',
      '0px 12px 24px rgba(0, 0, 0, 0.35)',
      '0px 16px 32px rgba(0, 0, 0, 0.4)',
      '0px 20px 40px rgba(0, 0, 0, 0.45)',
      '0px 24px 48px rgba(0, 0, 0, 0.5)',
      '0px 2px 4px rgba(0, 0, 0, 0.2)',
      '0px 4px 8px rgba(0, 0, 0, 0.25)',
      '0px 8px 16px rgba(0, 0, 0, 0.3)',
    ],
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '10px 24px',
            fontSize: '0.95rem',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: isLight 
                ? '0px 4px 12px rgba(61, 53, 48, 0.15)' 
                : '0px 4px 12px rgba(0, 0, 0, 0.4)',
            },
          },
          contained: {
            background: isLight 
              ? `linear-gradient(135deg, ${nudeColors.nude600} 0%, ${nudeColors.nude700} 100%)`
              : `linear-gradient(135deg, ${nudeColors.darkNude600} 0%, ${nudeColors.darkNude700} 100%)`,
            '&:hover': {
              background: isLight
                ? `linear-gradient(135deg, ${nudeColors.nude700} 0%, ${nudeColors.nude800} 100%)`
                : `linear-gradient(135deg, ${nudeColors.darkNude700} 0%, ${nudeColors.darkNude800} 100%)`,
            },
          },
          outlined: {
            borderColor: isLight ? nudeColors.nude400 : nudeColors.darkNude400,
            color: isLight ? nudeColors.nude800 : nudeColors.darkNude800,
            '&:hover': {
              borderColor: isLight ? nudeColors.nude600 : nudeColors.darkNude600,
              backgroundColor: isLight ? nudeColors.nude50 : nudeColors.darkNude200,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isLight ? '#FFFFFF' : nudeColors.darkNude100,
          },
          elevation1: {
            boxShadow: isLight 
              ? '0px 2px 8px rgba(61, 53, 48, 0.06)'
              : '0px 2px 8px rgba(0, 0, 0, 0.3)',
          },
          elevation2: {
            boxShadow: isLight
              ? '0px 4px 12px rgba(61, 53, 48, 0.08)'
              : '0px 4px 12px rgba(0, 0, 0, 0.35)',
          },
          elevation3: {
            boxShadow: isLight
              ? '0px 8px 20px rgba(61, 53, 48, 0.10)'
              : '0px 8px 20px rgba(0, 0, 0, 0.4)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: `1px solid ${isLight ? nudeColors.nude200 : nudeColors.darkNude300}`,
            transition: 'all 0.3s ease',
            backgroundColor: isLight ? '#FFFFFF' : nudeColors.darkNude100,
            '&:hover': {
              borderColor: isLight ? nudeColors.nude400 : nudeColors.darkNude500,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: isLight
              ? `linear-gradient(135deg, ${nudeColors.nude700} 0%, ${nudeColors.nude800} 100%)`
              : `linear-gradient(135deg, ${nudeColors.darkNude200} 0%, ${nudeColors.darkNude300} 100%)`,
            boxShadow: isLight
              ? '0px 2px 12px rgba(61, 53, 48, 0.12)'
              : '0px 2px 12px rgba(0, 0, 0, 0.5)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
          },
          filled: {
            backgroundColor: isLight ? nudeColors.nude200 : nudeColors.darkNude300,
            color: isLight ? nudeColors.nude900 : nudeColors.darkNude900,
          },
          outlined: {
            borderColor: isLight ? nudeColors.nude400 : nudeColors.darkNude400,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              backgroundColor: isLight ? nudeColors.cream : nudeColors.darkNude200,
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: isLight ? nudeColors.nude500 : nudeColors.darkNude600,
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: isLight ? nudeColors.nude600 : nudeColors.darkNude700,
                borderWidth: 2,
              },
            },
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-root': {
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:nth-of-type(odd)': {
              backgroundColor: isLight ? nudeColors.nude50 : nudeColors.darkNude100,
            },
            '&:hover': {
              backgroundColor: isLight ? nudeColors.nude100 : nudeColors.darkNude200,
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
          standardSuccess: {
            backgroundColor: isLight ? '#F0F4EE' : nudeColors.darkNude200,
            color: nudeColors.success,
          },
          standardWarning: {
            backgroundColor: isLight ? '#FDF8F0' : nudeColors.darkNude200,
            color: nudeColors.warning,
          },
          standardError: {
            backgroundColor: isLight ? '#FDF0F0' : nudeColors.darkNude200,
            color: nudeColors.error,
          },
          standardInfo: {
            backgroundColor: isLight ? nudeColors.nude100 : nudeColors.darkNude200,
            color: isLight ? nudeColors.nude800 : nudeColors.darkNude800,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            color: isLight ? nudeColors.nude600 : nudeColors.darkNude600,
            '&.Mui-selected': {
              color: isLight ? nudeColors.nude900 : nudeColors.darkNude900,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: nudeColors.warmGold,
            height: 3,
            borderRadius: 3,
          },
        },
      },
    },
  })
}

// Default light theme
export const fintechTheme = createFintechTheme('light')

export default fintechTheme
