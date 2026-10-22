# 第三方素材声明（NOTICE）

本项目为**非商业个人用途**。以下第三方素材的版权归属各自权利人，本项目
仅按相应条款使用；相关素材**未包含在本仓库中**。

## 动作数据来源：openGym

- 来源仓库：https://github.com/DuarteSantos8/openGym
- 使用内容：动作目录文字数据（catalogue/：动作名称、肌群、器械、动作要领），
  由 `tools/fetch_openGym.py` 在使用者本机获取并清洗，生成的文件位于
  `app/public/exercises/`（已被 .gitignore 排除）。
- openGym 代码以 AGPL v3.0 发布；动作文字数据为 openGym 自有、开放贡献。
- openGym 版权归其作者 DuarteSantos8 所有。

## 动作演示媒体：Gym Visual

- 动作 GIF 动图与静态演示图版权归 **© Aliaksandr Makatserchyk / Gym Visual** 所有。
- 依据 openGym 项目的授权条款：**非商业用途可在保持原样（不修改）并保留本声明的
  前提下使用**；任何商业用途需向 gymvisual.com 单独购买授权。
- 因此本仓库不包含任何演示媒体文件；由使用者通过 `tools/fetch_openGym.py`
  在本机获取，获取行为及后续使用的合规责任由使用者自行承担。

## 开源组件

本项目基于 MIT/Apache-2.0 等宽松许可证的开源组件构建
（React、Vite、Tailwind CSS、Dexie.js、shadcn/ui、lucide-react 等），
完整依赖清单见 `app/package.json`。
