# Fintech Nude Color Theme

A sophisticated, elegant color palette designed specifically for fintech applications. This theme uses warm, neutral nude tones that convey trust, professionalism, and modernity. **Now with full dark mode support!**

## Features

✨ **Dual Theme Support**: Seamless light and dark mode switching  
🎨 **Sophisticated Palette**: Warm nude tones for both themes  
🌓 **Auto-Detection**: Respects system preferences  
💾 **Persistent**: Saves user preference to localStorage  
♿ **Accessible**: WCAG AA compliant in both modes

## Color Palette

### Light Mode Nude Tones
- **nude50**: `#FAF8F6` - Lightest background
- **nude100**: `#F5F1ED` - Light background
- **nude200**: `#EBE3DB` - Subtle borders
- **nude300**: `#DDD1C5` - Light accents
- **nude400**: `#C9B8A8` - Medium accents
- **nude500**: `#B5A090` - Base nude
- **nude600**: `#9A8577` - Primary brand color
- **nude700**: `#7D6B5D` - Dark accents
- **nude800**: `#5F5248` - Text color
- **nude900**: `#3D3530` - Darkest text

### Dark Mode Nude Tones
- **darkNude50**: `#1A1614` - Darkest background
- **darkNude100**: `#252220` - Dark background
- **darkNude200**: `#332E2B` - Subtle borders
- **darkNude300**: `#423D39` - Dark accents
- **darkNude400**: `#5F5248` - Medium accents
- **darkNude500**: `#7D6B5D` - Base nude
- **darkNude600**: `#9A8577` - Primary brand color
- **darkNude700**: `#B5A090` - Light accents
- **darkNude800**: `#C9B8A8` - Text color
- **darkNude900**: `#DDD1C5` - Lightest text

### Accent Colors
- **warmGold**: `#D4AF37` - Premium accent
- **softGold**: `#E8D5B7` - Light gold accent
- **deepBrown**: `#4A3F35` - Dark contrast
- **cream**: `#FFF9F0` - Warm white
- **sage**: `#A8B5A0` - Success tint
- **terracotta**: `#C97B63` - Warm accent
- **slate**: `#6B7280` - Neutral gray

### Status Colors (Nude-tinted)
- **success**: `#8B9D83` - Muted green
- **warning**: `#D4A574` - Warm amber
- **error**: `#C97B7B` - Soft red
- **info**: `#9B9B9B` - Neutral gray

## Design Principles

### 1. Sophistication
The nude palette creates an upscale, premium feel appropriate for financial services.

### 2. Trust & Stability
Warm, earthy tones convey reliability and security - essential for fintech.

### 3. Accessibility
All color combinations meet WCAG AA standards for contrast ratios.

### 4. Versatility
The palette works well for both light and dark UI elements.

## Usage Guidelines

### Theme Switching

The app includes a theme toggle button in the navigation bar. Users can:
- Click the sun/moon icon to switch themes
- Theme preference is saved to localStorage
- System preference is detected on first visit

```tsx
import { useThemeMode } from './theme/ThemeContext'

function MyComponent() {
  const { mode, toggleTheme } = useThemeMode()
  
  return (
    <button onClick={toggleTheme}>
      Current mode: {mode}
    </button>
  )
}
```

### Backgrounds
- **Light mode**: Use `nude50` for main backgrounds, white for cards
- **Dark mode**: Use `darkNude50` for main backgrounds, `darkNude100` for cards
- Use theme-aware gradients:
```tsx
background: (theme) => theme.palette.mode === 'light'
  ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)'
  : 'linear-gradient(135deg, rgba(37,34,32,0.9) 0%, rgba(37,34,32,0.7) 100%)'
```

### Text
- **Light mode**: Primary `nude900`, Secondary `nude700`
- **Dark mode**: Primary `darkNude900`, Secondary `darkNude700`
- Always use theme tokens: `color: 'text.primary'` or `color: 'text.secondary'`

### Buttons
- Primary: Gradient from `nude600` to `nude700`
- Secondary: Outlined with `nude400` border
- Accent: Use `warmGold` for CTAs

### Cards & Surfaces
- Use glassmorphism: `rgba(255,255,255,0.9)` with backdrop blur
- Subtle borders: `nude200`
- Hover states: Increase opacity and add `nude400` border

### Shadows
- Use soft shadows with nude tint: `rgba(61, 53, 48, 0.08)`
- Elevation increases shadow opacity, not darkness

## Component Styling

### Forms
- Input backgrounds: `cream` (#FFF9F0)
- Focus borders: `nude600`
- Error states: Tinted with `error` color

### Tables
- Header: Gradient from `nude600` to `nude700`
- Alternating rows: `nude50` background
- Hover: `nude100` background

### Navigation
- AppBar: Gradient from `nude700` to `nude800`
- Active links: `warmGold`
- Hover: `rgba(255,255,255,0.1)` overlay

## Accessibility

All color combinations have been tested for:
- WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)
- Color blindness compatibility
- High contrast mode support

## Examples

### Gradient Text
```tsx
sx={{
  background: 'linear-gradient(135deg, #9A8577 0%, #D4AF37 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}}
```

### Glass Card
```tsx
sx={{
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
  backdropFilter: 'blur(20px)',
  border: '1px solid',
  borderColor: 'divider',
}}
```

### Premium Button
```tsx
sx={{
  background: 'linear-gradient(135deg, #9A8577 0%, #7D6B5D 100%)',
  '&:hover': {
    background: 'linear-gradient(135deg, #7D6B5D 0%, #5F5248 100%)',
  }
}}
```

## Brand Personality

This color scheme conveys:
- **Elegance**: Sophisticated nude tones
- **Trust**: Warm, earthy colors
- **Premium**: Gold accents
- **Modern**: Clean, minimal aesthetic
- **Professional**: Muted, refined palette
- **Approachable**: Warm undertones

Perfect for fintech applications that want to stand out from typical blue/corporate color schemes while maintaining professionalism and trust.
