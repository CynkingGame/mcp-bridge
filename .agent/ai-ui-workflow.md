# UI Workflow

## 核心约束

- 当用户或任务明确要求“通过 MCP”完成时，必须先确认 MCP 可正常调用；如果 MCP 无法连接、无响应或返回传输层错误，任务必须立即终止，并明确提示“任务依赖 MCP，当前 MCP 不可用”，禁止改用手工流程冒充完成。
- 创建 UI 节点时优先使用 `uiPreset` 或 `layout`，不要先手写坐标。
- 创建全屏 UI 预制体时优先使用 `rootPreset`，不要依赖手工补 Widget。
- 全屏 UI 根节点默认按长屏适配处理；需要安全区时使用 `safe-area-root`。
- 当设计师提供了结构化导出 JSON（如 `hall_info` 示例）时，，先调用 `analyze_design_layout` 做只读分析，再由 AI 明确决定 `imageAssetMap`、`rootPreset`、`logic`，最后再执行 `import_design_layout`，不要退回到手工逐个 `create_node`。
- 设计 JSON 是结构和样式真值来源；截图只用于人工或 AI 视觉比对，不作为坐标和字体参数的主数据源。JSON 中的节点命名和层级只代表设计稿组织方式，不代表最终页面逻辑；正式导入前，AI 必须先形成 `logic` 方案，明确根节点名、逻辑分组、关键节点重命名和 property/dataKey 规划。
- `logic.rules` 不仅用于重命名；还应优先声明关键节点的 `propertyName`、`dataKey`、`group`，按钮额外声明 `handlerName`，让 AI 决定节点用途和脚本模块划分。
- 场景和预制体中的节点名称只能使用带组件缩写前缀（3-4个小写字母）+ （2-3个能表明节点用途的英文单词），且仅允许字母、数字、空格、下划线和连字符， `img001/txt001/ctn001` 这类占位命名视为逻辑信息不足，不能作为最终节点名；语义节点名应能从名称推断用途。
- 图片素材必须使用设计师单独提供并已放入 `assets` 的正式资源目录；调用 `import_design_layout` 时应同时传入素材目录。`import_design_layout` 已固定为正式素材严格模式，不再依赖 `strictImageAssets` 开关决定是否允许缺图降级。
- `Label` 组件的 `overflow` 默认应保持 `NONE`， JSON中fontFamily如果命中项目内已有字体资源，应绑定对应的 `cc.TTFFont`/字体资源；不要把 `useSystemFont` 打开后仅填 `fontFamily=xxx` 伪装成项目字体。
- `Button` 锚点必须为 `(0.5, 0.5)`，通过在预制体或场景中挂载脚本响应事件。
- `Sprite` 赋图后，点9图或已配置 border 的图使用 `SLICED`和`CUSTOM` 且宽高从Json文件获取，非点9图片默认使用 `SIMPLE`和`RAW`。使用名字包含“点9”的纹理时，如果所有Border都为0，则按纹理长宽较小值的一半向下取整生成四边 Border；点9判定以最终绑定资源名与资源 meta 为准，不以设计层名为准；必要时调用 `ensure_current_9slice_textures` 兜底扫描。
- 生成 prefab 后，默认同时生成并挂载同名脚本；脚本成员、分组和接口应按页面逻辑设计。需要变更数据的节点，必须在脚本中用装饰器 `@property`定义为成员变量（变量名和节点名保持一致）并在场景或 prefab 上直接挂载节点；禁止生成运行时代码动态绑定组件和节点。

## 重复块规则

- 当同级结构重复达到 `3` 个及以上，且差异主要在文本、图片、数字、状态时，不要手工复制多个节点。
- 这类结构必须优先抽成单独的 `Item prefab`。
- 如果需要快速落地，优先使用 `scaffold_repeatable_ui` 生成 Item prefab、容器 prefab 和脚本骨架。
- 页面本体只保留列表容器、滚动容器或布局容器。
- 数据项通过脚本参数化生成，推荐接口：
  - `setData(data)`
  - `render(list)`
- 常见场景：
  - 排行榜条目
  - 奖励格子
  - 商店商品项
  - Tab 列表项
  - 活动列表项

## 推荐流程

1. `open_prefab` 或进入目标场景。
2. 先搭建页面根节点和容器节点，优先使用 `screen-root` / `safe-area-root`。
3. 如果已有设计 JSON，先调用 `analyze_design_layout`，检查缺失图片和可复用素材。
通过返回的 `recommendedImportArgs` 作为 `import_design_layout` 的首选参数来源，不要手写大段 `logic.rules`。
4. 由 AI 根据分析结果补齐 `imageAssetMap`、确认 `rootPreset`，并写出 `logic` 方案；不要允许执行层自动生成 shape 或其他临时图片。
5. `logic` 至少应覆盖：`rootName`、逻辑容器路径、关键节点逻辑名称、需要暴露为 `@property` 的成员名，以及可刷新的 `dataKey`。
6. 按钮节点除命名外，还应在 `logic.rules` 中补 `handlerName`；脚本主函数 `setData/render` 只负责调度，具体逻辑拆到按 `group` 划分的 `setDataGroupX/renderGroupX`。
7. 当 `analyze_design_layout` 返回 `logicReadiness.requiresExplicitLogic=true` 时，必须先补齐 `logic`，禁止直接导入。
8. 再调用 `import_design_layout` 导入层级和文字样式；图片节点只允许使用你明确给出的素材目录和映射，节点名和组织结构优先服从 `logic`。
9. 如果任一必需的 MCP 调用失败且无法在当前会话中恢复，立即终止任务，并向用户报告具体失败的 MCP 调用和错误信息。
10. 导入后检查自动生成脚本：应生成 `@property` 挂载、按钮事件方法和点击事件挂载；不得包含运行时查找节点的绑定代码。
11. `scaffold_repeatable_ui` 会自动尝试把生成的脚本挂到对应 prefab 根节点，并绑定 `itemPrefab`。
12. 通过数据生成 item，不要手工复制多个实例。
13. 使用 `apply_ui_policy` 修正已有节点。
14. 使用 `validate_ui_prefab` 做最终校验。

## 禁止事项

- 禁止为了赶进度，在场景或 prefab 中手工摆放大量重复 item。
- 禁止点9图继续使用 `RAW` 导致拉伸失真。
- 禁止按钮继续使用非中心锚点。
- 禁止在已经有设计 JSON 的情况下，忽略其中的字体、行高、尺寸、层级信息，仅凭截图目测还原。
- 禁止把设计稿中的 `Container_layer_x`、中文素材名、临时分组名直接当成最终业务节点名、脚本成员名或数据接口字段名。
- 禁止生成运行时 `this.findComponent(...)` / `bindReferences()`。
- 禁止使用 JSON 中携带的 base64 图片作为项目图片资源来源。
- 禁止在任务明确要求使用 MCP 的前提下，在 MCP 不可用时继续手工执行并声称已完成。
