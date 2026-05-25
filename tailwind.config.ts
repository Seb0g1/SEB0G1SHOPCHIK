import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.tsx", "./src/components/**/*.ts", "./src/components/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2528",
        line: "#d9ded8",
        canvas: "#f7f8f5",
        moss: "#4f6f52",
        sea: "#0f766e",
        honey: "#b7791f",
        signal: "#b42318",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(25, 31, 28, 0.06)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
