/**
 * Theme Colors
 * Matching the web application CSS variables
 */

export const colors = {
  // Primary palette
  primary: '#9B8AA5',
  primaryLight: '#C8BFCF',
  primaryDark: '#6B5A75',

  // Secondary
  secondary: '#B8A9C4',

  // Background colors
  background: '#FAF8FC',
  surface: '#FFFFFF',
  surfaceLight: '#FDFCFE',

  // Text colors
  textPrimary: '#2D2A33',
  textSecondary: '#6B6B7B',
  textLight: '#FFFFFF',
  textMuted: '#9595A5',

  // Status colors
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  danger: '#E57373',
  dangerLight: '#FFEBEE',
  info: '#2196F3',
  infoLight: '#E3F2FD',

  // Mood colors (1-10 scale)
  mood: {
    1: '#E57373',
    2: '#EF9A9A',
    3: '#FFAB91',
    4: '#FFCC80',
    5: '#FFE082',
    6: '#FFF59D',
    7: '#E6EE9C',
    8: '#C5E1A5',
    9: '#A5D6A7',
    10: '#81C784'
  },

  // Border
  border: '#E8E4EC',
  borderLight: '#F3F0F6',

  // Shadow (for StyleSheet)
  shadow: {
    color: '#9B8AA5',
    opacity: 0.15
  },

  // Transparent variants
  overlay: 'rgba(0, 0, 0, 0.5)',
  primaryOverlay: 'rgba(155, 138, 165, 0.1)'
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999
};

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const
};

export default {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight
};
