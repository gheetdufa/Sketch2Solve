import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        s2s: {
          bg: "#0c0c1d",
          panel: "#12122b",
          surface: "#1a1a3e",
          border: "#252550",
          "border-light": "#2f2f60",
          accent: "#635bff",
          "accent-hover": "#7c75ff",
          "accent-muted": "rgba(99,91,255,0.12)",
          hint: "#f59e0b",
          "hint-muted": "rgba(245,158,11,0.12)",
          success: "#10b981",
          danger: "#ef4444",
          text: "#eeeef2",
          "text-secondary": "#a0a0c0",
          "text-muted": "#6b6b90",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
    },
  },
  plugins: [],
};
export default config;
