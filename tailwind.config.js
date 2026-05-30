/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,html}"],
  theme: {
    extend: {
      colors: {
        "rez-cyan": "#00f0ff",
        "rez-cyan-dim": "#00a3ad",
        "rez-red": "#ff003c",
        "rez-bg": "#050505",
        "rez-panel": "#0a0a0a",
        "terminal-green": "#0f0",
        primary: "#00f0ff",
        "primary-dim": "#00a3ad",
        "accent-red": "#ff003c",
        "background-light": "#f6f7f8",
        "background-dark": "#020202",
        "background-panel": "#0a0a0a",
        glass: "rgba(255, 255, 255, 0.03)",
        "glass-border": "rgba(0, 240, 255, 0.15)",
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Manrope", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      animation: {
        "spin-slow": "spin 8s linear infinite",
        "spin-reverse": "spin 3s linear infinite reverse",
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scan: "scan 2s linear infinite",
        shine: "shine 0.75s ease-in-out",
      },
      keyframes: {
        scan: {
          "0%": { top: "0%", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { top: "100%", opacity: "0" },
        },
        shine: {
          from: { transform: "translateX(-100%) skewX(12deg)" },
          to: { transform: "translateX(100%) skewX(12deg)" },
        },
      },
      boxShadow: {
        neon: "0 0 10px rgba(0, 240, 255, 0.3), 0 0 20px rgba(0, 240, 255, 0.1)",
        glitch: "2px 0 #ff003c, -2px 0 #00f0ff",
      },
      backgroundImage: {
        scanlines:
          "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
        "grid-pattern":
          "linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
