import type { Config } from 'tailwindcss';

export default {
  content: [
    './app.vue',
    './pages/**/*.vue',
    './components/**/*.vue',
    './layouts/**/*.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        // ── İnk (artık AÇIK NÖTRLER) — yüzey arka planları ──
        // Önceki tema siyahtı; bu rampa beyazdan açık griye akar.
        ink: {
          0: '#ffffff',
          50: '#fbfbfc',
          100: '#f6f6f8',   // base body bg
          200: '#eeeef1',   // ikincil yüzey
          300: '#e4e4e9',   // elevated kart
          400: '#c8c8d0',
          500: '#9a9aa3',
        },

        // ── Pearl (artık KOYU YAZI RENKLERİ) — açık zeminde okunur ──
        // Eskiden inci beyazlardı; "ana metin" anlamı korunuyor ama koyu antrasit.
        pearl: {
          DEFAULT: '#1c1c20',
          90: 'rgba(28,28,32,0.92)',
          80: 'rgba(28,28,32,0.78)',
          70: 'rgba(28,28,32,0.62)',
          60: 'rgba(28,28,32,0.48)',
          50: 'rgba(28,28,32,0.36)',
          40: 'rgba(28,28,32,0.24)',
          30: 'rgba(28,28,32,0.16)',
          20: 'rgba(28,28,32,0.10)',
          10: 'rgba(28,28,32,0.06)',
          5: 'rgba(28,28,32,0.03)',
        },

        // ── Altın paleti (biraz daha doygun, açık zeminde daha net) ──
        gold: {
          DEFAULT: '#c89a2a',
          primary: '#c89a2a',
          bright: '#e6c452',
          light: '#d8b04a',
          dark: '#a07a1f',
          deep: '#7a5f18',
          soft: 'rgba(200,154,42,0.10)',
          glow: 'rgba(200,154,42,0.22)',
          haze: 'rgba(200,154,42,0.05)',
        },

        // ── Geriye uyumluluk ──
        bg: {
          dark: '#f6f6f8',
          panel: 'rgba(28,28,32,0.03)',
        },
        glass: {
          border: 'rgba(28,28,32,0.10)',
          hover: 'rgba(200,154,42,0.08)',
        },
        // QR müşteri menüsünün koyu temasındaki sıcak krem metin rengi
        // (opaklık varyantları için tek hex — text-cream/55 vb. çalışır).
        cream: '#f4ead6',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #e6c452 0%, #c89a2a 50%, #a07a1f 100%)',
        'gold-line': 'linear-gradient(to right, transparent, #c89a2a, transparent)',
        'gold-radial': 'radial-gradient(circle at top right, rgba(230,196,82,0.28), transparent 60%)',
        'shimmer-gold': 'linear-gradient(105deg, transparent 35%, rgba(230,196,82,0.5) 50%, transparent 65%)',
        'mesh-luxe':
          'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(200,154,42,0.18) 0%, transparent 55%),' +
          'radial-gradient(ellipse 50% 70% at 100% 100%, rgba(230,196,82,0.10) 0%, transparent 55%),' +
          'radial-gradient(ellipse 100% 50% at 50% 110%, rgba(160,122,31,0.06) 0%, transparent 60%),' +
          'linear-gradient(135deg, #fbfbfc 0%, #f0f0f3 50%, #fbfbfc 100%)',
      },
      boxShadow: {
        glass: '0 4px 24px -8px rgba(28,28,32,0.10), 0 1px 0 rgba(255,255,255,0.7) inset',
        'gold-glow': '0 0 24px rgba(200,154,42,0.30), 0 0 0 1px rgba(200,154,42,0.4) inset',
        'gold-glow-strong': '0 0 40px rgba(200,154,42,0.45), 0 0 0 1px rgba(230,196,82,0.7) inset',
        elevated: '0 16px 40px -12px rgba(28,28,32,0.18), 0 0 0 1px rgba(255,255,255,0.6) inset',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.7)',
        'gold-edge': 'inset 0 1px 0 rgba(230,196,82,0.4), 0 8px 24px -10px rgba(28,28,32,0.18)',
        'soft-up': '0 -8px 32px -8px rgba(28,28,32,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 2.5s linear infinite',
        'shimmer-slow': 'shimmer 4s linear infinite',
        'pulse-gold': 'pulseGold 2.5s ease-in-out infinite',
        'pulse-dot': 'pulseDot 1.8s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'gradient-pan': 'gradientPan 8s ease infinite',
        'gold-sweep': 'goldSweep 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200,154,42,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(200,154,42,0)' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.85' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        gradientPan: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        goldSweep: {
          '0%': { backgroundPosition: '-150% 0' },
          '60%, 100%': { backgroundPosition: '250% 0' },
        },
      },
      letterSpacing: {
        'extra-wide': '0.18em',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      transitionTimingFunction: {
        luxe: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
