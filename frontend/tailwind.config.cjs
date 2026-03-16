/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'fade-out': 'fadeOut 0.15s ease-in forwards',
        'fade-in-up': 'fadeInUp 0.8s ease-out',
        'fade-in-left': 'fadeInLeft 0.8s ease-out',
        'fade-in-right': 'fadeInRight 0.8s ease-out',
        'scale-in': 'scaleIn 0.6s ease-out',
        'draw-line': 'drawLine 2.5s ease-out forwards',
        'float': 'float 4s ease-in-out infinite',
        'pulse-slow': 'pulseSlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'cursor-wireframe': 'cursorWireframe 3s ease-in-out infinite',
        'cursor-mindmap': 'cursorMindmap 6s ease-in-out infinite',
        'cursor-flow': 'cursorFlow 5s ease-in-out infinite',
        'cursor-sticky': 'cursorSticky 3.5s ease-in-out infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.9)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInRight: {
          '0%': { opacity: '0', transform: 'translateX(40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        drawLine: {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
        cursorWireframe: {
          '0%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(80px, 20px)' },
          '50%': { transform: 'translate(10px, 30px)' },
          '75%': { transform: 'translate(-10px, 15px)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        cursorMindmap: {
          '0%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(80px, 80px)' },
          '40%': { transform: 'translate(-80px, 80px)' },
          '60%': { transform: 'translate(80px, -120px)' },
          '80%': { transform: 'translate(-80px, -120px)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        cursorFlow: {
          '0%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(160px)' },
          '50%': { transform: 'translateX(320px)' },
          '75%': { transform: 'translateX(480px)' },
          '100%': { transform: 'translateX(0)' },
        },
        cursorSticky: {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(100px, -100px) rotate(15deg)' },
          '50%': { transform: 'translate(-100px, 100px) rotate(-30deg)' },
          '75%': { transform: 'translate(-20px, 10px) rotate(2deg)' },
          '100%': { transform: 'translate(0, 0) rotate(0deg)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: 'hsl(var(--secondary))',
        destructive: 'hsl(var(--destructive))',
        // Dashboard-specific colors
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          accent: 'hsl(var(--sidebar-accent))',
          foreground: 'hsl(var(--sidebar-foreground))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
        },
        accent: {
          blue: {
            DEFAULT: 'hsl(var(--accent-blue))',
            10: 'hsla(var(--accent-blue), 0.1)',
            20: 'hsla(var(--accent-blue), 0.2)'
          },
          green: {
            DEFAULT: 'hsl(var(--accent-green))',
            10: 'hsla(var(--accent-green), 0.1)',
            20: 'hsla(var(--accent-green), 0.2)'
          },
          yellow: {
            DEFAULT: 'hsl(var(--accent-yellow))',
            10: 'hsla(var(--accent-yellow), 0.1)',
            20: 'hsla(var(--accent-yellow), 0.2)'
          }
        }
      },
      zIndex: {
        'canvas': 'var(--z-canvas)',
        'grid': 'var(--z-grid)',
        'selection': 'var(--z-selection)',
        'cursors': 'var(--z-cursors)',
        'ui': 'var(--z-ui)',
        'chat': 'var(--z-chat)',
        'dropdowns': 'var(--z-dropdowns)',
        'modals': 'var(--z-modals)',
        'toasts': 'var(--z-toasts)',
      }
    },
  },
  plugins: [],
}