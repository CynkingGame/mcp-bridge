# MCP Bridge 插件

这是一个为 Cocos Creator 设计的 MCP (Model Context Protocol) 桥接插件，用于连接外部 AI 工具与 Cocos Creator 编辑器，实现对场景、节点等资源的自动化操作。

## 适用版本

此插件适用于 Cocos Creator 2.4.x 版本。由于使用了特定的编辑器 API，可能不兼容较新或较老的版本。

## 功能特性

- **HTTP 服务接口**: 提供标准 HTTP 接口，外部工具可以通过 MCP 协议调用 Cocos Creator 编辑器功能
- **场景节点操作**: 获取、创建、修改场景中的节点
- **资源管理**: 创建场景、预制体，打开场景或预制体进入编辑模式
- **组件管理**: 添加、删除、获取节点组件
- **脚本管理**: 创建、删除、读取、写入脚本文件
- **批处理执行**: 批量执行多个 MCP 工具操作，提高效率
- **资产管理**: 创建、删除、移动、获取资源信息
- **实时日志**: 提供详细的操作日志记录和展示，支持持久化写入项目内日志文件
- **自动启动**: 支持编辑器启动时自动开启服务
- **编辑器管理**: 获取和设置选中对象，刷新编辑器
- **游戏对象查找**: 根据条件查找场景中的节点
- **材质管理**: 创建和管理材质资源
- **纹理管理**: 创建和管理纹理资源
- **菜单项执行**: 执行 Cocos Creator 编辑器菜单项
- **代码编辑增强**: 应用文本编辑操作到文件
- **控制台读取**: 读取编辑器控制台输出
- **脚本验证**: 验证脚本语法正确性
- **全局搜索**: 在项目中搜索文本内容
- **撤销/重做**: 管理编辑器的撤销栈
- **特效管理**: 创建和修改粒子系统
- **并发安全**: 指令队列串行化执行，队列上限 100 条（超限返回 HTTP 429），防止编辑器卡死
- **超时保护**: IPC 通信和指令队列均有超时兜底机制
- **属性保护**: 组件核心属性黑名单机制，防止 AI 篡改 `node`/`uuid` 等引用导致崩溃
- **AI 容错**: 参数别名映射（`operation`→`action`、`save`→`update`/`write`），兼容大模型幻觉
- **引用查找**: 查找场景中所有引用了指定节点或资源的位置，支持 Texture2D → SpriteFrame 子资源自动解析
- **项目构建**: 一键触发 Cocos 原生 `Editor.Builder` 构建产物（内置智能防闪退兜底机制）
- **工程信息**: 用于拉取当前活跃的编辑器级状态（版本号、根目录、当前打开的场景 UUID）

## 安装与使用

### 安装

将此插件复制到 Cocos Creator 项目的 `packages` 目录下即可。

### 构建

```bash
npm install
npm run build
```

> **注意**: 构建使用 esbuild 并指定 `--target=es2018` 以确保兼容 Cocos Creator 2.4.x 内置的 Electron 9.x 运行时。

### 启动

1. 打开 Cocos Creator 编辑器
2. 在菜单栏选择 `MCP 桥接器/开启MCP设置面板` 打开设置面板
3. 在面板中点击 "启动" 按钮启动服务
4. 服务默认运行在端口 3456 上

### 配置选项

- **端口**: 可以自定义 HTTP 服务监听的端口，默认为 3456
- **自动启动**: 可以设置编辑器启动时自动开启服务
- **多实例支持**: 如果默认端口 (3456) 被占用，插件会自动尝试端口+1 (如 3457)，直到找到可用端口。
- **配置隔离**: 插件配置（是否自动启动、上次使用的端口）现已存储在项目目录 (`settings/mcp-bridge.json`) 中，不同项目的配置互不干扰。

### 项目 UI Policy

- 插件支持项目级 UI 策略文件，用于约束 AI 创建 UI 节点和 UI 预制体时的锚点、根节点拉伸和安全区行为。
- 同一份策略文件也可声明 `autoNineSlice` 规则：当 AI 给节点赋上名字命中规则的 `SpriteFrame` 时，插件会自动补齐缺失的 9-slice 边距。
- MCP 工程内现在可以自带一份基础 UI policy / workflow；如果项目根目录也放了 `.agent` 同名文件，则项目级配置优先。
- 项目级 workflow 文档也支持落在 Cocos 项目根目录，供 `cocos://ui/workflow` 直接读取。
- MCP 还会额外暴露标准 prompts，适合把“先分析、再决策、后执行”的工作流直接前置给支持 prompts 的 AI 客户端。
- 默认读取顺序：
  - 基线：`packages/mcp-bridge/.agent/mcp-ui-policy.json`
  - 项目覆盖：`项目根目录/.agent/mcp-ui-policy.json`
  - `packages/mcp-bridge/.agent/mcp-ui-policy.json`
