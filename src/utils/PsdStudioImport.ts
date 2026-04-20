import fs from "fs";
import path from "path";
import {
	analyzeDesignLayoutLogicReadiness,
	normalizeDesignLayoutDocument,
	type DesignLayoutLogicRule,
	type DesignLayoutLogicSpec,
	type NormalizedDesignLayoutDocument,
	type NormalizedDesignNode,
} from "./DesignJson";

export interface PsdStudioImportInput {
	psdPath: string;
	prefabDir?: string;
	imageAssetDir?: string;
	imageAssetDirs?: string[];
	rootPreset?: string | null;
	overwrite?: boolean;
	exportScreenshots?: boolean;
	includeImageData?: boolean;
}

export interface PsdStudioImportSpec {
	psdPath: string;
	prefabDir: string;
	imageAssetDirs: string[];
	rootPreset: string | null;
	overwrite: boolean;
	exportScreenshots: boolean;
	includeImageData: boolean;
}

export interface AutoDesignLogicOptions {
	prefabName?: string;
	imageAssetPaths?: string[];
	imageAssetMap?: Record<string, string>;
}

const MAX_NODE_NAME_LENGTH = 14;
const MAX_ROOT_NAME_LENGTH = 14;
const MAX_BINDING_STEM_LENGTH = 24;
const WEAK_SEMANTIC_STEM_PATTERN =
	/^(?:node|layer|value|group|container|image|icon|sprite|label|text|button|panel|item|field)\d*$/i;
const GENERIC_SEMANTIC_TOKENS = new Set([
	"node",
	"nodes",
	"layer",
	"layers",
	"value",
	"values",
	"group",
	"groups",
	"container",
	"containers",
	"image",
	"images",
	"img",
	"icon",
	"icons",
	"sprite",
	"sprites",
	"label",
	"labels",
	"lab",
	"text",
	"texts",
	"button",
	"buttons",
	"btn",
	"panel",
	"panels",
	"item",
	"items",
	"field",
	"fields",
	"content",
	"module",
]);

function trimSlashes(input: string): string {
	return String(input || "").replace(/[\\/]+$/, "");
}

function ensureDbPath(input: string | undefined, fallback: string): string {
	const normalized = trimSlashes(String(input || fallback || "").trim());
	return normalized || fallback;
}

function ensureDbPathList(inputs?: string[], fallbackSingle?: string): string[] {
	const source = Array.isArray(inputs) && inputs.length > 0 ? inputs : fallbackSingle ? [fallbackSingle] : [];
	return source
		.map((item) => ensureDbPath(item, "db://assets"))
		.filter((item, index, list) => !!item && list.indexOf(item) === index);
}

function normalizeAsciiToken(input: string): string {
	return String(input || "")
		.normalize("NFKD")
		.replace(/[^\x00-\x7F]+/g, " ")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.trim();
}

