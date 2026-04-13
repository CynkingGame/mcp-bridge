import { UiPolicyConfig, normalizeUiPolicy } from "./UiPolicy";
import { normalizeAutoNineSlicePolicy } from "./AutoNineSlice";

export interface McpPromptArgumentDefinition {
	name: string;
	description: string;
	required?: boolean;
}

export interface McpPromptDefinition {
	name: string;
	description: string;
	arguments?: McpPromptArgumentDefinition[];
}

export function buildUiPolicyWorkflowGuide(policyInput?: Partial<UiPolicyConfig> | null): string {
	const policy = normalizeUiPolicy(policyInput || {});
	const presetNames = Object.keys(policy.presets);
	const presetText = presetNames.length > 0 ? presetNames.join("、") : "无";
	const autoNineSlice = normalizeAutoNineSlicePolicy(policy);
	const repeatableUi = policy.repeatableUi;
	const nodeNamingText =
		policy.nodeNaming && policy.nodeNaming.englishOnly
			? "场景和预制体中的节点名称只能使用英文，且仅允许字母、数字、空格、下划线和连字符。"
			: "节点名称遵循项目约定。";
	const autoNineSliceRuleText =
		autoNineSlice.enabled && autoNineSlice.rules.length > 0
			? `名称包含 点9 时自动按短边一半取整；额外规则仅作兼容补充：${autoNineSlice.rules
					.map((rule) => `${rule.pattern} -> [${rule.border.join(", ")}]`)
					.join("；")}`
			: autoNineSlice.enabled
				? "名称包含 点9 时自动按短边一半取整"
			: "未启用";

	return [
		"# BigWinGame UI Prefab Workflow",
		"",
		"## 核心原则",
		"- 创建 UI 节点时优先使用 `uiPreset` 或 `layout`，不要先手写坐标。",
		"- 创建全屏 UI 预制体时优先使用 `rootPreset`，不要依赖手工补 Widget。",
		`- ${nodeNamingText}`,
		"- `Label` 组件的 `overflow` 默认保持 `NONE`，不要默认改成 `CLAMP`/`RESIZE_HEIGHT`。",
		"- 修改已有 prefab 后，先调用 `apply_ui_policy`，再调用 `validate_ui_prefab` 自检。",
		"- 使用名字包含 `点9` 的纹理时，直接按纹理短边的一半向下取整生成四边 Border；已存在节点可用 `ensure_current_9slice_textures` 兜底扫描。",
		`- 当同结构 UI 重复达到 ${repeatableUi.reuseThreshold} 个及以上时，优先抽成独立 Item prefab，并通过脚本参数化生成。`,
		"- 当设计师提供结构化设计 JSON 时，优先使用 `import_design_layout`，不要退回到逐个 `create_node` 手工搭界面。",
		"- 设计稿导入时先调用 `analyze_design_layout` 做只读分析，再由 AI 明确决定执行参数。",
		"- 图片素材优先使用项目 `assets` 内的正式资源目录，并在 `import_design_layout` 中通过 `imageAssetDir` 传入。",
		"- `import_design_layout` 始终只允许复用你提供的正式素材目录；缺失图片会直接失败，不再依赖 `strictImageAssets` 开关。",
		"- 禁止使用 JSON 中携带的 base64 图片导入项目；图片节点只能复用输入里提供的正式素材路径。",
		"",
		"## 推荐流程",
		"1. `open_prefab` 或进入目标场景。",
		"2. `create_node` 时优先传 `uiPreset`；按钮默认遵循中心锚点规则。",
		"3. 如果已有设计 JSON，先调用 `analyze_design_layout`，并同时传入 `jsonPath`、`imageAssetDir/imageAssetDirs` 与已有 `imageAssetMap`。",
		"4. 根据分析结果补齐 `imageAssetMap` 并确认 `rootPreset`；不要为纯色块或圆角块安排自动生成贴图。",
		"5. 再调用 `import_design_layout` 正式导入；不要尝试把 JSON 图片导出到项目。",
		"6. 需要创建全屏根节点 prefab 时，使用 `create_prefab` 或 `prefab_management.create`，并传 `rootPreset`。",
		"7. 生成 prefab 后，默认同步生成并挂载同名脚本；脚本中要为动态数据和交互组件生成 `@property` 与绑定代码。",
		"8. 使用 `点9` 纹理后，必要时调用 `ensure_current_9slice_textures` 自动补齐缺失的 9-slice 边距。",
		"9. 对已存在节点使用 `apply_ui_policy` 修正规范。",
		"10. 结束前使用 `validate_ui_prefab` 校验。",
		"",
		"## 当前项目预设",
		`- ${presetText}`,
		`- repeatableUi: threshold=${repeatableUi.reuseThreshold}, prefab=${repeatableUi.preferPrefab}, dataDriven=${repeatableUi.preferDataDriven}`,
		`- autoNineSlice: ${autoNineSliceRuleText}`,
		"",
		"## 推荐预设用法",
		"- `button`: 按钮默认中心锚点 `(0.5, 0.5)`。",
		"- `screen-root`: 全屏根节点，自动使用 `Widget/full` 适配长屏。",
		"- `safe-area-root`: 全屏交互根节点，自动使用 `Widget/full + SafeArea`。",
		"",
		"## 重复块约束",
		`- 同级结构重复 ${repeatableUi.reuseThreshold} 次及以上，且差异仅在文本/图片/数字/状态时，优先抽成 \`${repeatableUi.itemPrefabSuffix}\` 预制体。`,
		"- 页面本体只保留列表容器，不手工复制大量节点。",
		`- 推荐脚本接口：${repeatableUi.recommendedScriptApis.join("、")}。`,
		"",
		"## 设计 JSON 导入约束",
		"- `analyze_design_layout` 用于 AI 在执行前先确认图片缺失与显式映射是否完整。",
		"- `import_design_layout` 的首选输入组合：`jsonPath + prefabName + imageAssetDir`。",
		"- 图片节点优先按名称匹配 `imageAssetDir` 下已有素材；命中后直接复用，不再生成任何临时图片。",
		"- 缺失图片节点会直接报错；不要依赖 `strictImageAssets` 或其他开关绕过该约束。",
	].join("\n");
}

