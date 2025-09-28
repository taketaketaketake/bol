/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
      extend: {
        colors: {
          brand: {
            bg: "#FFF7EE",
            primary: "#FF9C3F",
            primaryDeep: "#F97316",
            secondary: "#FF6B6B",
            accent: "#2EC4B6",
            card: "#FFFFFF",
            line: "#E5E7EB",
            text: "#1F2937",
            muted: "#6B7280",
          },
        },
        boxShadow: { soft: "0 8px 24px rgba(0,0,0,.06)" },
      },
    },
    plugins: [],
  };
  