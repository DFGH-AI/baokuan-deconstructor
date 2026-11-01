/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/app.js'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#06080f',
          800: '#090d17',
          700: '#0d1220',
          600: '#121a2b'
        },
        brand: {
          300: '#a99bff',
          400: '#8f7dff',
          500: '#755cff',
          600: '#5f45e8'
        },
        ember: {
          400: '#ff8a65',
          500: '#ff6b45'
        }
      },
      fontFamily: {
        sans: [
          '"SF Pro Display"',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif'
        ],
        mono: ['"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'monospace']
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,.05) inset, 0 24px 70px -30px rgba(0,0,0,.9)',
        cta: '0 18px 46px -12px rgba(117,92,255,.65), 0 0 0 1px rgba(255,255,255,.12) inset',
        glow: '0 0 80px -20px rgba(117,92,255,.55)'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }
        },
        pulseRing: {
          '0%': { transform: 'scale(.92)', opacity: '.65' },
          '70%, 100%': { transform: 'scale(1.35)', opacity: '0' }
        },
        scan: {
          '0%': { transform: 'translateY(-120%)', opacity: '0' },
          '15%': { opacity: '.9' },
          '100%': { transform: 'translateY(520%)', opacity: '0' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2.8s ease-out infinite',
        scan: 'scan 3.4s linear infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-up': 'fadeUp .4s ease-out both'
      }
    }
  },
  plugins: []
};
