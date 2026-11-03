import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 本地开发时把 API 转发到本地后端（生产环境由 nginx 反代）；可用 DEV_API_TARGET 覆盖
      "/api": process.env.DEV_API_TARGET || "http://127.0.0.1:3000",
      "/share": process.env.DEV_API_TARGET || "http://127.0.0.1:3000",
    },
  },
  preview: {
    proxy: {
      "/api": process.env.DEV_API_TARGET || "http://127.0.0.1:3000",
      "/share": process.env.DEV_API_TARGET || "http://127.0.0.1:3000",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-antd": ["antd", "@ant-design/icons"],
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-qrcode": ["qrcode", "jsqr"],
        },
      },
    },
  },
});
