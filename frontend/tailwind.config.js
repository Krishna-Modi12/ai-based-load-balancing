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
          lowest: "#050b14",
          low: "#0a1322",
          DEFAULT: "#0f1b2e",
          high: "#15243c",
          highest: "#1d3150",
          bright: "#253e66",
        },
        primary: {
          DEFAULT: "#06b6d4",
          light: "#38bdf8",
          dark: "#0891b2",
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
          DEFAULT: "#ef4444",
          light: "#f87171",
          dark: "#dc2626",
          container: "rgba(239, 68, 68, 0.12)",
        },
        border: {
          subtle: "#1c2e47",
          DEFAULT: "#263f61",
          bright: "#3b5f8f",
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
        sans: ['"Inter"', '"Plus Jakarta Sans"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      animation: {
        beacon: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }
    },
  },
  plugins: [],
}
