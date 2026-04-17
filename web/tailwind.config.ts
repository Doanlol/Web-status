import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration - DevOps Dashboard Theme
 *
 * Màu sắc chủ đạo:
 *  - Nền: #0D1117 (đen như GitHub dark)
 *  - Panel: #161B22 (đen xám cho card/panel)
 *  - Xanh lá: #00ff9c (màu hacker/terminal)
 *  - Font: monospace (phong cách developer)
 */
const config: Config = {
  // Quét tất cả file trong thư mục src để tìm class Tailwind
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Định nghĩa màu sắc tùy chỉnh cho theme DevOps
      colors: {
        devops: {
          bg:     "#0D1117", // Màu nền chính (đen đậm)
          panel:  "#161B22", // Màu nền card/panel (đen xám)
          border: "#30363D", // Màu viền
          green:  "#00ff9c", // Màu xanh lá hacker (màu chủ đạo)
          red:    "#ff4444", // Màu đỏ cảnh báo
          yellow: "#ffcc00", // Màu vàng (warning)
          text:   "#C9D1D9", // Màu chữ chính (xám sáng)
          muted:  "#8B949E", // Màu chữ phụ (xám tối)
        },
      },
      // Font monospace cho phong cách developer/hacker
      fontFamily: {
        mono: ['"Fira Code"', '"Cascadia Code"', '"JetBrains Mono"', "monospace"],
      },
      // Animation nhấp nháy cho trạng thái online
      animation: {
        "pulse-green": "pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "pulse-green": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
