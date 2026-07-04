import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000 // هنا ثبتنا الهوست على 3000 مخصوص عشانك
  }
})