import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Merriweather'", "serif"],
        sans: ["'Inter'", "sans-serif"],
        display: ["'Merriweather'", "serif"]
      },
      colors: {
        et: {
          red: "#E21B22",
          bg: "#FFFFFF",
          section: "#F8F8F8",
          headline: "#000000",
          body: "#333333",
          secondary: "#666666",
          meta: "#999999",
          border: "#E5E5E5",
          divider: "#F0F0F0",
          highlight: "#FFF8E1"
        },
        ink: "#000000",
        paper: "#FFFFFF",
        accent: "#E21B22",
        mist: "#E5E5E5",
        slate: "#666666"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 20, 26, 0.12)"
      }
    }
  },
  plugins: []
} satisfies Config;
