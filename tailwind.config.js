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
        // Corporate Trust Primary Brand: Indigo 600 (#4F46E5)
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5', // Main Primary
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        // Corporate Trust Secondary Brand: Violet 600 (#7C3AED)
        accent: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED', // Main Secondary
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          950: '#2E1065',
        },
        // Obsidian palette mapped to polished slate neutrals
        obsidian: {
          950: '#0B0F19',
          900: '#0F172A',
          850: '#172033',
          800: '#1E293B',
          750: '#273449',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
        },
        // Backward-compatible semantic bridges mapped to Corporate Trust
        blaze: {
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4F46E5', // Mapped to Corporate Trust Indigo 600
          600: '#4338CA',
          700: '#3730A3',
          800: '#312E81',
          900: '#1E1B4B',
          950: '#0F172A',
        },
        violet: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED', // Secondary
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          950: '#2E1065',
        },
        telemetry: {
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4F46E5', // Primary brand accent
          600: '#4338CA',
          700: '#3730A3',
          950: '#EEF2FF',
        },
        neural: {
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#7C3AED', // Secondary brand accent
          600: '#6D28D9',
          700: '#5B21B6',
          950: '#F5F3FF',
        },
        phosphor: {
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981', // Emerald 500
          600: '#059669',
          950: '#ECFDF5',
        },
        voltage: {
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B', // Amber 500
          600: '#D97706',
          950: '#FFFBEB',
        },
        laser: {
          400: '#FB7185',
          500: '#F43F5E', // Rose 500
          600: '#E11D48',
          950: '#FFF1F2',
        },
      },
      boxShadow: {
        'corporate': '0 4px 20px -2px rgba(79, 70, 229, 0.1)',
        'corporate-hover': '0 10px 25px -5px rgba(79, 70, 229, 0.15), 0 8px 10px -6px rgba(79, 70, 229, 0.1)',
        'corporate-btn': '0 4px 14px 0 rgba(79, 70, 229, 0.3)',
        'corporate-glow': '0 0 20px rgba(79, 70, 229, 0.5)',
        'bevel': '0 4px 20px -2px rgba(79, 70, 229, 0.08)',
        'bevel-subtle': '0 2px 8px -1px rgba(79, 70, 229, 0.06)',
        'bevel-active': 'inset 0 1px 2px rgba(79, 70, 229, 0.15)',
        'well': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'glow-orange': '0 0 16px rgba(79, 70, 229, 0.35)',
        'glow-violet': '0 0 16px rgba(124, 58, 237, 0.35)',
        'glow-cyan': '0 0 16px rgba(79, 70, 229, 0.25)',
        'glow-emerald': '0 0 16px rgba(16, 185, 129, 0.35)',
        'glow-amber': '0 0 16px rgba(245, 158, 11, 0.35)',
        'jewel-green': '0 0 12px rgba(16, 185, 129, 0.3)',
        'jewel-amber': '0 0 12px rgba(245, 158, 11, 0.3)',
        'jewel-orange': '0 0 12px rgba(79, 70, 229, 0.3)',
        'jewel-violet': '0 0 12px rgba(124, 58, 237, 0.3)',
      },
      borderColor: {
        'hairline': 'rgba(226, 232, 240, 0.8)',
        'hairline-subtle': 'rgba(226, 232, 240, 0.4)',
        'hairline-bright': 'rgba(79, 70, 229, 0.25)',
      },
    },
  },
  plugins: [],
}
