import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        nordea: {
          navy: "#0000A0",
          teal: "#00A39B"
        },
        status: {
          completed: "#10B981",
          processing: "#F59E0B",
          failed: "#EF4444",
          queued: "#9CA3AF"
        },
        drift: {
          green: "#10B981",
          yellow: "#EAB308",
          red: "#EF4444"
        }
      }
    }
  },
  plugins: []
};

export default config;
