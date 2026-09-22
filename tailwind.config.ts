import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Warm-tinted neutrals: earthier than slate, reads "field work" not "fintech".
        bark: {
          50: "#f8f7f5", 100: "#f0eeea", 200: "#e2dfd8", 300: "#cbc6bc",
          400: "#a9a296", 500: "#8a8376", 600: "#6f6859", 700: "#585245",
          800: "#3a3630", 900: "#26231e", 950: "#171512",
        },
        moss: {
          50: "#f0f7f2", 100: "#dbebe0", 200: "#b9d8c4", 300: "#8bbd9f",
          400: "#5a9c77", 500: "#3a8059", 600: "#2a6746", 700: "#22523a",
          800: "#1d4230", 900: "#193729", 950: "#0d1f17",
        },
        clay: {
          50: "#fdf5ef", 100: "#fae8d9", 200: "#f4cdb2", 300: "#ecaa81",
          400: "#e2804e", 500: "#d9612c", 600: "#c74a22", 700: "#a5371e",
          800: "#842e1f", 900: "#6b291c", 950: "#39120c",
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
               '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo',
               'Consolas', '"Liberation Mono"', 'monospace'],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      borderRadius: { sm: "3px", DEFAULT: "5px", md: "6px", lg: "8px", xl: "10px" },
      boxShadow: {
        hair: "0 1px 0 0 rgb(0 0 0 / 0.04)",
        card: "0 1px 2px 0 rgb(23 21 18 / 0.04), 0 1px 3px 0 rgb(23 21 18 / 0.03)",
        pop: "0 4px 6px -1px rgb(23 21 18 / 0.07), 0 12px 24px -8px rgb(23 21 18 / 0.12)",
        cmd: "0 16px 48px -12px rgb(23 21 18 / 0.28)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "pulse-dot": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: {
        "fade-up": "fade-up 180ms cubic-bezier(0.22,1,0.36,1)",
        "slide-in": "slide-in 220ms cubic-bezier(0.22,1,0.36,1)",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