- workflow 默认读取顺序：
  - `项目根目录/.agent/ai-ui-workflow.md`
  - `packages/mcp-bridge/.agent/ai-ui-workflow.md`
  - 若都不存在，则回退到插件内置 workflow 文案
- 当前内置能力适合这类约束：
  - `button` 预设：按钮默认中心锚点
  - `screen-root` 预设：全屏 prefab 根节点自动 `Widget/full`
  - `safe-area-root` 预设：全屏交互根节点自动 `Widget/full + SafeArea`
- 对已存在的节点，可使用 `apply_ui_policy` 直接补齐项目规范，而不必重建节点。
- 对已经挂上场景/预制体的点9纹理，可使用 `ensure_current_9slice_textures` 扫描当前用到的资源并自动补齐缺失边距。
- 对“同结构重复 3 次以上”的列表项、奖励格子、排行项，可使用 `scaffold_repeatable_ui` 一次性生成 Item prefab、容器 prefab 和脚本骨架。
- 对 AI 自动化流程，推荐形成固定闭环：`create_node/create_prefab` -> `apply_ui_policy` -> `validate_ui_prefab`。
- 对设计稿导入流程，推荐形成固定闭环：`analyze_design_layout` -> AI 明确补齐 `imageAssetMap/rootPreset` -> `import_design_layout` -> `validate_ui_prefab`。
- 若设计稿节点命名和层级不适合直接落地业务页面，可在 `analyze_design_layout` / `import_design_layout` 中额外传入 `logic`，先按页面逻辑重命名和重组，再生成脚本。
- 设计导入生成的脚本现在优先依赖编辑器内已绑定好的 `@property`，不再生成运行时 `bindReferences/findComponent` 回填代码。
- `autoNineSlice` 的处理标记会写入 `settings/mcp-bridge.json`，避免同一纹理被重复触发。
- MCP 还会额外暴露两个标准资源：
  - `cocos://ui/policy`
  - `cocos://ui/workflow`
  支持资源读取的 AI 客户端可以直接将其作为项目级提示上下文使用。
- MCP 还会暴露两个标准 prompts：
  - `ui-workflow-guardrails`
  - `design-import-planner`
  支持 prompts 的 AI 客户端可以直接把这两类提示词拉入当前任务上下文。

## 连接 AI 编辑器

### 自动化一键配置（推荐）

当前版本内置支持以下 AI 客户端的自动化配置探测与写入：
- **Claude Desktop** (全局)
- **Cline** (VSCode 工作区/全局)
- **Roo Code** (VSCode 工作区/全局)
- **Trae** (全局)

1. 在 Cocos Creator 菜单栏选择 `MCP 桥接器/开启MCP设置面板` 打开设置面板。
2. 切换到顶部的 **「MCP 配置」** 选项卡。
3. 若系统扫描成功，从下拉菜单选定对应的宿主 AI 客户端。
4. 点击 **「一键配置当前平台」**。插件将安全地完成 MCP Server 定义注册信息的全自动写入。重启对应 AI 即可无缝拉起。

### 手动在 AI 编辑器中配置

如果你的 AI 编辑器提供的是 Type: command 或 Stdio 选项：

```
Command: node
Args: [插件安装路径]/dist/mcp-proxy.js
```

### 或者添加 JSON 配置：

```json
{
    "mcpServers": {
        "mcp-bridge": {
            "command": "node",
            "args": ["[插件安装路径]/dist/mcp-proxy.js"]
        }
    }
}
```

注意：请将上述配置中的路径替换为你自己项目中 `dist/mcp-proxy.js` 文件的实际绝对路径。

如果你的 AI 编辑器支持直接配置 HTTP MCP URL，例如 Codex，可直接使用：

```json
{
  "mcpServers": {
    "mcp-bridge": {
      "url": "http://127.0.0.1:3456"
    }
  }
}
```

