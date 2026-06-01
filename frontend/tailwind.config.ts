import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#080b12",
          panel: "#0d1120",
          border: "#1a2540",
          cyan: "#00d4ff",
          green: "#00ff9f",
          purple: "#8b5cf6",
          red: "#ff4560",
          yellow: "#ffd700",
          text: "#c8d8f0",
          muted: "#4a6080",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan": "scan 2s linear infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)", opacity: "0.4" },
          "100%": { transform: "translateY(100vh)", opacity: "0.4" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px #00d4ff40, 0 0 10px #00d4ff20" },
          "100%": { boxShadow: "0 0 20px #00d4ff80, 0 0 40px #00d4ff40" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
