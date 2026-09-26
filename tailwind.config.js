/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        obsidian: {
          950: '#07080B',
          900: '#0B0E14',
          850: '#10141D',
          800: '#161B26',
          750: '#1D2331',
          700: '#252C3D',
          600: '#38435C',
          500: '#4D5B7C',
        },
        // Logo Primary Brand: Electric Blaze Orange (#FD5900)
        blaze: {
          300: '#FFA280',
          400: '#FE7B40',
          500: '#FD5900', // Logo main orange
          600: '#D84700',
          700: '#A83500',
          800: '#7A2500',
          900: '#4D1700',
          950: '#2E0D00',
        },
        // Logo Secondary Brand: Deep Electric Violet (#6E16BE)
        violet: {
          300: '#BE88F5',
          400: '#9C52ED',
          500: '#6E16BE', // Logo main purple
          600: '#5A0E9F',
          700: '#46097F',
          800: '#33055E',
          900: '#220340',
          950: '#140126',
        },
        // Telemetry system mapped to Logo Primary Orange (#FD5900)
        telemetry: {
          300: '#FFA280',
          400: '#FE7B40',
          500: '#FD5900', // Primary brand accent
          600: '#D84700',
          700: '#A83500',
          950: '#2E0D00',
        },
        // Neural & Compute system mapped to Logo Secondary Violet (#6E16BE)
        neural: {
          300: '#BE88F5',
          400: '#9C52ED',
          500: '#6E16BE',
          600: '#5A0E9F',
          700: '#46097F',
          950: '#140126',
        },
        phosphor: {
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          950: '#022C22',
        },
        voltage: {
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          950: '#451A03',
        },
        laser: {
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
          950: '#4C0519',
        },
      },
      boxShadow: {
        'bevel': 'none',
        'bevel-subtle': 'none',
        'bevel-active': 'none',
        'well': 'none',
        'glow-orange': 'none',
        'glow-violet': 'none',
        'glow-cyan': 'none',
        'glow-emerald': 'none',
        'glow-amber': 'none',
        'jewel-green': 'none',
        'jewel-amber': 'none',
        'jewel-orange': 'none',
        'jewel-violet': 'none',
      },
      borderColor: {
        'hairline': 'rgba(255, 255, 255, 0.07)',
        'hairline-subtle': 'rgba(255, 255, 255, 0.04)',
        'hairline-bright': 'rgba(255, 255, 255, 0.12)',
      },
    },
  },
  plugins: [],
}
