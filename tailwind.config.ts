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
        sand: "rgb(var(--sand) / <alpha-value>)",
        earth: "rgb(var(--earth) / <alpha-value>)",
        terracotta: "rgb(var(--terracotta) / <alpha-value>)",
        parchment: "rgb(var(--parchment) / <alpha-value>)",
        clay: "rgb(var(--clay) / <alpha-value>)",
        dust: "rgb(var(--dust) / <alpha-value>)",
        spice: "rgb(var(--spice) / <alpha-value>)",
        charcoal: "rgb(var(--charcoal) / <alpha-value>)",
        wheat: "rgb(var(--wheat) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
        sage: "rgb(var(--sage) / <alpha-value>)",
        // backward-compat aliases
        ink: "rgb(var(--ink) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        rail: "rgb(var(--rail) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        violet: "rgb(var(--accent-2) / <alpha-value>)",
        rust: "rgb(var(--rust) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        steel: "rgb(var(--steel) / <alpha-value>)",
        alert: "rgb(var(--alert) / <alpha-value>)",
        night: "rgb(var(--night) / <alpha-value>)",
        cotton: "rgb(var(--cotton) / <alpha-value>)"
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};

export default config;
