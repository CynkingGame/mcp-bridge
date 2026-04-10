export const UI_LAYOUT_NAMES = [
	"center",
	"top",
	"bottom",
	"left",
	"right",
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
	"full",
] as const;

export type UiLayoutName = (typeof UI_LAYOUT_NAMES)[number];

export interface UiAnchorConfig {
	x: number;
	y: number;
}

export interface UiPresetConfig {
	anchor?: UiAnchorConfig | null;
	layout?: UiLayoutName | null;
	safeArea?: boolean;
	description?: string;
}

export interface UiPolicyConfig {
	project?: string;
	canvas: {
		designResolution: {
			width: number;
			height: number;
		};
		fitWidth: boolean;
		fitHeight: boolean;
	};
	createNode: {
		autoParentUiToCanvas: boolean;
		defaultPresetsByType: Record<string, string>;
	};
	prefabRoot: {
		autoDetectScreenRoot: {
			enabled: boolean;
			preset: string;
			tolerance: number;
		};
	};
	presets: Record<string, UiPresetConfig>;
}

export interface ResolvedUiNodePolicy {
	presetName: string | null;
	anchor: UiAnchorConfig | null;
	layout: UiLayoutName | null;
	safeArea: boolean;
	autoParentToCanvas: boolean;
}

export interface ResolvedNamedUiPreset {
	presetName: string | null;
	anchor: UiAnchorConfig | null;
	layout: UiLayoutName | null;
	safeArea: boolean;
}

export interface ResolvePrefabRootPolicyArgs {
	rootPreset?: string | null;
	nodeSize?: {
		width: number;
		height: number;
	} | null;
	canvasDesignResolution?: {
		width: number;
		height: number;
	} | null;
}

export interface ResolvedPrefabRootPolicy {
	shouldApply: boolean;
	presetName: string | null;
	anchor: UiAnchorConfig | null;
	layout: UiLayoutName | null;
	safeArea: boolean;
}

const DEFAULT_UI_POLICY: UiPolicyConfig = {
	project: "default",
	canvas: {
		designResolution: {
			width: 960,
			height: 640,
		},
		fitWidth: false,
		fitHeight: true,
	},
	createNode: {
		autoParentUiToCanvas: true,
		defaultPresetsByType: {
			button: "button",
		},
	},
	prefabRoot: {
		autoDetectScreenRoot: {
			enabled: true,
			preset: "screen-root",
			tolerance: 2,
		},
	},
	presets: {
		button: {
			anchor: { x: 0.5, y: 0.5 },
			description: "Buttons use a center anchor by default.",
		},
		"screen-root": {
			anchor: { x: 0.5, y: 0.5 },
			layout: "full",
			description: "Full-screen root stretched to its parent.",
		},
		"safe-area-root": {
			anchor: { x: 0.5, y: 0.5 },
			layout: "full",
			safeArea: true,
			description: "Full-screen root constrained to the safe area.",
		},
	},
};

function isPlainObject(value: unknown): value is Record<string, any> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
	if (value === undefined || value === null || typeof value !== "object") {
		return value;
	}
	return JSON.parse(JSON.stringify(value));
}

export function getDefaultUiPolicy(): UiPolicyConfig {
	return cloneValue(DEFAULT_UI_POLICY);
}

export function mergeUiPolicy<T>(base: T, override: any): T {
	if (override === undefined || override === null) {
		return cloneValue(base);
	}
	if (Array.isArray(base) || Array.isArray(override)) {
		return cloneValue(override) as T;
	}
	if (!isPlainObject(base) || !isPlainObject(override)) {
		return cloneValue(override) as T;
	}

	const result: Record<string, any> = {};
	const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
	for (const key of keys) {
		if (!(key in override)) {
			result[key] = cloneValue((base as any)[key]);
			continue;
		}
		if (!(key in (base as any))) {
			result[key] = cloneValue(override[key]);
			continue;
		}
		result[key] = mergeUiPolicy((base as any)[key], override[key]);
	}
	return result as T;
}

export function normalizeUiPolicy(policy?: Partial<UiPolicyConfig> | null): UiPolicyConfig {
	return mergeUiPolicy(getDefaultUiPolicy(), policy || {});
}

function isUiNodeType(type?: string | null): boolean {
	return type === "sprite" || type === "label" || type === "button";
}

function getPreset(policy: UiPolicyConfig, presetName?: string | null): UiPresetConfig | null {
	if (!presetName) {
		return null;
	}
	return policy.presets[presetName] || null;
}

export function resolveCreateNodePolicy(
	policyInput: Partial<UiPolicyConfig> | null | undefined,
	args: { type?: string | null; layout?: UiLayoutName | null; uiPreset?: string | null },
): ResolvedUiNodePolicy {
	const policy = normalizeUiPolicy(policyInput);
	const presetName = args.uiPreset || policy.createNode.defaultPresetsByType[args.type || ""] || null;
	const preset = resolveNamedUiPreset(policy, presetName);

	return {
		presetName,
		anchor: preset.anchor,
		layout: args.layout || preset.layout || null,
		safeArea: preset.safeArea,
		autoParentToCanvas: policy.createNode.autoParentUiToCanvas && isUiNodeType(args.type),
	};
}

export function resolveNamedUiPreset(
	policyInput: Partial<UiPolicyConfig> | null | undefined,
	presetName?: string | null,
): ResolvedNamedUiPreset {
	const policy = normalizeUiPolicy(policyInput);
	const preset = getPreset(policy, presetName);

	return {
		presetName: preset ? presetName || null : null,
		anchor: preset?.anchor || null,
		layout: preset?.layout || null,
		safeArea: !!preset?.safeArea,
	};
}

function isScreenSizedRoot(
	nodeSize?: { width: number; height: number } | null,
	canvasDesignResolution?: { width: number; height: number } | null,
	tolerance = 0,
): boolean {
	if (!nodeSize || !canvasDesignResolution) {
		return false;
	}
	return (
		Math.abs(nodeSize.width - canvasDesignResolution.width) <= tolerance &&
		Math.abs(nodeSize.height - canvasDesignResolution.height) <= tolerance
	);
}

export function resolvePrefabRootPolicy(
	policyInput: Partial<UiPolicyConfig> | null | undefined,
	args: ResolvePrefabRootPolicyArgs,
): ResolvedPrefabRootPolicy {
	const policy = normalizeUiPolicy(policyInput);
	let presetName = args.rootPreset || null;
	let shouldApply = !!presetName;

	if (!presetName && policy.prefabRoot.autoDetectScreenRoot.enabled) {
		const fallbackCanvasSize = args.canvasDesignResolution || policy.canvas.designResolution;
		if (
			isScreenSizedRoot(
				args.nodeSize,
				fallbackCanvasSize,
				policy.prefabRoot.autoDetectScreenRoot.tolerance,
			)
		) {
			presetName = policy.prefabRoot.autoDetectScreenRoot.preset;
			shouldApply = !!presetName;
		}
	}

	const preset = getPreset(policy, presetName);

	return {
		shouldApply,
		presetName,
		anchor: preset?.anchor || null,
		layout: preset?.layout || null,
		safeArea: !!preset?.safeArea,
	};
}
