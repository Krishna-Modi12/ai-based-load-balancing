/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          deep: "#0f0f10",
          DEFAULT: "#19191b",
          page: "#141415",
          card: "#19191b",
          raised: "#232325",
          overlay: "#2b2b2f",
          lowest: "#0f0f10",
          low: "#141415",
          high: "#232325",
          highest: "#2b2b2f",
          bright: "#35353a",
        },
        content: {
          primary: "#ededed",
          secondary: "#a1a1a6",
          muted: "#71717a",
        },
        primary: {
          DEFAULT: "#38bdf8",
          light: "#7dd3fc",
          dark: "#0284c7",
        },
        secondary: {
          DEFAULT: "#10b981",
          light: "#34d399",
          dark: "#059669",
        },
        tertiary: {
          DEFAULT: "#818cf8",
          light: "#a5b4fc",
          dark: "#6366f1",
        },
        amber: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
          dark: "#d97706",
        },
        error: {
          DEFAULT: "#e5484d",
          light: "#f87171",
          dark: "#dc2626",
          container: "rgba(229, 72, 77, 0.10)",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.07)",
          DEFAULT: "rgba(255, 255, 255, 0.12)",
          bright: "rgba(255, 255, 255, 0.20)",
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
        sans: ['"Inter"', '"Plus Jakarta Sans"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
}
