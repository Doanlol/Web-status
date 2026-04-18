/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme DevOps / Hacker - màu tối với điểm nhấn xanh lá
        devops: {
          bg:     "#0D1117", // Nền chính - đen đậm (như GitHub dark)
          panel:  "#161B22", // Nền card/panel - đen xám
          border: "#30363D", // Màu viền
          green:  "#00FF9C", // Màu xanh lá hacker
          red:    "#FF4444", // Màu đỏ cảnh báo
          text:   "#C9D1D9", // Màu chữ chính
          muted:  "#8B949E", // Màu chữ phụ
        },
      },
      fontFamily: {
        // Font monospace kiểu developer/hacker
        mono: ['"Fira Code"', '"Cascadia Code"', "Consolas", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
