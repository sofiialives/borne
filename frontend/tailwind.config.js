export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        kometa: {
          blue: "#504cff",
          purple: "#854cff",
          black: "#0e0e0e",
          silver: "#d9d9d9",
          white: "#fafafa",
          surface: "#141418",
          surface2: "#1b1b21",
          ligne: "#2a2a32",
        },
      },
      fontFamily: {
        titre: ["Radiotechnika", "Nekst", "system-ui", "sans-serif"],
        corps: ["Nekst", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "degrade-kometa": "linear-gradient(135deg, #504cff, #854cff)",
      },
      borderRadius: {
        kometa: "14px",
      },
    },
  },
  plugins: [],
};