export function getUiPromptDefinitions(): McpPromptDefinition[] {
	return [
		{
			name: "ui-workflow-guardrails",
			description: "读取当前项目 UI policy/workflow 后，为 AI 生成受约束的执行提示词。",
			arguments: [
				{
					name: "task",
					description: "当前要完成的 UI 任务，例如“导入活动页设计稿”或“修正已有 prefab”。",
					required: false,
				},
			],
		},
		{
			name: "design-import-planner",
			description: "将设计稿导入任务拆成“先分析、再决定、后执行”的严格工作流，减少 MCP 自主猜测。",
			arguments: [
				{
					name: "jsonPath",
					description: "设计 JSON 路径。",
					required: false,
				},
				{
					name: "task",
					description: "当前设计导入任务说明。",
					required: false,
				},
			],
		},
	];
}

export function buildUiWorkflowPrompt(
	policyInput?: Partial<UiPolicyConfig> | null,
	task?: string | null,
): string {
	const workflow = buildUiPolicyWorkflowGuide(policyInput);
	return [
		"你在使用 Cocos Creator MCP Bridge 为当前项目搭建或修正 UI。",
		task ? `当前任务：${task}` : "当前任务：遵循项目 UI 规范完成界面搭建或修正。",
		"",
		"执行要求：",
		"- 先读取 `cocos://ui/policy` 与 `cocos://ui/workflow`，再决定工具调用。",
		"- 优先让 AI 明确决定 `uiPreset`、`rootPreset`、图片资源映射和重复块拆分方式。",
		"- MCP 工具负责执行与校验，不负责替你补全缺失设计意图。",
		"- 如果信息不足，不要猜测组件属性；先补足上下文，再执行。",
		"",
		workflow,
	].join("\n");
}

export function buildDesignImportPlannerPrompt(
	policyInput?: Partial<UiPolicyConfig> | null,
	options?: {
		jsonPath?: string | null;
		task?: string | null;
	},
): string {
	const workflow = buildUiPolicyWorkflowGuide(policyInput);
	const jsonPath = options && options.jsonPath ? String(options.jsonPath) : "";
	const task = options && options.task ? String(options.task) : "";

	return [
		"你要导入设计稿到 Cocos Creator，但必须采用“AI 决策前置，MCP 严格执行”的流程。",
		task ? `当前任务：${task}` : "当前任务：分析并导入设计稿。",
		jsonPath ? `设计 JSON：${jsonPath}` : "",
		"",
		"强制流程：",
		"1. 先读取 `cocos://ui/policy` 与 `cocos://ui/workflow`。",
		"2. 先调用只读工具 `analyze_design_layout`，识别设计结构、缺失图片和可复用素材。",
		"3. 由 AI 明确决定 `imageAssetMap`、`imageAssetDir/imageAssetDirs`、`rootPreset`。",
		"4. 如果图片节点仍未绑定正式素材，则优先补齐 `imageAssetMap`；不要直接让执行层猜。",
		"5. 执行 `import_design_layout` 时默认就是正式素材严格模式；素材缺失时应直接失败而不是偷偷降级。",
		"6. 导入后使用 `validate_ui_prefab` 校验根节点与按钮锚点。",
		"",
		"禁止事项：",
		"- 不要直接依赖 `import_design_layout` 的隐式匹配去猜所有图片。",
		"- 不要把截图当作坐标真值来源。",
		"- 不要在素材缺失时默默接受不可用结果。",
		"",
		workflow,
	]
		.filter(Boolean)
		.join("\n");
}
