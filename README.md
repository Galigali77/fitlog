# FitLog 健身记录

> 记得快、看得懂、会提醒你加片。
> 本地优先、无账号、复盘驱动的手机网页健身记录工具。**非商业个人用途。**

纯前端 PWA：数据全部存在浏览器 IndexedDB，不经过任何服务器；动作数据与 GIF 演示媒体
**不包含在本仓库中**（版权原因，见 [NOTICE.md](./NOTICE.md)），由 Python 工具脚本在本机获取。

## 功能

- **今日**：轮换训练计划（A/B/C），一键开练
- **记录**：逐组记录重量×次数、上次数据预填、组间休息计时器、PR 自动检测
- **复盘**：训练热力图、肌肉覆盖统计、渐进超负荷建议（连续达标自动建议加重）、**身材记录**（每 15 天正面+背面照片）
- **动作库**：3000+ 动作（openGym 数据），肌群/器械筛选，GIF 演示
- **计划**：内置经典模板 + 自定义计划，按星期或轮换编排
- **数据主权**：JSON 导出备份、CSV 导出，随时带走

## 仓库结构

```
fitlog/
├── app/      # 前端工程（React 19 + JavaScript + Vite + Tailwind + Dexie.js）
├── tools/    # Python 工具链（动作数据获取、GIF 优化、本地服务器）
└── docs/     # 需求分析说明书 + 技术设计方案
```

## 快速开始

### 1. 前端

```bash
cd app
npm install
npm run dev        # 开发预览，默认 http://localhost:3000
npm run build      # 生产构建 → dist/
```

### 2. 动作库数据（首次运行必需）

```bash
pip install -r tools/requirements.txt
python tools/fetch_openGym.py     # 生成 app/public/exercises/
python tools/optimize_gifs.py     # 压缩动图 + 生成首帧缩略图
```

### 3. 部署（自用）

`app/dist/` 是纯静态文件，任意静态托管即可：

```bash
python tools/serve.py             # 或 python -m http.server
```

手机浏览器打开 → 「添加到主屏幕」→ 获得独立 App 体验。

## 技术方案

详见 [docs/技术设计方案.md](docs/技术设计方案.md)；需求详见 [docs/需求分析.md](docs/需求分析.md)。

- 架构：纯前端、本地优先（Local-First），无后端
- 产品代码：JavaScript（ES2022+，JSDoc + ESLint 保障）；开发工具链：Python 3.11+

## 许可

- 自研代码：[MIT](./LICENSE)
- 第三方素材（openGym 数据 / Gym Visual 演示媒体）：见 [NOTICE.md](./NOTICE.md)，**未包含在本仓库中**
