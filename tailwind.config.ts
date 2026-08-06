import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#04100c", 900: "#071a13", 800: "#0b281d", 700: "#123a2a" },
        fire: { 500: "#ef3d33", 400: "#ff5b50" },
        leaf: { 500: "#18a957", 400: "#2dd66f" }
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0,0,0,.34)",
        glow: "0 0 0 1px rgba(45,214,111,.22), 0 18px 70px rgba(24,169,87,.12)"
      }
    }
  },
  plugins: []
};

export default config;
