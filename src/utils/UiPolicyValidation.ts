import { resolveNamedUiPreset, resolvePrefabRootPolicy, UiPolicyConfig, UiLayoutName } from "./UiPolicy";
import { getNodeNameValidationMessage } from "./NodeNaming";

export interface UiWidgetSnapshot {
	isAlignTop?: boolean;
	isAlignBottom?: boolean;
	isAlignLeft?: boolean;
	isAlignRight?: boolean;
	isAlignHorizontalCenter?: boolean;
	isAlignVerticalCenter?: boolean;
}

export interface UiNodeSnapshot {
	name: string;
	uuid?: string;
	anchor?: {
		x: number;
		y: number;
	} | null;
	size?: {
		width: number;
		height: number;
	} | null;
	components?: string[];
	hasSafeArea?: boolean;
	widget?: UiWidgetSnapshot | null;
	children?: UiNodeSnapshot[];
}

export interface UiValidationFinding {
	severity: "error" | "warn";
	code: string;
	message: string;
	nodeName: string;
	nodeUuid?: string;
}

export interface UiValidationResult {
	ok: boolean;
	rootPreset: string | null;
	findings: UiValidationFinding[];
}

function hasButtonComponent(node: UiNodeSnapshot): boolean {
	const components = node.components || [];
	return components.some((component) => component === "cc.Button" || component === "Button");
}

function isAnchorEqual(
	actual?: { x: number; y: number } | null,
	expected?: { x: number; y: number } | null,
	tolerance = 0.001,
): boolean {
	if (!actual || !expected) {
		return false;
	}
	return Math.abs(actual.x - expected.x) <= tolerance && Math.abs(actual.y - expected.y) <= tolerance;
}

function matchesLayout(widget: UiWidgetSnapshot | null | undefined, layout: UiLayoutName | null | undefined): boolean {
	if (!layout) {
		return true;
	}
	if (!widget) {
		return false;
	}

	switch (layout) {
		case "center":
			return !!widget.isAlignHorizontalCenter && !!widget.isAlignVerticalCenter;
		case "full":
			return !!widget.isAlignTop && !!widget.isAlignBottom && !!widget.isAlignLeft && !!widget.isAlignRight;
		case "top":
			return !!widget.isAlignTop && !!widget.isAlignHorizontalCenter;
		case "bottom":
			return !!widget.isAlignBottom && !!widget.isAlignHorizontalCenter;
		case "left":
			return !!widget.isAlignLeft && !!widget.isAlignVerticalCenter;
		case "right":
			return !!widget.isAlignRight && !!widget.isAlignVerticalCenter;
		case "top-left":
			return !!widget.isAlignTop && !!widget.isAlignLeft;
		case "top-right":
			return !!widget.isAlignTop && !!widget.isAlignRight;
		case "bottom-left":
			return !!widget.isAlignBottom && !!widget.isAlignLeft;
		case "bottom-right":
			return !!widget.isAlignBottom && !!widget.isAlignRight;
		default:
			return true;
	}
}

function walkTree(node: UiNodeSnapshot, visit: (current: UiNodeSnapshot) => void) {
	visit(node);
	for (const child of node.children || []) {
		walkTree(child, visit);
	}
}

export function validateUiTree(
	policy: Partial<UiPolicyConfig> | null | undefined,
	rootNode: UiNodeSnapshot,
	options?: { expectedRootPreset?: string | null },
): UiValidationResult {
	const findings: UiValidationFinding[] = [];

	const resolvedRootPolicy = options?.expectedRootPreset
		? resolveNamedUiPreset(policy, options.expectedRootPreset)
		: resolvePrefabRootPolicy(policy, {
				nodeSize: rootNode.size || null,
			});

	const rootPresetName = resolvedRootPolicy.presetName || null;

	if (resolvedRootPolicy.anchor && !isAnchorEqual(rootNode.anchor, resolvedRootPolicy.anchor)) {
		findings.push({
			severity: "error",
			code: "root-anchor-mismatch",
			message: `根节点锚点应为 (${resolvedRootPolicy.anchor.x}, ${resolvedRootPolicy.anchor.y})`,
			nodeName: rootNode.name,
			nodeUuid: rootNode.uuid,
		});
	}

	if (resolvedRootPolicy.layout && !matchesLayout(rootNode.widget, resolvedRootPolicy.layout)) {
		findings.push({
			severity: "error",
			code: "root-layout-mismatch",
			message: `根节点缺少符合 ${resolvedRootPolicy.layout} 的 Widget 对齐配置`,
			nodeName: rootNode.name,
			nodeUuid: rootNode.uuid,
		});
	}

	if (resolvedRootPolicy.safeArea && !rootNode.hasSafeArea) {
		findings.push({
			severity: "error",
			code: "root-safe-area-missing",
			message: "根节点缺少 SafeArea 组件",
			nodeName: rootNode.name,
			nodeUuid: rootNode.uuid,
		});
	}

	walkTree(rootNode, (currentNode) => {
		const nodeNameError = getNodeNameValidationMessage(policy, currentNode.name);
		if (nodeNameError) {
			findings.push({
				severity: "error",
				code: "node-name-non-english",
				message: nodeNameError,
				nodeName: currentNode.name,
				nodeUuid: currentNode.uuid,
			});
		}

		if (!hasButtonComponent(currentNode)) {
			return;
		}

		if (!isAnchorEqual(currentNode.anchor, { x: 0.5, y: 0.5 })) {
			findings.push({
				severity: "error",
				code: "button-anchor-mismatch",
				message: "按钮节点锚点应为中心点 (0.5, 0.5)",
				nodeName: currentNode.name,
				nodeUuid: currentNode.uuid,
			});
		}
	});

	return {
		ok: findings.length === 0,
		rootPreset: rootPresetName,
		findings,
	};
}
