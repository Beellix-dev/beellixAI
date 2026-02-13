import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // WebSocket 代理
      '/ws': {
        target: 'http://localhost:8000',
        ws: true,
      },
      // REST API 代理（健康检查等）
      '/api': {
        target: 'http://localhost:8000',
      },
      // 图片代理
      '/images': {
        target: 'http://localhost:8000',
      },
    },
  },
})