# Psd2Code Studio

一个基于 **Tauri + React + Rust** 的桌面应用，用于将 PSD 设计稿解析为可选目标代码（Vue 3 / React Native），并提供图层浏览、样式查看与节点级导出能力。

## 主要功能

- PSD 两阶段导入：先快速预览，再后台解析完整节点树
- 支持拖拽导入、`Ctrl/Cmd + O` 快速打开
- 画布交互：缩放、平移、自动适配、节点选中/悬停
- 侧边栏双模式：
  - 列表模式：以设计块预览入口
  - 详情模式：图层树浏览、显隐切换
- 右侧属性面板：
  - 节点信息与视觉属性查看
  - 一键获取 CSS / React Native 样式片段
  - 导出 Vue / React Native 组件代码
  - 支持详情模式“导出整个页面”与列表模式“导出整个文件”
- 支持命令行整文件/整目录导出：`json` / `vue` / `react`，并可用独立参数附加截图导出或控制 JSON 是否包含 `imageData`
- 导出布局模式：`absolute` / `flex` / `ai`
- AI 设置面板（endpoint + apiKey，本地持久化）
- 状态栏显示解析状态、尺寸与节点统计
- 缓存与历史：
  - Rust 端 PSD 解析缓存（可清除）
  - 前端最近文件记录（localStorage）

## 技术栈

- 前端：React 19 + TypeScript + Vite + Zustand
- 桌面壳：Tauri v2
- 后端：Rust（解析、布局推断、代码导出）
- PSD 读取：`ag-psd`（通过 Node 脚本桥接）

## 目录结构

```text
.
├─ src/                 # React 前端
│  ├─ components/       # UI 组件（Header/Sidebar/Canvas/Inspector 等）
│  ├─ hooks/            # 业务 hooks（如 PSD 导入流程）
│  ├─ utils/            # 设计页辅助逻辑
│  ├─ store.ts          # Zustand 全局状态
│  ├─ api.ts            # Tauri invoke 与系统对话框封装
│  └─ types.ts          # 前端类型定义
├─ src-tauri/           # Rust + Tauri
│  ├─ src/parser.rs     # PSD 解析主流程
│  ├─ src/layout_engine.rs
│  ├─ src/exporter.rs   # Vue/RN/AI 导出
│  ├─ src/commands.rs   # Tauri commands
│  └─ scripts/ag-psd-parse.mjs
├─ sample/              # 示例 PSD
└─ docs/                # 技术文档
```

## 环境要求

