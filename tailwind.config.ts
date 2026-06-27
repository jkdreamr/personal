import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Harbor fixed palette, exposed as CSS variables for theming consistency.
        canvas: "var(--harbor-canvas)",
        surface: "var(--harbor-surface)",
        ink: "var(--harbor-ink)",
        muted: "var(--harbor-muted)",
        "muted-soft": "var(--harbor-muted-soft)",
        success: "var(--harbor-success)",
        warning: "var(--harbor-warning)",
        danger: "var(--harbor-danger)",
        // hairline border derived from ink
        line: "var(--harbor-line)",
      },
      fontFamily: {
        // One neutral system stack. `display` intentionally aliases `sans` — no separate
        // display/serif face — so any remaining `font-display` class stays Helvetica.
        sans: ["var(--font-sans)", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        display: ["var(--font-sans)", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
      fontSize: {
        meta: ["0.8125rem", { lineHeight: "1.45" }],
        sm: ["0.9375rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.6" }],
        lead: ["1.125rem", { lineHeight: "1.6" }],
      },
      borderRadius: {
        chip: "6px",
        btn: "8px",
        card: "10px",
      },
      maxWidth: {
        prose: "44rem",
      },
      boxShadow: {
        overlay: "0 12px 32px -8px rgb(57 62 70 / 0.18), 0 2px 8px -2px rgb(57 62 70 / 0.12)",
        card: "0 1px 2px rgb(57 62 70 / 0.04)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out both",
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