function toPascalCase(input: string): string {
	return normalizeAsciiToken(input)
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

function toCamelCase(input: string): string {
	const pascal = toPascalCase(input);
	if (!pascal) {
		return "";
	}
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function stripDesignNoise(input: string): string {
	return String(input || "")
		.replace(/[\s_-]*\d+\s*[xX×]\s*\d+/g, " ")
		.replace(/layer[_ -]?\d+/gi, " ")
		.replace(/\b(?:container|sprite|label|text|image|img|txt|grp|ctn|spr|lab|lbl|node|icon)\b/gi, " ")
		.replace(/[（(][^）)]*[）)]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function extractIdNumber(input: string): string {
	const matched = String(input || "").match(/(\d+)/g);
	return matched && matched.length > 0 ? matched[matched.length - 1] : "";
}

function splitIdentifierWords(input: string): string[] {
	const expanded = String(input || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
	return normalizeAsciiToken(expanded)
		.split(/\s+/)
		.filter(Boolean);
}

function extractSemanticWords(input: string, options?: { allowGeneric?: boolean }): string[] {
	const allowGeneric = !!options?.allowGeneric;
	return splitIdentifierWords(stripDesignNoise(input))
		.map((word) => word.toLowerCase())
		.filter((word) => /[a-z]/.test(word))
		.filter((word) => allowGeneric || !GENERIC_SEMANTIC_TOKENS.has(word));
}

function toPascalFromWords(words: string[]): string {
	return words
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

function isWeakSemanticStem(stem: string): boolean {
	const normalized = String(stem || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
	if (!normalized) {
		return true;
	}
	return WEAK_SEMANTIC_STEM_PATTERN.test(normalized);
}

function deriveSemanticStem(input: string, options?: { allowGeneric?: boolean }): string {
	const words = extractSemanticWords(input, options);
	return toPascalFromWords(words);
}

function deriveRootStem(prefabName: string | undefined): string {
	const stem = deriveSemanticStem(String(prefabName || ""), { allowGeneric: true });
	return stem || "PsdPage";
}

function trimToLength(input: string, maxLength: number): string {
	const value = String(input || "");
	if (!value) {
		return value;
	}
	return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function ensureIdentifierStart(input: string, fallback: string): string {
	const value = String(input || "").replace(/[^A-Za-z0-9]/g, "");
	if (!value) {
		return fallback;
	}
	if (/^[A-Za-z]/.test(value)) {
		return value;
	}
	return `n${value}`;
}

function deriveSiblingSemanticStem(
	node: NormalizedDesignNode,
	parentNode?: NormalizedDesignNode | null,
): string {
	if (!parentNode || !Array.isArray(parentNode.children)) {
		return "";
	}
	for (const sibling of parentNode.children) {
		if (!sibling || sibling.id === node.id) {
			continue;
		}
		const textStem =
			sibling.text && sibling.text.content
				? deriveSemanticStem(sibling.text.content)
				: "";
		if (textStem && !isWeakSemanticStem(textStem)) {
			return textStem;
		}
		const nameStem = deriveSemanticStem(sibling.name);
		if (nameStem && !isWeakSemanticStem(nameStem)) {
			return nameStem;
		}
		const visualStem =
			sibling.visual && sibling.visual.assetPath
				? deriveSemanticStem(path.basename(String(sibling.visual.assetPath), path.extname(String(sibling.visual.assetPath))))
				: "";
		if (visualStem && !isWeakSemanticStem(visualStem)) {
			return visualStem;
		}
	}
	return "";
}

function deriveNodeStem(
	node: NormalizedDesignNode,
	options?: {
		groupHint?: string;
		parentNode?: NormalizedDesignNode | null;
	},
): string {
	const textContentStem =
		node.text && node.text.content
			? deriveSemanticStem(node.text.content)
			: "";
	if (node.nodeType === "text" && textContentStem && !isWeakSemanticStem(textContentStem)) {
		return textContentStem;
	}

	const visualStem =
		node.visual && node.visual.assetPath
			? deriveSemanticStem(path.basename(String(node.visual.assetPath), path.extname(String(node.visual.assetPath))))
			: "";
	if (visualStem && !isWeakSemanticStem(visualStem)) {
		return visualStem;
	}

	const nameStem = deriveSemanticStem(node.name);
	if (nameStem && !isWeakSemanticStem(nameStem)) {
		return nameStem;
	}

	const childTextStem = (node.children || [])
		.filter((child) => child && child.text && child.text.content)
		.map((child) => deriveSemanticStem(child.text && child.text.content))
		.find((value) => !!value && !isWeakSemanticStem(value));
	if (childTextStem) {
		return childTextStem;
	}

	const siblingStem = deriveSiblingSemanticStem(node, options?.parentNode);
	if (siblingStem) {
		if (node.isButton) {
			return `${siblingStem}Action`;
		}
		if (node.nodeType === "text") {
			return `${siblingStem}Value`;
		}
		if (node.nodeType === "image") {
			return `${siblingStem}Icon`;
		}
		return `${siblingStem}Group`;
	}

	const groupStem = deriveSemanticStem(String(options?.groupHint || ""), { allowGeneric: true });
	if (groupStem && !isWeakSemanticStem(groupStem)) {
		if (node.isButton) {
			return `${groupStem}Action`;
		}
		if (node.nodeType === "text") {
			return `${groupStem}Value`;
		}
		if (node.nodeType === "image") {
			return `${groupStem}Icon`;
		}
		return `${groupStem}Group`;
	}

	const layerNumber = extractIdNumber(node.id);
	const shortSuffix = layerNumber && layerNumber.length <= 2 ? layerNumber : "";
	if (node.isButton) {
		return `ActionButton${shortSuffix}`;
	}
	if (node.nodeType === "text") {
		return `MetricValue${shortSuffix}`;
	}
	if (node.nodeType === "image") {
		return `FeatureIcon${shortSuffix}`;
	}
	return `ContentGroup${shortSuffix}`;
}

function getNodePrefix(node: NormalizedDesignNode): string {
	if (node.isButton) {
		return "btn";
	}
	switch (node.nodeType) {
		case "image":
			return "img";
		case "text":
			return "lab";
		default:
			return "grp";
	}
}

function buildNodeName(prefix: string, stem: string, maxLength = MAX_NODE_NAME_LENGTH): string {
	const safePrefix = String(prefix || "").toLowerCase() || "grp";
	let safeStem = deriveSemanticStem(stem, { allowGeneric: true }) || toPascalCase(stripDesignNoise(stem)) || "Node";
	if (isWeakSemanticStem(safeStem)) {
		safeStem = safePrefix === "lab" ? "Metric" : safePrefix === "img" ? "Visual" : safePrefix === "btn" ? "Action" : "Section";
	}
	const stemRoom = Math.max(1, maxLength - safePrefix.length);
	return `${safePrefix}${safeStem.slice(0, stemRoom)}`;
}

function isWorkflowCompliantNodeName(node: NormalizedDesignNode): boolean {
	const expectedPrefix = getNodePrefix(node);
	const rawName = String(node.name || "").trim();
	if (!rawName || rawName.length > MAX_NODE_NAME_LENGTH) {
		return false;
	}
	if (!rawName.toLowerCase().startsWith(expectedPrefix)) {
		return false;
	}
	const stem = rawName.slice(expectedPrefix.length);
	if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(stem)) {
		return false;
	}
	return !isWeakSemanticStem(stem);
}

function allocateUniqueName(baseName: string, usedNames: Set<string>, maxLength = MAX_NODE_NAME_LENGTH): string {
	let candidate = trimToLength(String(baseName || ""), maxLength);
	if (!candidate) {
		candidate = "grpNode";
	}
	let suffix = 2;
	while (usedNames.has(candidate.toLowerCase())) {
		const suffixText = String(suffix);
		const bodyRoom = Math.max(1, maxLength - suffixText.length);
		candidate = `${trimToLength(String(baseName || "grpNode"), bodyRoom)}${suffixText}`;
		suffix += 1;
	}
	usedNames.add(candidate.toLowerCase());
	return candidate;
}

function allocateUniqueIdentifier(baseName: string, usedNames: Set<string>, fallback = "field"): string {
	const normalized = ensureIdentifierStart(baseName, fallback);
	let candidate = normalized;
	let suffix = 2;
	while (usedNames.has(candidate.toLowerCase())) {
		candidate = `${normalized}${suffix}`;
		suffix += 1;
	}
	usedNames.add(candidate.toLowerCase());
	return candidate;
}

function deriveBindingStem(node: NormalizedDesignNode, stem: string): string {
	const fallback = node.nodeType === "text" ? "textValue" : node.nodeType === "image" ? "imageNode" : "groupNode";
	const raw = toCamelCase(stripDesignNoise(stem));
	const withStart = ensureIdentifierStart(raw, fallback);
	return trimToLength(withStart, MAX_BINDING_STEM_LENGTH);
}

function buildPropertyName(node: NormalizedDesignNode, bindingStem: string): string {
	const stem = ensureIdentifierStart(bindingStem, "field");
	if (node.isButton) {
		return `${stem}Button`;
	}
	switch (node.nodeType) {
		case "image":
			return `${stem}Sprite`;
		case "text":
			return `${stem}Label`;
		default:
			return `${stem}Group`;
	}
}

function shouldCreateRuleForNode(layout: NormalizedDesignLayoutDocument, node: NormalizedDesignNode): boolean {
	if (!isWorkflowCompliantNodeName(node)) {
		return true;
	}
	const readiness = analyzeDesignLayoutLogicReadiness({
		root: {
			...node,
			children: [],
		},
		assetTasks: layout.assetTasks,
	});
	return readiness.requiresExplicitLogic;
}

function collectAutoLogicRules(
	layout: NormalizedDesignLayoutDocument,
	node: NormalizedDesignNode,
	usedNames: Set<string>,
	usedPropertyNames: Set<string>,
	usedDataKeys: Set<string>,
	usedHandlerNames: Set<string>,
	rules: DesignLayoutLogicRule[],
	groupHint?: string,
	parentNode?: NormalizedDesignNode | null,
) {
	const stem = deriveNodeStem(node, {
		groupHint,
		parentNode,
	});
	const nextGroup =
		node.nodeType === "container"
			? ensureIdentifierStart(trimToLength(toCamelCase(stripDesignNoise(stem)), 18), groupHint || "section")
			: groupHint;

	if (shouldCreateRuleForNode(layout, node)) {
		const semanticName = allocateUniqueName(buildNodeName(getNodePrefix(node), stem), usedNames);
		const bindingStem = deriveBindingStem(node, stem);
		const propertyName = allocateUniqueIdentifier(buildPropertyName(node, bindingStem), usedPropertyNames, "nodeField");
		const dataKey =
			!node.isButton && (node.nodeType === "text" || node.nodeType === "image")
				? allocateUniqueIdentifier(bindingStem, usedDataKeys, "value")
				: undefined;
		const handlerName = node.isButton
			? allocateUniqueIdentifier(`on${toPascalCase(bindingStem)}Tap`, usedHandlerNames, "onTap")
			: undefined;
		const rule: DesignLayoutLogicRule = {
			matchId: node.id,
			name: semanticName,
			propertyName,
			...(dataKey ? { dataKey } : {}),
			...(nextGroup ? { group: nextGroup } : {}),
			...(handlerName ? { handlerName } : {}),
		};
		rules.push(rule);
	}

	(node.children || []).forEach((child) =>
		collectAutoLogicRules(
			layout,
			child,
			usedNames,
			usedPropertyNames,
			usedDataKeys,
			usedHandlerNames,
			rules,
			nextGroup,
			node,
		),
	);
}

export function normalizePsdStudioImportArgs(
	input: PsdStudioImportInput,
	options: { projectRoot: string },
): PsdStudioImportSpec {
	if (!input || !String(input.psdPath || "").trim()) {
		throw new Error("psdPath 为必填项");
	}
	if (!options || !String(options.projectRoot || "").trim()) {
		throw new Error("projectRoot 为必填项");
	}

	const rawPsdPath = String(input.psdPath).trim();
	const psdPath = path.isAbsolute(rawPsdPath)
		? rawPsdPath
		: path.resolve(String(options.projectRoot), rawPsdPath);

	return {
		psdPath,
		prefabDir: ensureDbPath(input.prefabDir, "db://assets/prefabs/design-import"),
		imageAssetDirs: ensureDbPathList(input.imageAssetDirs, input.imageAssetDir),
		rootPreset: input.rootPreset ? String(input.rootPreset).trim() : null,
		overwrite: !!input.overwrite,
		exportScreenshots: input.exportScreenshots !== false,
		includeImageData: !!input.includeImageData,
	};
}

export function derivePsdExportDir(psdFilePath: string): string {
	const parsed = path.parse(String(psdFilePath || ""));
	return path.join(parsed.dir, parsed.name);
}

export function collectGeneratedJsonFiles(exportDir: string): string[] {
	if (!exportDir || !fs.existsSync(exportDir) || !fs.statSync(exportDir).isDirectory()) {
		return [];
	}
	return fs
		.readdirSync(exportDir)
		.filter((entry) => entry.toLowerCase().endsWith(".json"))
		.map((entry) => path.join(exportDir, entry))
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}

export function collectPsdFiles(targetPath: string): string[] {
	if (!targetPath || !fs.existsSync(targetPath)) {
		return [];
	}
	const stat = fs.statSync(targetPath);
	if (stat.isFile()) {
		return /\.psd$/i.test(targetPath) ? [targetPath] : [];
	}
	if (!stat.isDirectory()) {
		return [];
	}
	return fs
		.readdirSync(targetPath)
		.map((entry) => path.join(targetPath, entry))
		.filter((entry) => fs.existsSync(entry) && fs.statSync(entry).isFile() && /\.psd$/i.test(entry))
		.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}

export function derivePrefabNameFromJson(
	jsonPath: string,
	options?: {
		usedNames?: Set<string>;
		fallbackIndex?: number;
	},
): string {
	const usedNames = options?.usedNames || new Set<string>();
	const fallbackIndex = Number(options?.fallbackIndex || 1);
	const parsed = path.parse(String(jsonPath || ""));
	const withoutLayerSuffix = parsed.name.replace(/[-_]?layer[_-]?\d+$/i, "");
	const stem = toPascalCase(stripDesignNoise(withoutLayerSuffix)) || `PsdPage${fallbackIndex}`;
	return allocateUniqueName(stem, usedNames);
}

export function buildAutoDesignLogic(
	document: any,
	options?: AutoDesignLogicOptions,
): DesignLayoutLogicSpec {
	const prefabStem = deriveRootStem(options?.prefabName);
	const layout = normalizeDesignLayoutDocument(document, {
		assetOutputDir: `db://assets/textures/design-import/${prefabStem}`,
		imageAssetPaths: Array.isArray(options?.imageAssetPaths) ? options?.imageAssetPaths : [],
		imageAssetMap: options?.imageAssetMap || {},
	});
	const rules: DesignLayoutLogicRule[] = [];
	const usedNodeNames = new Set<string>();
	const usedPropertyNames = new Set<string>();
	const usedDataKeys = new Set<string>();
	const usedHandlerNames = new Set<string>();

	(layout.root.children || []).forEach((child) =>
		collectAutoLogicRules(
			layout,
			child,
			usedNodeNames,
			usedPropertyNames,
			usedDataKeys,
			usedHandlerNames,
			rules,
		),
	);

	return {
		rootName: allocateUniqueName(buildNodeName("pan", prefabStem, MAX_ROOT_NAME_LENGTH), new Set<string>(), MAX_ROOT_NAME_LENGTH),
		dataInterfaceName: `${trimToLength(prefabStem, 20)}ViewData`,
		rules,
	};
}