说明：
- 当前插件已支持标准 HTTP JSON-RPC MCP 入口，默认挂在根路径 `/`。
- 若你在面板中修改了端口，请将上面的 `3456` 替换为当前实际端口。
- 旧的 `command + mcp-proxy.js` 方式仍然保留，兼容不支持 URL MCP 的客户端。

## 项目架构

```
mcp-bridge/
├── src/                          # TypeScript 源码
│   ├── main.ts                   # 插件主入口 (load/unload, IPC 注册)
│   ├── scene-script.ts           # 场景脚本 (渲染进程, 操作 cc.* 引擎 API)
│   ├── mcp-proxy.ts              # MCP stdio 代理 (AI 客户端 ↔ HTTP 桥接)
│   ├── IpcManager.ts             # IPC 消息管理器
│   ├── McpConfigurator.ts        # AI 客户端配置自动注入
│   ├── core/                     # 核心基础设施
│   │   ├── Logger.ts             # 集中式日志 (缓冲 + 面板同步 + 文件落盘)
│   │   ├── CommandQueue.ts       # 指令队列 (串行化 + 超时保护)
│   │   ├── HttpServer.ts         # HTTP 服务器生命周期管理
│   │   ├── McpRouter.ts          # HTTP 请求路由分发
│   │   └── McpWrappers.ts        # 独立资源工具 (search/undo/sha/animation)
│   ├── tools/                    # MCP 工具层
│   │   ├── ToolRegistry.ts       # 工具定义注册表 (name/description/schema)
│   │   └── ToolDispatcher.ts     # 工具调度中心 (handleMcpCall → 场景脚本)
│   ├── utils/                    # 通用工具
│   │   └── AssetPatcher.ts       # 原子化资源创建 + Prefab 修补工具
│   └── panel/                    # 设置面板
│       └── index.ts              # 面板交互逻辑
├── panel/
│   └── index.html                # 面板 HTML 模板
├── dist/                         # 编译输出 (esbuild bundle)
│   ├── main.js                   # 主进程入口
│   ├── scene-script.js           # 场景脚本
│   ├── panel/index.js            # 面板脚本
│   └── mcp-proxy.js              # MCP 代理
├── package.json                  # 插件清单 (Cocos Creator 2.x 格式)
└── tsconfig.json                 # TypeScript 编译配置
```

### 进程架构

```
主进程 (main.ts)                    渲染进程 (scene-script.ts)
       │                                      │
       ├─ 1. 接收 HTTP 请求                    │
       │      HttpServer → McpRouter           │
       ├─ 2. 路由到工具分发器                    │
       │      ToolDispatcher.handleMcpCall()   │
       ├─ 3. 调用场景脚本 ──────────────────────┤
       │      CommandQueue → callSceneScript   │
       │                                       ├─ 4. 操作节点/组件
       │                                       │      cc.engine / cc.director
       │                                       ├─ 5. 通知场景变脏
       │                                       │      Editor.Ipc → scene:dirty
       └─ 6. 返回 JSON 结果 ◀──────────────────┘
```

## API 接口

服务提供以下 MCP 工具接口：

### 1. get_selected_node

- **描述**: 获取当前编辑器中选中的节点 ID
- **参数**: 无

### 2. set_node_name

- **描述**: 修改指定节点的名称
- **参数**:
    - `id`: 节点的 UUID
    - `newName`: 新的节点名称

### 3. save_scene / save_prefab / close_prefab

- **描述**: 场景和预制体保存/关闭操作
- **参数**: 无（`save_scene` 保存场景，`save_prefab` 保存当前预制体，`close_prefab` 退出预制体编辑模式）

### 4. get_scene_hierarchy

- **描述**: 获取当前场景的完整节点树结构。如果要查询具体组件属性请配合 manage_components。
- **参数**:
    - `nodeId`: 指定的根节点 UUID（可选）
    - `depth`: 遍历深度限制，默认为 2（可选）
    - `includeDetails`: 是否包含坐标、缩放等详情，默认为 false（可选）

### 5. update_node_transform

- **描述**: 修改节点的坐标、缩放、颜色或显隐状态
- **参数**: `id`(必需), `x`, `y`, `width`, `height`, `scaleX`, `scaleY`, `rotation`, `color`, `opacity`, `active`, `anchorX`, `anchorY`, `skewX`, `skewY`

### 6. open_scene / open_prefab

