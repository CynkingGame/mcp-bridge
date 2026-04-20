import fs from "fs";
import path from "path";
import { UiPolicyConfig, getDefaultUiPolicy, mergeUiPolicy, normalizeUiPolicy } from "./UiPolicy";
import { buildUiPolicyWorkflowGuide } from "./UiPolicyPrompt";

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

function tryReadText(filePath: string): string | null {
	if (!fs.existsSync(filePath)) {
		return null;
	}
	try {
		return fs.readFileSync(filePath, "utf8");
	} catch (_error) {
		return null;
	}
}

export function loadProjectUiPolicy(projectRoot: string, packageRoot?: string): UiPolicyConfig {
	const resolvedPackageRoot = packageRoot || path.join(projectRoot, "packages", "mcp-bridge");
	const policyCandidates = [
		path.join(resolvedPackageRoot, ".agent", "mcp-ui-policy.json"),
		path.join(projectRoot, ".agent", "mcp-ui-policy.json"),
	];

	let policy = getDefaultUiPolicy();
	for (const filePath of policyCandidates) {
		const raw = tryReadJson(filePath);
		if (raw) {
			policy = mergeUiPolicy(policy, raw);
		}
	}

	return normalizeUiPolicy(policy);
}

export function loadProjectUiWorkflow(projectRoot: string, packageRoot?: string): string {
	const resolvedPackageRoot = packageRoot || path.join(projectRoot, "packages", "mcp-bridge");
	const workflowCandidates = [
		path.join(projectRoot, ".agent", "ai-ui-workflow.md"),
		path.join(resolvedPackageRoot, ".agent", "ai-ui-workflow.md"),
	];

	for (const filePath of workflowCandidates) {
		const content = tryReadText(filePath);
		if (content && content.trim()) {
			return content;
		}
	}

	return buildUiPolicyWorkflowGuide(loadProjectUiPolicy(projectRoot, resolvedPackageRoot));
}

export function loadProjectUiPolicyForCurrentEditor(): UiPolicyConfig {
	if (typeof Editor !== "undefined" && Editor.Project && Editor.Project.path) {
		return loadProjectUiPolicy(Editor.Project.path);
	}
	return getDefaultUiPolicy();
}

export function loadProjectUiWorkflowForCurrentEditor(): string {
	if (typeof Editor !== "undefined" && Editor.Project && Editor.Project.path) {
		return loadProjectUiWorkflow(Editor.Project.path);
	}
	return buildUiPolicyWorkflowGuide(getDefaultUiPolicy());
}

export function getUiPolicySummary(policyInput?: Partial<UiPolicyConfig> | null): string {
	const policy = normalizeUiPolicy(policyInput || getDefaultUiPolicy());
	const presetNames = Object.keys(policy.presets);
	const presetSummary = presetNames
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
	const namingSummary =
		policy.nodeNaming && policy.nodeNaming.englishOnly ? "nodeNaming=english-only" : "";

	return [presetSummary, namingSummary].filter(Boolean).join("; ");
}
