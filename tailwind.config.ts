import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          dark: "#05070c",
          card: "rgba(13, 17, 28, 0.75)",
          border: "rgba(0, 240, 255, 0.15)",
          neonCyan: "#00f0ff",
          neonPurple: "#7000ff",
          neonPink: "#ff007f",
          neonGreen: "#00ff88",
          gold: "#ffd700",
        },
      },
      fontFamily: {
        cyber: ["'Gotham'", "'DFVN Grafika'", "var(--font-gotham)", "var(--font-dfvn-grafika)", "var(--font-outfit)", "sans-serif"],
        sans: ["'Gotham'", "var(--font-gotham)", "var(--font-outfit)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      backgroundImage: {
        "cyber-grid": "radial-gradient(circle at center, rgba(0, 240, 255, 0.05) 0%, transparent 70%)",
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-cyan": "glowCyan 2s infinite alternate",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        glowCyan: {
          "0%": { boxShadow: "0 0 5px rgba(0, 240, 255, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 240, 255, 0.8), 0 0 30px rgba(112, 0, 255, 0.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