- **描述**: 打开场景/预制体进入编辑模式（异步操作，需等待几秒）
- **参数**: `url` — 资源路径（如 `db://assets/NewScene.fire`）

### 7. create_node

- **描述**: 在当前场景中创建新节点
- **参数**: `name`(必需), `parentId`, `type`(empty/sprite/label/button), `layout`(center/top/bottom/full 等), `uiPreset`
- **说明**:
  - 当未传 `parentId` 且节点类型为 UI 节点时，插件会优先尝试自动挂到 `Canvas`
  - `uiPreset` 会读取项目 UI policy，自动补锚点 / Widget / SafeArea
  - `button` 类型默认会命中项目里的 `button` 预设（若存在）

### 7.1 apply_ui_policy

- **描述**: 将项目 UI policy 预设直接应用到现有节点
- **参数**: `nodeId`(必需), `preset`
- **说明**:
  - 适用于已打开的 prefab 根节点、按钮或交互容器修正
  - 常见用法：对全屏根节点应用 `screen-root` / `safe-area-root`，对按钮应用 `button`

### 7.2 validate_ui_prefab

- **描述**: 校验当前 UI 预制体/节点是否符合项目 UI policy
- **参数**: `nodeId`(必需), `expectedRootPreset`
- **返回**:
  - `ok`: 是否通过
  - `rootPreset`: 实际使用或推断的根节点预设
  - `findings`: 问题列表
- **当前检查项**:
  - 根节点锚点是否符合项目 root preset
  - 根节点是否具备对应的 `Widget` 布局
  - 需要安全区时是否挂载 `SafeArea`
  - 所有按钮节点是否使用中心锚点 `(0.5, 0.5)`

### 7.3 ensure_current_9slice_textures

- **描述**: 扫描当前场景或预制体里已经被 `Sprite` / `Button` 用到的纹理；若文件名命中项目 `autoNineSlice` 规则且当前 border 尚未设置，则自动补齐 9-slice。
- **参数**: 无
- **说明**:
  - 适合在 AI 完成一轮 prefab/scene 修改后做一次兜底扫描
  - 已处理过的纹理会写入项目标记，后续重复调用会自动跳过

### 7.4 scaffold_repeatable_ui

- **描述**: 为重复块 UI 直接生成脚手架资产，包括：
  - Item prefab
  - 列表容器 prefab
  - Item 脚本
  - Controller 脚本
- **参数**:
  - `itemName`
  - `containerName`
  - `prefabDir`
  - `scriptDir`
  - `fields`
  - 可选：`listDirection`、`useScrollView`、`rootPreset`、`itemWidth`、`itemHeight`、`containerWidth`、`containerHeight`、`overwrite`
- **说明**:
  - 适合排行项、奖励格子、商店项、活动列表项等重复结构
  - 工具会在脚本生成并刷新后，自动尝试将 Item 脚本挂到 Item prefab 根节点，并将 Controller 脚本挂到容器 prefab 根节点
  - Controller 脚本会自动绑定 `itemPrefab` 属性
  - Controller 脚本默认提供 `render(list)`，Item 脚本默认提供 `setData(data)`

### 8. manage_components

- **描述**: 管理节点组件（增删改查）
- **参数**: `nodeId`(必需), `action`(add/remove/update/get), `componentType`, `componentId`, `properties`

### 9. manage_script

- **描述**: 管理脚本文件
- **参数**: `action`(create/delete/read/write), `path`, `content`, `name`

### 10. batch_execute

- **描述**: 批处理执行多个操作
- **参数**: `operations` — 操作列表（含 `tool` 和 `params`）

### 11. manage_asset

- **描述**: 管理资源（创建/删除/移动/查询信息）
- **参数**: `action`, `path`, `targetPath`, `content`

### 12. scene_management / prefab_management

- **描述**: 场景和预制体管理
- **参数**: `action`(create/delete/duplicate/get_info), `path`, `nodeId`, `parentId`, `rootPreset`
- **说明**:
  - `prefab_management.create` 可传 `rootPreset`
  - 若未显式传 `rootPreset`，插件会按项目 Canvas 设计分辨率自动识别“屏幕型”根节点，并补全根节点适配

### 13. manage_editor

- **描述**: 管理编辑器（获取/设置选中, 刷新编辑器）
- **参数**: `action`(get_selection/set_selection/refresh_editor), `target`, `properties`

### 14. find_gameobjects

- **描述**: 按条件搜索场景中的游戏对象
- **参数**: `conditions`(name/component/active), `recursive`

