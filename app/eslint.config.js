import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  // 前端源码：浏览器环境 + JSX
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { react },
    rules: {
      // 让 no-unused-vars 识别 JSX 中的使用（<Foo /> 算用到了 Foo）
      'react/jsx-uses-react': 'off', // React 17+ 无需引入 React
      'react/jsx-uses-vars': 'error',
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  // store 同时导出组件与 hook，属有意为之，豁免 fast-refresh 规则
  {
    files: ['src/store.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // 构建配置：Node 环境
  {
    files: ['*.config.js', 'vite.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
])
