import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from "kimi-plugin-inspect-react"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  base: "./",
  plugins: [
    inspectAttr(),
    react(),
    // PWA（阶段三：FR-PWA-01/02/03）：应用外壳预缓存 + 动作库运行时缓存
    VitePWA({
      registerType: "prompt", // 有新版本时由应用弹提示，用户确认后刷新
      manifest: {
        name: "FitLog 健身记录",
        short_name: "FitLog",
        description: "离线优先的手机端健身训练记录",
        theme_color: "#0a0614",
        background_color: "#0a0614",
        display: "standalone",
        start_url: "./",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // 190MB 的动作媒体库不进预缓存，走运行时缓存按需存储
        globIgnores: ["exercises/**"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // 动作库索引与种子计划：缓存优先，首次加载后离线可用
            urlPattern: /exercises\/(index|routinesSeed)\.json$/,
            handler: "CacheFirst",
            options: { cacheName: "exercise-data" },
          },
          {
            // 动作静帧/动画媒体：缓存优先 + 容量/过期保护
            urlPattern: /exercises\/(still|clip)\//,
            handler: "CacheFirst",
            options: {
              cacheName: "exercise-media",
              expiration: {
                maxEntries: 7000,
                maxAgeSeconds: 365 * 24 * 3600, // 一年
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
