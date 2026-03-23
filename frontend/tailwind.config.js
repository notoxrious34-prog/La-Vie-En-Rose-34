/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        // Fluid typography for 4K/8K displays
        'display': ['clamp(2.5rem, 5vw, 4.5rem)', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
        'h1': ['clamp(2rem, 4vw, 3.5rem)', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.01em' }],
        'h2': ['clamp(1.5rem, 3vw, 2.5rem)', { lineHeight: '1.25', fontWeight: '700' }],
        'h3': ['clamp(1.25rem, 2.5vw, 2rem)', { lineHeight: '1.3', fontWeight: '600' }],
        'h4': ['clamp(1.125rem, 2vw, 1.5rem)', { lineHeight: '1.35', fontWeight: '600' }],
        'body': ['clamp(0.875rem, 1.5vw, 1.125rem)', { lineHeight: '1.6' }],
        'small': ['clamp(0.75rem, 1vw, 0.875rem)', { lineHeight: '1.5' }],
        'xs': ['clamp(0.625rem, 0.75vw, 0.75rem)', { lineHeight: '1.4', letterSpacing: '0.05em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        '128': '32rem',
        '144': '36rem',
        '160': '40rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },
      screens: {
        '3xl': '1920px',
        '4xl': '2560px',
        '5xl': '3840px',
      },
      colors: {
        roseBrand: {
          50: '#fff3f7',
          100: '#ffe5ee',
          200: '#ffd1dc',
          300: '#ffacc2',
          400: '#ff7aa1',
          500: '#ff4f87',
          600: '#eb2f6f',
          700: '#c71f58',
          800: '#9f1947',
          900: '#82143a'
        },
        goldBrand: {
          50: '#fffaf0',
          100: '#fff0cf',
          200: '#ffe2a3',
          300: '#ffd06b',
          400: '#e6bf49',
          500: '#c9a227',
          600: '#a88418',
          700: '#856812',
          800: '#654f0d',
          900: '#4c3b09'
        },
        surface: {
          base: 'var(--surface-1)',
          soft: 'color-mix(in srgb, var(--surface-1) 72%, transparent)',
          glass: 'color-mix(in srgb, var(--surface-1) 55%, transparent)'
        }
      },
      boxShadow: {
        glass: 'var(--shadow-control)',
        luxe: 'var(--shadow-surface-hover)',
        glow: '0 0 0 1px color-mix(in srgb, var(--surface-1) 35%, transparent), 0 10px 30px color-mix(in srgb, var(--accent) 14%, transparent)'
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'Noto Sans Arabic', 'Noto Sans', 'sans-serif']
      }
    }
  },
  plugins: []
};
