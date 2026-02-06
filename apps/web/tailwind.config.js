/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        noir: {
          700: '#2a2a2a',
          800: '#1a1a1a',
          900: '#0f0f0f',
          950: '#0a0a0a',
        },
        warm: {
          50: '#fef9f0',
          100: '#fdf0d8',
          200: '#fbe0b0',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
      },
      letterSpacing: {
        'widest-plus': '0.15em',
        'ultra-wide': '0.25em',
        'mega': '0.35em',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out both',
        'slide-in': 'slideIn 0.4s ease-out both',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out both',
      },
      keyframes: {
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideIn: {
          '0%': {
            opacity: '0',
            transform: 'translateX(-12px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        pulseGlow: {
          '0%, 100%': {
            textShadow: '0 0 8px rgba(245, 158, 11, 0.4), 0 0 20px rgba(245, 158, 11, 0.1)',
          },
          '50%': {
            textShadow: '0 0 16px rgba(245, 158, 11, 0.6), 0 0 40px rgba(245, 158, 11, 0.2)',
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
    },
  },
  plugins: [],
};
