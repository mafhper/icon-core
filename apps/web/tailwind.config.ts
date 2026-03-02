import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        core: {
          bg: 'var(--core-bg)',
          surface: 'var(--core-surface)',
          elevated: 'var(--core-elevated)',
          border: 'var(--core-border)',
          text: 'var(--core-text)',
          muted: 'var(--core-muted)',
          accent: 'var(--core-accent)',
          success: 'var(--core-success)',
          warning: 'var(--core-warning)',
          danger: 'var(--core-danger)'
        }
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Sora"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      boxShadow: {
        panel: '0 20px 40px rgba(0, 0, 0, 0.32)'
      }
    }
  },
  plugins: []
} satisfies Config;
