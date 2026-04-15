/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        radar: {
          bg: "#0a0e14",
          green: "#00ff88",
          amber: "#ffaa00",
          red: "#ff3344",
          blue: "#4488ff",
          text: "#88aacc",
        },
      },
      fontFamily: {
        ui: ["Space Grotesk", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}

