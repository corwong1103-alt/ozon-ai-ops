import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        rail: "rgb(var(--rail) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        violet: "rgb(var(--accent-2) / <alpha-value>)",
        rust: "rgb(var(--rust) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        steel: "rgb(var(--steel) / <alpha-value>)",
        alert: "rgb(var(--alert) / <alpha-value>)"
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        ledger: "0 18px 50px rgb(24 20 16 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
