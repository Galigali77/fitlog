import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// PWA Service Worker 注册（阶段三）：有新版本时提示用户刷新
const updateSW = registerSW({
  onNeedRefresh() {
    if (window.confirm('FitLog 有新版本，是否立即更新？')) {
      updateSW(true)
    }
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
