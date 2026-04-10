import { UiPolicyConfig, normalizeUiPolicy } from "./UiPolicy";
import { normalizeAutoNineSlicePolicy } from "./AutoNineSlice";

export function buildUiPolicyWorkflowGuide(policyInput?: Partial<UiPolicyConfig> | null): string {
	const policy = normalizeUiPolicy(policyInput || {});
	const presetNames = Object.keys(policy.presets);
	const presetText = presetNames.length > 0 ? presetNames.join("、") : "无";
	const autoNineSlice = normalizeAutoNineSlicePolicy(policy);
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
		"",
		"## 推荐流程",
		"1. `open_prefab` 或进入目标场景。",
		"2. `create_node` 时优先传 `uiPreset`；按钮默认遵循中心锚点规则。",
		"3. 需要创建全屏根节点 prefab 时，使用 `create_prefab` 或 `prefab_management.create`，并传 `rootPreset`。",
		"4. 使用 `点9` 纹理后，必要时调用 `ensure_current_9slice_textures` 自动补齐缺失的 9-slice 边距。",
		"5. 对已存在节点使用 `apply_ui_policy` 修正规范。",
		"6. 结束前使用 `validate_ui_prefab` 校验。",
		"",
		"## 当前项目预设",
		`- ${presetText}`,
		`- autoNineSlice: ${autoNineSliceRuleText}`,
		"",
		"## 推荐预设用法",
		"- `button`: 按钮默认中心锚点 `(0.5, 0.5)`。",
		"- `screen-root`: 全屏根节点，自动使用 `Widget/full` 适配长屏。",
		"- `safe-area-root`: 全屏交互根节点，自动使用 `Widget/full + SafeArea`。",
	].join("\n");
}
