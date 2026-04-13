import { UiPolicyConfig, normalizeUiPolicy } from "./UiPolicy";

export interface UiNodeNamingPolicy {
	englishOnly: boolean;
	allowedPattern: string;
	autoSanitizeDesignLayout: boolean;
}

const DEFAULT_NODE_NAMING_POLICY: UiNodeNamingPolicy = {
	englishOnly: false,
	allowedPattern: "^[A-Za-z0-9][A-Za-z0-9 _-]*$",
	autoSanitizeDesignLayout: true,
};

function cloneValue<T>(value: T): T {
	if (value === undefined || value === null || typeof value !== "object") {
		return value;
	}
	return JSON.parse(JSON.stringify(value));
}

function normalizeAsciiToken(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[^\x00-\x7F]+/g, "_")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");
}

export function getNodeNamingPolicy(
	policyInput?: Partial<UiPolicyConfig> | null,
): UiNodeNamingPolicy {
	const policy = normalizeUiPolicy(policyInput || {});
	const raw = (policy && policy.nodeNaming) || {};
	return {
		englishOnly: !!raw.englishOnly,
		allowedPattern:
			typeof raw.allowedPattern === "string" && raw.allowedPattern.trim()
				? raw.allowedPattern.trim()
				: DEFAULT_NODE_NAMING_POLICY.allowedPattern,
		autoSanitizeDesignLayout: raw.autoSanitizeDesignLayout !== false,
	};
}

export function isNodeNameAllowed(
	policyInput: Partial<UiPolicyConfig> | null | undefined,
	nodeName: string,
): boolean {
	const policy = getNodeNamingPolicy(policyInput);
	if (!policy.englishOnly) {
		return true;
	}
	const trimmed = String(nodeName || "").trim();
	if (!trimmed) {
		return false;
	}
	return new RegExp(policy.allowedPattern).test(trimmed);
}

export function getNodeNameValidationMessage(
	policyInput: Partial<UiPolicyConfig> | null | undefined,
	nodeName: string,
): string | null {
	if (isNodeNameAllowed(policyInput, nodeName)) {
		return null;
	}
	const policy = getNodeNamingPolicy(policyInput);
	if (!policy.englishOnly) {
		return null;
	}
	return `节点名称只能使用英文，且仅允许字母、数字、空格、下划线和连字符: ${nodeName}`;
}

export function sanitizeNodeName(
	nodeName: string,
	options?: {
		fallbackPrefix?: string;
		fallbackSuffix?: string;
		usedNames?: Set<string>;
	},
): string {
	const fallbackPrefix = normalizeAsciiToken(options?.fallbackPrefix || "Node") || "Node";
	const fallbackSuffix = normalizeAsciiToken(options?.fallbackSuffix || "");
	const usedNames = options?.usedNames || null;

	let candidate = normalizeAsciiToken(nodeName);
	if (!candidate) {
		candidate = fallbackSuffix ? `${fallbackPrefix}_${fallbackSuffix}` : fallbackPrefix;
	}

	if (!/^[A-Za-z0-9]/.test(candidate)) {
		candidate = `${fallbackPrefix}_${candidate}`;
	}

	if (!usedNames) {
		return candidate;
	}

	let nextName = candidate;
	let counter = 2;
	const makeKey = (value: string) => value.toLowerCase();
	while (usedNames.has(makeKey(nextName))) {
		const suffix = fallbackSuffix || "Node";
		nextName = `${candidate}_${suffix}_${counter}`;
		counter++;
	}
	usedNames.add(makeKey(nextName));
	return nextName;
}

export function cloneSanitizedDesignNodeTree<T extends Record<string, any>>(
	node: T,
	options?: {
		usedNames?: Set<string>;
	},
): T {
	const usedNames = options?.usedNames || new Set<string>();
	const cloned = cloneValue(node);

	const visit = (currentNode: Record<string, any>) => {
		const nodeType = currentNode.isButton
			? "Button"
			: currentNode.nodeType === "image"
				? "Sprite"
				: currentNode.nodeType === "text"
					? "Label"
					: "Container";
		currentNode.name = sanitizeNodeName(currentNode.name, {
			fallbackPrefix: nodeType,
			fallbackSuffix: currentNode.id || nodeType,
			usedNames,
		});
		(currentNode.children || []).forEach(visit);
	};

	visit(cloned);
	return cloned;
}
