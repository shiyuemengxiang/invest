import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: 不再向前端注入任何 API Key。
// 历史上的 process.env.API_KEY 注入已移除：
// AI 分析功能已下线，其 key 打包进前端 bundle 会被任何访客扒走刷额度。
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