### 15. manage_material / manage_texture / ensure_current_9slice_textures / scaffold_repeatable_ui / manage_shader

- **描述**: 管理材质、纹理、九宫格扫描、重复块脚手架、着色器资源
- **参数**: `action`, `path`, `properties`/`content`
- `manage_texture`
  - `action: "update"` 时支持：
    - `properties.border`: 显式传入 `[top, bottom, left, right]`
    - `properties.borderMode: "auto"`: 按纹理长宽较小值的一半向下取整，自动生成四边 Border
  - 当 `border` 与 `borderMode: "auto"` 同时存在时，优先使用 `border`

### 16. execute_menu_item

- **描述**: 执行菜单项（支持 `delete-node:UUID` 直接删除节点）
- **参数**: `menuPath`

### 17. apply_text_edits

- **描述**: 对文件应用文本编辑（insert/delete/replace）
- **参数**: `filePath`, `edits`

### 18. read_console

- **描述**: 读取插件控制台日志
- **参数**: `limit`, `type`

### 19. validate_script

- **描述**: 验证脚本语法正确性
- **参数**: `filePath`

### 20. search_project

- **描述**: 搜索项目文件（支持正则、文件名、目录名）
- **参数**: `query`, `useRegex`, `path`, `matchType`, `extensions`, `includeSubpackages`

### 21. manage_undo

- **描述**: 撤销/重做管理
- **参数**: `action`(undo/redo/begin_group/end_group/cancel_group), `description`, `id`

### 22. manage_vfx

- **描述**: 特效（粒子系统）管理
- **参数**: `action`(create/update/get_info), `nodeId`, `name`, `parentId`, `properties`

### 23. manage_animation

- **描述**: 管理节点动画组件
- **参数**: `action`(get_list/get_info/play/stop/pause/resume), `nodeId`, `clipName`

### 24. get_sha

- **描述**: 获取指定文件的 SHA-256 哈希值
- **参数**: `path`

### 25. find_references

- **描述**: 查找场景中引用了指定节点或资源的所有位置
- **参数**: `targetId`, `targetType`(node/asset/auto)

### 26. create_scene / create_prefab

- **描述**: 创建场景文件 / 将场景节点保存为预制体
- **参数**: `sceneName` / `nodeId` + `prefabName` + `rootPreset`
- **说明**:
  - `create_prefab` 适合从场景节点直接产出 UI prefab
  - 对于全屏 UI 根节点，建议传 `rootPreset: "screen-root"` 或 `rootPreset: "safe-area-root"`

### 27. build_project

- **描述**: 触发编辑器内置打包构建管线（具备空场景容错、剔除引擎模块白名单同步保护）
- **参数**: `platform` (例如 web-mobile), `debug`

### 28. get_project_info

- **描述**: 获取当前激活的编辑器环境数据
- **参数**: 无（返回 `path`, `version`, `openScene` 状态）

## 开发指南

### 添加新 MCP 工具

1. 在 `src/tools/ToolRegistry.ts` 中添加工具定义（name, description, inputSchema）
2. 在 `src/tools/ToolDispatcher.ts` 中添加对应的处理方法
3. 如需操作场景节点，在 `src/scene-script.ts` 中添加对应的场景脚本处理器

### 构建与调试

```bash
# 类型检查（不生成文件）
npx tsc --noEmit

# 完整构建
npm run build

# 在 Cocos Creator 中重新加载插件
# 菜单 → 开发者 → 重新加载
```

### 日志管理

插件通过 `Logger` 服务统一记录所有操作日志：
- 面板实时显示（通过 IPC `sendToPanel`）
- 持久化写入 `settings/mcp-bridge.log`（自动轮转，上限 2MB）
- 内存缓冲区上限 2000 条，超限自动截断

## AI 操作安全守则

1. **确定性优先**：任何对节点、组件、属性的操作，都必须建立在"主体已确认存在"的基础上。
2. **校验流程**：操作前必须使用 `get_scene_hierarchy` / `manage_components(get)` 确认目标存在。
3. **禁止假设**：禁止盲目尝试对不存在的对象或属性进行修改。

## 更新日志

请查阅 [UPDATE_LOG.md](./UPDATE_LOG.md) 了解详细的版本更新历史。

## 许可证

GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007

完整的许可证文本可在项目根目录的 LICENSE 文件中找到。
