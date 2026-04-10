export type NineSliceBorder = [number, number, number, number];

export interface AutoNineSliceRule {
	pattern: string;
	border: NineSliceBorder;
	matchMode?: "contains" | "exact";
	description?: string;
}

export interface AutoNineSliceStateEntry {
	signature: string;
	updatedAt: string;
}

export interface AutoNineSliceState {
	processed: Record<string, AutoNineSliceStateEntry>;
}

export interface AutoNineSlicePolicy {
	enabled: boolean;
	triggerOnSpriteAssignment: boolean;
	rules: AutoNineSliceRule[];
	state: AutoNineSliceState;
}

const DEFAULT_AUTO_NINE_SLICE_POLICY: AutoNineSlicePolicy = {
	enabled: false,
	triggerOnSpriteAssignment: true,
	rules: [],
	state: {
		processed: {},
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

function mergeValue<T>(base: T, override: any): T {
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
		result[key] = mergeValue((base as any)[key], override[key]);
	}
	return result as T;
}

function isBorderValueValid(border: unknown): border is NineSliceBorder {
	return (
		Array.isArray(border) &&
		border.length === 4 &&
		border.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)
	);
}

export function getDefaultAutoNineSlicePolicy(): AutoNineSlicePolicy {
	return cloneValue(DEFAULT_AUTO_NINE_SLICE_POLICY);
}

export function normalizeAutoNineSlicePolicy(policyInput?: any): AutoNineSlicePolicy {
	const rawPolicy = policyInput && policyInput.autoNineSlice ? policyInput.autoNineSlice : policyInput;
	const merged = mergeValue(getDefaultAutoNineSlicePolicy(), rawPolicy || {});
	const normalizedRules = (merged.rules || []).filter(
		(rule: AutoNineSliceRule) => rule && rule.pattern && isBorderValueValid(rule.border),
	);
	return {
		enabled: !!merged.enabled,
		triggerOnSpriteAssignment: merged.triggerOnSpriteAssignment !== false,
		rules: normalizedRules.map((rule: AutoNineSliceRule) => ({
			pattern: rule.pattern,
			border: cloneValue(rule.border),
			matchMode: rule.matchMode === "exact" ? "exact" : "contains",
			description: rule.description,
		})),
		state: {
			processed: cloneValue((merged.state && merged.state.processed) || {}),
		},
	};
}

export function getAutoNineSliceRuleSignature(rule: Pick<AutoNineSliceRule, "pattern" | "border">): string {
	return `${rule.pattern}|${rule.border.join(",")}`;
}

export function resolveAutoNineSliceRule(
	policyInput: AutoNineSlicePolicy | { autoNineSlice?: AutoNineSlicePolicy } | null | undefined,
	textureName: string,
): AutoNineSliceRule | null {
	const policy = normalizeAutoNineSlicePolicy(policyInput);
	if (!policy.enabled || !textureName) {
		return null;
	}

	const normalizedName = textureName.toLowerCase();
	for (const rule of policy.rules) {
		const normalizedPattern = rule.pattern.toLowerCase();
		if (rule.matchMode === "exact") {
			if (normalizedName === normalizedPattern) {
				return cloneValue(rule);
			}
			continue;
		}
		if (normalizedName.includes(normalizedPattern)) {
			return cloneValue(rule);
		}
	}

	return null;
}

function isZeroBorder(border: NineSliceBorder): boolean {
	return border.every((value) => value === 0);
}

export function readConfiguredNineSliceBorder(subMeta?: Record<string, any> | null): NineSliceBorder | null {
	if (!subMeta || typeof subMeta !== "object") {
		return null;
	}

	if (isBorderValueValid(subMeta.border)) {
		return isZeroBorder(subMeta.border) ? null : cloneValue(subMeta.border);
	}

	const fieldValues = [
		subMeta.borderTop,
		subMeta.borderBottom,
		subMeta.borderLeft,
		subMeta.borderRight,
	];
	if (fieldValues.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
		const border = fieldValues as NineSliceBorder;
		return isZeroBorder(border) ? null : cloneValue(border);
	}

	return null;
}

export function resolvePreferredSpriteSizeMode(
	policyInput: AutoNineSlicePolicy | { autoNineSlice?: AutoNineSlicePolicy } | null | undefined,
	textureName: string,
	subMeta?: Record<string, any> | null,
): "RAW" | "CUSTOM" {
	if (readConfiguredNineSliceBorder(subMeta)) {
		return "CUSTOM";
	}
	if (resolveAutoNineSliceRule(policyInput, textureName)) {
		return "CUSTOM";
	}
	return "RAW";
}

export function hasProcessedAutoNineSliceMarker(
	stateInput: AutoNineSliceState | null | undefined,
	assetKey: string,
	rule: Pick<AutoNineSliceRule, "pattern" | "border">,
): boolean {
	if (!stateInput || !assetKey) {
		return false;
	}
	const entry = stateInput.processed && stateInput.processed[assetKey];
	if (!entry) {
		return false;
	}
	return entry.signature === getAutoNineSliceRuleSignature(rule);
}

export function markAutoNineSliceProcessed(
	stateInput: AutoNineSliceState | null | undefined,
	assetKey: string,
	rule: Pick<AutoNineSliceRule, "pattern" | "border">,
	now = new Date().toISOString(),
): AutoNineSliceState {
	const nextState = cloneValue(stateInput || { processed: {} });
	if (!nextState.processed) {
		nextState.processed = {};
	}
	nextState.processed[assetKey] = {
		signature: getAutoNineSliceRuleSignature(rule),
		updatedAt: now,
	};
	return nextState;
}
