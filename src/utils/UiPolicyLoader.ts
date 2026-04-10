import fs from "fs";
import path from "path";
import { UiPolicyConfig, getDefaultUiPolicy, mergeUiPolicy, normalizeUiPolicy } from "./UiPolicy";

function tryReadJson(filePath: string): Record<string, any> | null {
	if (!fs.existsSync(filePath)) {
		return null;
	}
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (_error) {
		return null;
	}
}

export function loadProjectUiPolicy(projectRoot: string, packageRoot?: string): UiPolicyConfig {
	const resolvedPackageRoot = packageRoot || path.join(projectRoot, "packages", "mcp-bridge");
	const settingsOverride = path.join(projectRoot, "settings", "mcp-ui-policy.json");
	const packagePolicy = path.join(resolvedPackageRoot, "project-ui-policy.json");

	let policy = getDefaultUiPolicy();
	for (const filePath of [packagePolicy, settingsOverride]) {
		const raw = tryReadJson(filePath);
		if (raw) {
			policy = mergeUiPolicy(policy, raw);
		}
	}

	return normalizeUiPolicy(policy);
}

export function loadProjectUiPolicyForCurrentEditor(): UiPolicyConfig {
	if (typeof Editor !== "undefined" && Editor.Project && Editor.Project.path) {
		return loadProjectUiPolicy(Editor.Project.path);
	}
	return getDefaultUiPolicy();
}

export function getUiPolicySummary(policyInput?: Partial<UiPolicyConfig> | null): string {
	const policy = normalizeUiPolicy(policyInput || getDefaultUiPolicy());
	const presetNames = Object.keys(policy.presets);
	if (presetNames.length === 0) {
		return "";
	}

	return presetNames
		.map((presetName) => {
			const preset = policy.presets[presetName];
			const layoutText = preset.layout ? `layout=${preset.layout}` : "layout=inherit";
			const anchorText = preset.anchor
				? `anchor=(${preset.anchor.x},${preset.anchor.y})`
				: "anchor=inherit";
			const safeAreaText = preset.safeArea ? "safe-area" : "no-safe-area";
			return `${presetName} [${layoutText}, ${anchorText}, ${safeAreaText}]`;
		})
		.join("; ");
}
