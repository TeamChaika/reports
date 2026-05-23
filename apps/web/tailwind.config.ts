import type { Config } from 'tailwindcss'

/**
 * Tailwind CSS configuration — Shift Reports
 *
 * Design philosophy:
 * - All colour values reference CSS custom properties from tokens.css.
 * - This means theme switching (if ever needed) happens only in tokens.css.
 * - No hardcoded hex/rgb/oklch values inside this file.
 * - Spacing, radius, and shadow scales mirror the token ladder precisely.
 *
 * Class naming mirrors the token names verbatim for discoverability:
 *   --color-bg            → bg-bg, text-bg, border-bg
 *   --color-surface       → bg-surface
 *   --color-accent        → bg-accent, text-accent, border-accent
 *   --color-text-muted    → text-text-muted
 *   --color-success       → bg-success, text-success, border-success
 *   etc.
 */

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],

  // Dark mode is always on — no toggle, no class switching.
  // The app is dark-only; the `dark` variant is left available for
  // the Telegram Mini App if it ever needs to respond to Telegram's
  // colorScheme setting.
  darkMode: 'class',

  theme: {
    // ----------------------------------------------------------------
    // Override Tailwind defaults entirely for colours, radii, shadows.
    // We do NOT extend the defaults because we want no stray values
    // (e.g. Tailwind's `gray-500`) leaking into the codebase.
    // Spacing is extended (not overridden) to keep Tailwind's full
    // utility ladder while adding our named tokens.
    // ----------------------------------------------------------------

    colors: {
      transparent: 'transparent',
      current:     'currentColor',
      white:       'oklch(100% 0 0)',
      black:       'oklch(0% 0 0)',

      /* ----------------------------------------------------------------
       * Background layers
       * ---------------------------------------------------------------- */
      bg:             'var(--color-bg)',
      surface:        'var(--color-surface)',
      'surface-raised':  'var(--color-surface-raised)',
      'surface-overlay': 'var(--color-surface-overlay)',

      /* ----------------------------------------------------------------
       * Borders
       * ---------------------------------------------------------------- */
      border:          'var(--color-border)',
      'border-subtle': 'var(--color-border-subtle)',
      'border-focus':  'var(--color-border-focus)',

      /* ----------------------------------------------------------------
       * Text
       * ---------------------------------------------------------------- */
      text:            'var(--color-text)',
      'text-muted':    'var(--color-text-muted)',
      'text-disabled': 'var(--color-text-disabled)',
      'text-inverse':  'var(--color-text-inverse)',
      'text-link':     'var(--color-text-link)',

      /* ----------------------------------------------------------------
       * Accent (interactive)
       * ---------------------------------------------------------------- */
      accent:          'var(--color-accent)',
      'accent-hover':  'var(--color-accent-hover)',
      'accent-active': 'var(--color-accent-active)',
      'accent-subtle': 'var(--color-accent-subtle)',
      'accent-border': 'var(--color-accent-border)',
      'accent-fg':     'var(--color-accent-fg)',

      /* ----------------------------------------------------------------
       * Status — success
       * ---------------------------------------------------------------- */
      success:          'var(--color-success)',
      'success-hover':  'var(--color-success-hover)',
      'success-bg':     'var(--color-success-bg)',
      'success-border': 'var(--color-success-border)',
      'success-fg':     'var(--color-success-fg)',

      /* ----------------------------------------------------------------
       * Status — warning
       * ---------------------------------------------------------------- */
      warning:          'var(--color-warning)',
      'warning-hover':  'var(--color-warning-hover)',
      'warning-bg':     'var(--color-warning-bg)',
      'warning-border': 'var(--color-warning-border)',
      'warning-fg':     'var(--color-warning-fg)',

      /* ----------------------------------------------------------------
       * Status — danger
       * ---------------------------------------------------------------- */
      danger:          'var(--color-danger)',
      'danger-hover':  'var(--color-danger-hover)',
      'danger-bg':     'var(--color-danger-bg)',
      'danger-border': 'var(--color-danger-border)',
      'danger-fg':     'var(--color-danger-fg)',

      /* ----------------------------------------------------------------
       * Status — info
       * ---------------------------------------------------------------- */
      info:            'var(--color-info)',
      'info-hover':    'var(--color-info-hover)',
      'info-bg':       'var(--color-info-bg)',
      'info-border':   'var(--color-info-border)',
      'info-fg':       'var(--color-info-fg)',

      /* ----------------------------------------------------------------
       * Neutral
       * ---------------------------------------------------------------- */
      neutral:          'var(--color-neutral)',
      'neutral-bg':     'var(--color-neutral-bg)',
      'neutral-border': 'var(--color-neutral-border)',
      'neutral-fg':     'var(--color-neutral-fg)',
    },

    /* ------------------------------------------------------------------
     * Border radius — mirrors --radius-* token ladder
     * ------------------------------------------------------------------ */
    borderRadius: {
      none: '0',
      xs:   'var(--radius-xs)',
      sm:   'var(--radius-sm)',
      DEFAULT: 'var(--radius-md)',
      md:   'var(--radius-md)',
      lg:   'var(--radius-lg)',
      xl:   'var(--radius-xl)',
      '2xl': 'var(--radius-2xl)',
      full: 'var(--radius-full)',
    },

    /* ------------------------------------------------------------------
     * Box shadows — mirrors --shadow-* token ladder
     * ------------------------------------------------------------------ */
    boxShadow: {
      none:  'none',
      xs:    'var(--shadow-xs)',
      sm:    'var(--shadow-sm)',
      DEFAULT: 'var(--shadow-md)',
      md:    'var(--shadow-md)',
      lg:    'var(--shadow-lg)',
      xl:    'var(--shadow-xl)',
      'accent-glow': 'var(--shadow-accent-glow)',
    },

    /* ------------------------------------------------------------------
     * Font families — mirrors --font-* tokens
     * ------------------------------------------------------------------ */
    fontFamily: {
      sans: ['var(--font-sans)'],
      mono: ['var(--font-mono)'],
    },

    /* ------------------------------------------------------------------
     * Font sizes — mirrors --text-* fluid scale tokens
     * ------------------------------------------------------------------ */
    fontSize: {
      xs:   ['var(--text-xs)',   { lineHeight: 'var(--leading-normal)' }],
      sm:   ['var(--text-sm)',   { lineHeight: 'var(--leading-normal)' }],
      base: ['var(--text-base)', { lineHeight: 'var(--leading-normal)' }],
      md:   ['var(--text-md)',   { lineHeight: 'var(--leading-snug)' }],
      lg:   ['var(--text-lg)',   { lineHeight: 'var(--leading-snug)' }],
      xl:   ['var(--text-xl)',   { lineHeight: 'var(--leading-tight)' }],
      '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
      '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
    },

    /* ------------------------------------------------------------------
     * Font weights
     * ------------------------------------------------------------------ */
    fontWeight: {
      normal:   'var(--font-weight-normal)',
      medium:   'var(--font-weight-medium)',
      semibold: 'var(--font-weight-semibold)',
      bold:     'var(--font-weight-bold)',
    },

    /* ------------------------------------------------------------------
     * Line heights
     * ------------------------------------------------------------------ */
    lineHeight: {
      tight:   'var(--leading-tight)',
      snug:    'var(--leading-snug)',
      normal:  'var(--leading-normal)',
      relaxed: 'var(--leading-relaxed)',
    },

    /* ------------------------------------------------------------------
     * Letter spacing
     * ------------------------------------------------------------------ */
    letterSpacing: {
      tight:   'var(--tracking-tight)',
      normal:  'var(--tracking-normal)',
      wide:    'var(--tracking-wide)',
      widest:  'var(--tracking-widest)',
    },

    /* ------------------------------------------------------------------
     * Transition durations — mirrors --duration-* tokens
     * ------------------------------------------------------------------ */
    transitionDuration: {
      instant: 'var(--duration-instant)',
      fast:    'var(--duration-fast)',
      DEFAULT: 'var(--duration-normal)',
      normal:  'var(--duration-normal)',
      slow:    'var(--duration-slow)',
      lazy:    'var(--duration-lazy)',
    },

    /* ------------------------------------------------------------------
     * Transition timing functions — mirrors --ease-* tokens
     * ------------------------------------------------------------------ */
    transitionTimingFunction: {
      DEFAULT:    'var(--ease-out)',
      out:        'var(--ease-out)',
      in:         'var(--ease-in)',
      'in-out':   'var(--ease-in-out)',
      'out-expo': 'var(--ease-out-expo)',
      spring:     'var(--ease-spring)',
    },

    /* ------------------------------------------------------------------
     * Z-index — mirrors --z-* tokens
     * ------------------------------------------------------------------ */
    zIndex: {
      auto:    'auto',
      base:    'var(--z-base)',
      raised:  'var(--z-raised)',
      sticky:  'var(--z-sticky)',
      overlay: 'var(--z-overlay)',
      modal:   'var(--z-modal)',
      toast:   'var(--z-toast)',
      tooltip: 'var(--z-tooltip)',
    },

    /* ------------------------------------------------------------------
     * Spacing — extend Tailwind's default scale with our named tokens.
     * Tailwind's numeric scale (p-4 = 1rem) is kept intact; these add
     * semantic names for common spacing values used in components.
     * ------------------------------------------------------------------ */
    extend: {
      spacing: {
        '0.5': 'var(--space-0-5)',
        '1':   'var(--space-1)',
        '1.5': 'var(--space-1-5)',
        '2':   'var(--space-2)',
        '2.5': 'var(--space-2-5)',
        '3':   'var(--space-3)',
        '4':   'var(--space-4)',
        '5':   'var(--space-5)',
        '6':   'var(--space-6)',
        '8':   'var(--space-8)',
        '10':  'var(--space-10)',
        '12':  'var(--space-12)',
        '16':  'var(--space-16)',
        '20':  'var(--space-20)',
      },

      /* Named heights for common interactive element sizes */
      height: {
        'btn-sm': '28px',
        'btn':    '36px',
        'btn-lg': '44px',
        'input':  '40px',
        'input-sm': '32px',
      },

      /* Sidebar width */
      width: {
        'sidebar': '240px',
      },

      /* Fluid viewport-based heights */
      minHeight: {
        'screen': '100dvh',
      },

      /* Max widths for content areas */
      maxWidth: {
        'page': '1280px',
        'form': '640px',
        'prose': '65ch',
      },

      /* Custom screens for the app — 320 min for Telegram Mini App */
      screens: {
        'xs':   '375px',
        'sm':   '640px',
        'md':   '768px',
        'lg':   '1024px',
        'xl':   '1280px',
        '2xl':  '1536px',
      },

      /* Animation utilities beyond Tailwind defaults */
      animation: {
        'spin-slow':    'spin 2s linear infinite',
        'fade-in':      'fadeIn var(--duration-normal) var(--ease-out) forwards',
        'slide-up':     'slideUp var(--duration-normal) var(--ease-out-expo) forwards',
        'slide-down':   'slideDown var(--duration-normal) var(--ease-out-expo) forwards',
        'scale-in':     'scaleIn var(--duration-fast) var(--ease-out-expo) forwards',
        'shimmer':      'skeleton-shimmer 1.5s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },

  plugins: [
    /**
     * typography plugin — if added in the future, configure here.
     * Example: require('@tailwindcss/typography')
     *
     * No third-party plugins are installed at this stage per YAGNI.
     */
  ],
}

export default config
