/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#09090b',
          secondary: '#0c0c0e',
          elevated: '#141414',
        },
        sheet: '#1c1c1e',
        border: '#262626',
        primary: '#00C853',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        purple: '#a855f7',
        cyan: '#06b6d4',
        pink: '#ec4899',
        orange: '#f97316',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
      },
      fontSize: {
        'large-title': ['28px', { lineHeight: '34px', fontWeight: '700' }],
        title: ['22px', { lineHeight: '28px', fontWeight: '700' }],
        headline: ['17px', { lineHeight: '22px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '20px', fontWeight: '400' }],
        subheadline: ['13px', { lineHeight: '18px', fontWeight: '400' }],
        caption: ['11px', { lineHeight: '13px', fontWeight: '400' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        xxl: '24px',
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        sheet: '28px',
        pill: '999px',
      },
    },
  },
  plugins: [],
}