- Node.js 18+（建议 LTS）
- npm 9+
- Rust stable（含 Cargo）
- Tauri v2 构建依赖（按系统安装）
  - 官方说明：[Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

> 注意：Rust 端会调用 `node` 执行 `src-tauri/scripts/ag-psd-parse.mjs`，请确保命令行可直接找到 `node`。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动桌面开发环境（推荐）

```bash
npm run tauri:dev
```

### 3. 仅启动前端（调 UI 用）

```bash
npm run dev
```

默认端口为 `1420`（见 `vite.config.ts`）。

### 4. 构建前端

```bash
npm run build
```

### 5. 打包桌面应用

```bash
npm run tauri build
```

## 命令行导出

除了桌面界面，也可以直接通过命令行对整个 PSD 文件或整个目录执行导出。

### 输出规则

- 输入：一个 `.psd` 文件路径或一个目录路径 + 一个导出类型
- 路径：支持绝对路径，也支持相对路径；相对路径按当前命令执行目录解析
- 文件输入时：在 PSD 同级目录下，创建一个以 PSD 文件名命名的文件夹
- 目录输入时：扫描该目录下所有 `.psd/.PSD` 文件，并按现有参数逐个导出
- 列表模式下的所有效果图都会导出到对应输出目录里

例如：

- 输入文件：`D:\design\demo.psd`
- 输出目录：`D:\design\demo\`
- 输入目录：`D:\design\`
- 输出结果：目录下每个 PSD 都会在各自同级生成一个同名输出目录，例如 `D:\design\demo.psd` 会生成 `D:\design\demo\`

### 支持的导出类型

- `--type`：导出类型，必填；可选值为 `json`、`vue`、`react`
- `-t`：`--type` 的短参数
- `json`：导出所有效果图的节点 JSON
- `vue` / `view`：导出所有效果图的 Vue 代码
- `react` / `reactnative` / `rn`：导出所有效果图的 React Native 代码

### 截图开关

- `--screenshot`：在主导出目标之外，额外导出所有效果图的 JPG 截图
- `-s`：`--screenshot` 的短参数

### JSON 图片数据开关

- 默认情况下，JSON 导出不会包含节点 `assetsRef.imageData`
- `--image-data`：JSON 导出时显式包含 `imageData`
- `-i`：`--image-data` 的短参数

也就是说，`imageData` 是一个默认关闭的附加参数，只在你明确需要把 base64 图片数据写进 JSON 时开启。

### 用法

如果已经构建出桌面程序，可以直接调用生成的可执行文件，参数格式相同：

```powershell
.\psd2code-studio.exe D:\path\demo.psd json
.\psd2code-studio.exe -f D:\path\demo.psd -t vue -s
```

也可在 `src-tauri` 目录下运行：

```powershell
cargo run -- D:\path\demo.psd json
cargo run -- D:\path\demo.psd json --screenshot
cargo run -- D:\path\demo.psd json --image-data
cargo run -- D:\path\demo.psd vue
cargo run -- D:\path\demo.psd vue --screenshot
cargo run -- D:\path\demo.psd react
cargo run -- D:\path\demo.psd react --screenshot
cargo run -- D:\path\psds json
```

也支持长参数形式：

```powershell
cargo run -- --export-file D:\path\demo.psd --type json
cargo run -- --export-file D:\path\demo.psd --type json --screenshot
cargo run -- --export-file D:\path\demo.psd --type json --image-data
cargo run -- --export-file D:\path\demo.psd --type vue
cargo run -- --export-file D:\path\demo.psd --type vue --screenshot
cargo run -- --export-file D:\path\demo.psd --type react
cargo run -- --export-dir D:\path\psds --type json
cargo run -- --export-dir D:\path\psds --type json --image-data
```

也支持短参数形式：

```powershell
cargo run -- -f D:\path\demo.psd -t json
cargo run -- -f D:\path\demo.psd -t json -s
cargo run -- -f D:\path\demo.psd -t json -i
cargo run -- -f D:\path\demo.psd -t vue -s
cargo run -- -f D:\path\demo.psd -t react -s
cargo run -- -d D:\path\psds -t json
```

### 说明

- `vue` 当前对应 Vue 导出目标。
- 命令行导出走的是“整文件导出”流程，不依赖桌面界面打开项目。
- `--export-file / -f` 与 `--export-dir / -d` 都支持；目录模式会自动扫描当前目录下所有 PSD。
- `type` 只表示主导出目标；是否额外导出截图由 `--screenshot` / `-s` 控制。
- JSON 导出默认不包含 `imageData`；只有显式传入 `--image-data` / `-i` 时才会写出。
- 若导出类型为代码导出，图片资源会一并写入输出目录中的 `assets/` 子目录。

## npm scripts

- `npm run dev`：启动 Vite
- `npm run build`：TypeScript 检查并构建前端
- `npm run preview`：预览前端产物
- `npm run tauri`：Tauri CLI
- `npm run tauri:dev`：桌面开发模式

## 使用流程

1. 启动应用后导入 `.psd` 文件（按钮、快捷键或拖拽）。
2. 先显示预览图与基础信息，再进入完整节点解析。
3. 在左侧选择设计块或图层，画布联动选中。
4. 在右侧查看节点属性、复制样式或生成导出代码。
5. 若使用 AI 模式，先在 `API 设置` 中配置 endpoint 与 API Key。

## AI 导出接口约定（当前实现, 未测试）

AI 模式会向你配置的 endpoint 发送 JSON（`POST`，可选 Bearer Token）：

```json
{
  "target": "vue | reactnative",
  "mode": "layout-generation",
  "node": { "...完整节点数据..." },
  "previewImageBase64": "data:image/png;base64,...",
  "instruction": "根据预览图和节点属性信息，生成可维护页面代码。优先相对布局，必要时 absolute 回退。"
}
```

响应需至少包含以下字段之一：

- `code`
- `page`
- `pageCode`

可选字段：

- `fileName`
- `styles`
- `componentCandidates`
- `generatedComponents`

## 已知限制

- 当前导出命令基于已打开项目的第一个 page 节点树进行查找。
- 头部“导出/AI”菜单里部分项为占位入口，未完全连通。
- PSD 解析依赖 `ag-psd` + Node 进程；在无 Node 环境下会失败。

## 参考文档

- 文本图层解析方案：`docs/技术方案要点.md`

# Psd2Code Studio

一个基于 **Tauri + React + Rust** 的桌面应用，用于将 PSD 设计稿解析为可选目标代码（Vue 3 / React Native），并提供图层浏览、样式查看与节点级导出能力。

## 主要功能

- PSD 两阶段导入：先快速预览，再后台解析完整节点树
- 支持拖拽导入、`Ctrl/Cmd + O` 快速打开
- 画布交互：缩放、平移、自动适配、节点选中/悬停
- 侧边栏双模式：
  - 列表模式：以设计块预览入口
  - 详情模式：图层树浏览、显隐切换
- 右侧属性面板：
  - 节点信息与视觉属性查看
  - 一键获取 CSS / React Native 样式片段
  - 导出 Vue / React Native 组件代码
  - 支持详情模式“导出整个页面”与列表模式“导出整个文件”
- 支持命令行整文件/整目录导出：`json` / `vue` / `react`，并可用独立参数附加截图导出或控制 JSON 是否包含 `imageData`
- 导出布局模式：`absolute` / `flex` / `ai`
- AI 设置面板（endpoint + apiKey，本地持久化）
- 状态栏显示解析状态、尺寸与节点统计
- 缓存与历史：
  - Rust 端 PSD 解析缓存（可清除）
  - 前端最近文件记录（localStorage）

## 技术栈

- 前端：React 19 + TypeScript + Vite + Zustand
- 桌面壳：Tauri v2
- 后端：Rust（解析、布局推断、代码导出）
- PSD 读取：`ag-psd`（通过 Node 脚本桥接）

## 目录结构

```text
.
├─ src/                 # React 前端
│  ├─ components/       # UI 组件（Header/Sidebar/Canvas/Inspector 等）
│  ├─ hooks/            # 业务 hooks（如 PSD 导入流程）
│  ├─ utils/            # 设计页辅助逻辑
│  ├─ store.ts          # Zustand 全局状态
│  ├─ api.ts            # Tauri invoke 与系统对话框封装
│  └─ types.ts          # 前端类型定义
├─ src-tauri/           # Rust + Tauri
│  ├─ src/parser.rs     # PSD 解析主流程
│  ├─ src/layout_engine.rs
│  ├─ src/exporter.rs   # Vue/RN/AI 导出
│  ├─ src/commands.rs   # Tauri commands
│  └─ scripts/ag-psd-parse.mjs
├─ sample/              # 示例 PSD
└─ docs/                # 技术文档
```

## 环境要求

- Node.js 18+（建议 LTS）
- npm 9+
- Rust stable（含 Cargo）
- Tauri v2 构建依赖（按系统安装）
  - 官方说明：[Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

> 注意：Rust 端会调用 `node` 执行 `src-tauri/scripts/ag-psd-parse.mjs`，请确保命令行可直接找到 `node`。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动桌面开发环境（推荐）

```bash
npm run tauri:dev
```

### 3. 仅启动前端（调 UI 用）

```bash
npm run dev
```

默认端口为 `1420`（见 `vite.config.ts`）。

### 4. 构建前端

```bash
npm run build
```

### 5. 打包桌面应用

```bash
npm run tauri build
```

## 命令行导出

除了桌面界面，也可以直接通过命令行对整个 PSD 文件或整个目录执行导出。

### 输出规则

- 输入：一个 `.psd` 文件路径或一个目录路径 + 一个导出类型
- 路径：支持绝对路径，也支持相对路径；相对路径按当前命令执行目录解析
- 文件输入时：在 PSD 同级目录下，创建一个以 PSD 文件名命名的文件夹
- 目录输入时：扫描该目录下所有 `.psd/.PSD` 文件，并按现有参数逐个导出
- 列表模式下的所有效果图都会导出到对应输出目录里

例如：

- 输入文件：`D:\design\demo.psd`
- 输出目录：`D:\design\demo\`
- 输入目录：`D:\design\`
- 输出结果：目录下每个 PSD 都会在各自同级生成一个同名输出目录，例如 `D:\design\demo.psd` 会生成 `D:\design\demo\`

### 支持的导出类型

- `--type`：导出类型，必填；可选值为 `json`、`vue`、`react`
- `-t`：`--type` 的短参数
- `json`：导出所有效果图的节点 JSON
- `vue` / `view`：导出所有效果图的 Vue 代码
- `react` / `reactnative` / `rn`：导出所有效果图的 React Native 代码

### 截图开关

- `--screenshot`：在主导出目标之外，额外导出所有效果图的 JPG 截图
- `-s`：`--screenshot` 的短参数

### JSON 图片数据开关

- 默认情况下，JSON 导出不会包含节点 `assetsRef.imageData`
- `--image-data`：JSON 导出时显式包含 `imageData`
- `-i`：`--image-data` 的短参数

也就是说，`imageData` 是一个默认关闭的附加参数，只在你明确需要把 base64 图片数据写进 JSON 时开启。

### 用法

如果已经构建出桌面程序，可以直接调用生成的可执行文件，参数格式相同：

```powershell
.\psd2code-studio.exe D:\path\demo.psd json
.\psd2code-studio.exe -f D:\path\demo.psd -t vue -s
```

也可在 `src-tauri` 目录下运行：

```powershell
cargo run -- D:\path\demo.psd json
cargo run -- D:\path\demo.psd json --screenshot
cargo run -- D:\path\demo.psd json --image-data
cargo run -- D:\path\demo.psd vue
cargo run -- D:\path\demo.psd vue --screenshot
cargo run -- D:\path\demo.psd react
cargo run -- D:\path\demo.psd react --screenshot
cargo run -- D:\path\psds json
```

也支持长参数形式：

```powershell
cargo run -- --export-file D:\path\demo.psd --type json
cargo run -- --export-file D:\path\demo.psd --type json --screenshot
cargo run -- --export-file D:\path\demo.psd --type json --image-data
cargo run -- --export-file D:\path\demo.psd --type vue
cargo run -- --export-file D:\path\demo.psd --type vue --screenshot
cargo run -- --export-file D:\path\demo.psd --type react
cargo run -- --export-dir D:\path\psds --type json
cargo run -- --export-dir D:\path\psds --type json --image-data
```

也支持短参数形式：

```powershell
cargo run -- -f D:\path\demo.psd -t json
cargo run -- -f D:\path\demo.psd -t json -s
cargo run -- -f D:\path\demo.psd -t json -i
cargo run -- -f D:\path\demo.psd -t vue -s
cargo run -- -f D:\path\demo.psd -t react -s
cargo run -- -d D:\path\psds -t json
```

### 说明

- `vue` 当前对应 Vue 导出目标。
- 命令行导出走的是“整文件导出”流程，不依赖桌面界面打开项目。
- `--export-file / -f` 与 `--export-dir / -d` 都支持；目录模式会自动扫描当前目录下所有 PSD。
- `type` 只表示主导出目标；是否额外导出截图由 `--screenshot` / `-s` 控制。
- JSON 导出默认不包含 `imageData`；只有显式传入 `--image-data` / `-i` 时才会写出。
- 若导出类型为代码导出，图片资源会一并写入输出目录中的 `assets/` 子目录。

## npm scripts

- `npm run dev`：启动 Vite
- `npm run build`：TypeScript 检查并构建前端
- `npm run preview`：预览前端产物
- `npm run tauri`：Tauri CLI
- `npm run tauri:dev`：桌面开发模式

## 使用流程

1. 启动应用后导入 `.psd` 文件（按钮、快捷键或拖拽）。
2. 先显示预览图与基础信息，再进入完整节点解析。
3. 在左侧选择设计块或图层，画布联动选中。
4. 在右侧查看节点属性、复制样式或生成导出代码。
5. 若使用 AI 模式，先在 `API 设置` 中配置 endpoint 与 API Key。

## AI 导出接口约定（当前实现, 未测试）

AI 模式会向你配置的 endpoint 发送 JSON（`POST`，可选 Bearer Token）：

```json
{
  "target": "vue | reactnative",
  "mode": "layout-generation",
  "node": { "...完整节点数据..." },
  "previewImageBase64": "data:image/png;base64,...",
  "instruction": "根据预览图和节点属性信息，生成可维护页面代码。优先相对布局，必要时 absolute 回退。"
}
```

响应需至少包含以下字段之一：

- `code`
- `page`
- `pageCode`

可选字段：

- `fileName`
- `styles`
- `componentCandidates`
- `generatedComponents`

## 已知限制

- 当前导出命令基于已打开项目的第一个 page 节点树进行查找。
- 头部“导出/AI”菜单里部分项为占位入口，未完全连通。
- PSD 解析依赖 `ag-psd` + Node 进程；在无 Node 环境下会失败。

## 参考文档

- 文本图层解析方案：`docs/技术方案要点.md`

