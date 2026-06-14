import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef2fb",
          100: "#d6dff4",
          200: "#aab9e6",
          300: "#7b92d7",
          400: "#4f6dc7",
          500: "#2f4fb3",
          600: "#243f93",
          700: "#1d3279",
          800: "#172863",
          900: "#101d4a",
          950: "#0a1330",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(16 29 74 / 0.06), 0 1px 2px -1px rgb(16 29 74 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
