import { UiPolicyConfig, normalizeUiPolicy } from "./UiPolicy";
import { normalizeAutoNineSlicePolicy } from "./AutoNineSlice";

export function buildUiPolicyWorkflowGuide(policyInput?: Partial<UiPolicyConfig> | null): string {
	const policy = normalizeUiPolicy(policyInput || {});
	const presetNames = Object.keys(policy.presets);
	const presetText = presetNames.length > 0 ? presetNames.join("、") : "无";
	const autoNineSlice = normalizeAutoNineSlicePolicy(policy);
	const repeatableUi = policy.repeatableUi;
	const autoNineSliceRuleText =
		autoNineSlice.enabled && autoNineSlice.rules.length > 0
			? autoNineSlice.rules.map((rule) => `${rule.pattern} -> [${rule.border.join(", ")}]`).join("；")
			: "未启用";

	return [
		"# BigWinGame UI Prefab Workflow",
		"",
		"## 核心原则",
		"- 创建 UI 节点时优先使用 `uiPreset` 或 `layout`，不要先手写坐标。",
		"- 创建全屏 UI 预制体时优先使用 `rootPreset`，不要依赖手工补 Widget。",
		"- 修改已有 prefab 后，先调用 `apply_ui_policy`，再调用 `validate_ui_prefab` 自检。",
		"- 使用名字包含 `点9` 的纹理时，优先复用项目 `autoNineSlice` 规则；已存在节点可用 `ensure_current_9slice_textures` 兜底扫描。",
		`- 当同结构 UI 重复达到 ${repeatableUi.reuseThreshold} 个及以上时，优先抽成独立 Item prefab，并通过脚本参数化生成。`,
		"- 当设计师提供结构化设计 JSON 时，优先使用 `import_design_layout`，不要退回到逐个 `create_node` 手工搭界面。",
		"- 图片素材优先使用项目 `assets` 内的正式资源目录，并在 `import_design_layout` 中通过 `imageAssetDir` 传入。",
		"- 禁止使用 JSON 中携带的 base64 图片导入项目；图片节点只能复用输入里提供的正式素材路径。",
		"",
		"## 推荐流程",
		"1. `open_prefab` 或进入目标场景。",
		"2. `create_node` 时优先传 `uiPreset`；按钮默认遵循中心锚点规则。",
		"3. 如果已有设计 JSON，优先调用 `import_design_layout`，并同时传入 `jsonPath`、`prefabName`、`imageAssetDir`；不要尝试把 JSON 图片导出到项目。",
		"4. 需要创建全屏根节点 prefab 时，使用 `create_prefab` 或 `prefab_management.create`，并传 `rootPreset`。",
		"5. 使用 `点9` 纹理后，必要时调用 `ensure_current_9slice_textures` 自动补齐缺失的 9-slice 边距。",
		"6. 对已存在节点使用 `apply_ui_policy` 修正规范。",
		"7. 结束前使用 `validate_ui_prefab` 校验。",
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
		"- `import_design_layout` 的首选输入组合：`jsonPath + prefabName + imageAssetDir`。",
		"- 图片节点优先按名称匹配 `imageAssetDir` 下已有素材；命中后直接复用，不再生成临时图片。",
		"- 纯色块、圆角块等没有独立素材的视觉元素，允许插件自动生成贴图以提高还原度。",
	].join("\n");
}
