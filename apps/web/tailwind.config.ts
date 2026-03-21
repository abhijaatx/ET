import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Space Grotesk'", "sans-serif"]
      },
      colors: {
        ink: "#0f141a",
        paper: "#f8f4ee",
        accent: "#d2552d",
        mist: "#e9e1d5",
        slate: "#4b5563"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 20, 26, 0.12)"
      }
    }
  },
  plugins: []
} satisfies Config;
