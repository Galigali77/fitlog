# FitLog 健身记录网页

> 「记得快、看得懂、会提醒你加片」——本地优先、无账号、复盘驱动、纯手机网页的健身记录工具。

- 产品形态：移动端优先的 Web 应用（PWA），**非商业个人用途**
- 架构：纯前端、本地优先（Local-First），无后端；数据存浏览器 IndexedDB
- 设计依据：`docs/需求分析.md`、`docs/技术设计方案.md`

## 目录结构

```
代码/                          # 项目根（单仓单应用）
├── docs/                      # 需求与设计文档
├── tools/                     # Python 工具链（构建期运行，不进产物）
│   ├── fetch_openGym.py       # 拉取清洗 openGym 动作数据 → app/public/exercises/
│   ├── optimize_gifs.py       # 媒体检查与拷贝（版权要求原样使用，不做修改）
│   └── serve.py               # 本地静态服务器
└── app/                       # 前端工程（JavaScript + Vite + React）
    ├── public/exercises/      # 动作库生成物（gitignore 排除，脚本生成）
    ├── public/icons/          # PWA 图标（脚本生成）
    ├── tests/                 # Vitest 单元测试（domain 纯函数）
    └── src/
        ├── db/                # Dexie(IndexedDB) 表定义 + Repository 数据访问层 + 备份导入导出
        ├── domain/            # 纯函数业务逻辑（超负荷引擎 / PR 检测 / 容量计算）
        ├── pages/             # 今日 / 记录 / 复盘 / 动作库 / 计划 / 训练详情 / 设置
        ├── components/        # 计划编辑器 / 动作选择器 / 分享卡片等
        ├── store/             # React Context + useLiveQuery
        ├── hooks/             # useRestTimer（Web Worker 后台保活 + 主线程降级）
        ├── workers/           # 休息计时器 Worker
        └── types/             # 共享数据模型（JSDoc @typedef）
```

## 功能一览（对应需求文档 P0）

- 今日页：轮换/星期绑定计划展示、一键开始、快捷统计
- 记录页：上次数据预填、组间计时（Worker 保活 + 震动闪屏）、PR 即时提示、自由训练/补记
- 复盘页：训练热力图、身材照片（正/背面，15 天提醒）、渐进超负荷建议、时间线
- 计划页：新建 / 编辑 / 复制 / 删除计划，轮换与星期绑定两种模式
- 训练详情：改日期、增删改组数据、删除整次、分享卡片 PNG
- 设置页：训练参数、导出 JSON/CSV、备份恢复、存储占用、PWA 安装引导
- PWA：可安装、离线可用（应用外壳预缓存 + 动作库媒体运行时缓存）、新版本提示更新

## 快速开始

```bash
# 1. 生成动作库数据（首次 / 数据更新时，需要联网）
cd tools
pip install -r requirements.txt   # 实际仅用到标准库 + Pillow（可选）
python fetch_openGym.py           # 生成 app/public/exercises/（index.json + 媒体 + 种子计划）
python optimize_gifs.py           # 校验媒体并输出体积报告

# 2. 启动前端
cd ../app
npm install
npm run dev                       # 开发
npm run build                     # 构建 → dist/（纯静态，含 PWA Service Worker）
npm run lint                      # ESLint
npm run test                      # Vitest（domain 纯函数）

# 3. 本地静态服务（构建产物自测 / 局域网手机访问）
python ../tools/serve.py          # 默认 7100 端口，服务 app/dist
```

## 质量保障（阶段四）

- Vitest 覆盖 domain 纯函数：超负荷引擎、PR 检测、容量计算（含热身组排除、反向区间防御、空历史不误报 PR）
- 真机走查：iPhone/Android 设备模拟下核心流程（今日→训练→计时→复盘→计划）通过
- 性能：应用壳 gzip 后约 155KB（首屏远低于 3s 预算）；动作搜索为内存索引即时过滤；组操作即时反馈
- 边界：空计划空态页、365 天×367 次训练大数据量渲染流畅、存储占用超 80% 提示导出清理
- 加固：写操作全部 try/catch + 页面提示；`navigator.storage.persist()` 申请持久存储；IndexedDB 复合索引按需查询，无全表扫描

## 数据与隐私

- 所有训练数据、计划、身材照片只保存在本机浏览器 IndexedDB，无任何服务端；
- 动作媒体版权归 Gym Visual 所有，仅限非商业个人用途，详见 `NOTICE.md`。
