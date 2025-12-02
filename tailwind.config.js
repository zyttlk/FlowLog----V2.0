/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}", // 👈 修改了这里：扫描根目录下的代码文件
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Nunito"', 'system-ui', 'sans-serif'],
        handwriting: ['"Ma Shan Zheng"', 'cursive', 'system-ui']
      }
    },
  },
  plugins: [],
}