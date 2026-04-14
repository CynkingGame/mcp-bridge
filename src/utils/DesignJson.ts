import path from "path";
import { isAutoNineSliceTextureName } from "./AutoNineSlice";
import { isNodeNameDerivedFromDisplayCopy } from "./NodeNaming";

export interface DesignImportInput {
	jsonPath: string;
	prefabName?: string;
	prefabDir?: string;
	assetOutputDir?: string;
	imageAssetDir?: string;
	imageAssetDirs?: string[];
	imageAssetMap?: Record<string, string>;
	rootPreset?: string | null;
	importGeneratedShapes?: boolean;
	strictImageAssets?: boolean;
	overwrite?: boolean;
	logic?: DesignLayoutLogicSpec;
}

export interface DesignNodeBindingSpec {
	propertyName?: string;
	dataKey?: string;
	group?: string;
	handlerName?: string;
}

export interface DesignLayoutLogicRule {
	matchId?: string;
	matchName?: string;
	name?: string;
	path?: string;
	propertyName?: string;
	dataKey?: string;
	group?: string;
	handlerName?: string;
}

export interface DesignLayoutLogicSpec {
	rootName?: string;
	dataInterfaceName?: string;
	rules?: DesignLayoutLogicRule[];
}

export interface DesignImportSpec {
	jsonPath: string;
	prefabName: string;
	prefabDir: string;
	prefabPath: string;
	assetOutputDir: string;
	imageAssetDirs: string[];
	imageAssetMap: Record<string, string>;
	rootPreset: string | null;
	importGeneratedShapes: boolean;
	strictImageAssets: boolean;
	overwrite: boolean;
	logic: DesignLayoutLogicSpec | null;
}

export interface NormalizedDesignTextSpec {
	content: string;
	fontFamily: string;
	fontUuid?: string | null;
	fontSize: number;
	lineHeight: number;
	horizontalAlign: "LEFT" | "CENTER" | "RIGHT";
	color: { r: number; g: number; b: number; a: number };
	outline: null | {
		width: number;
		color: { r: number; g: number; b: number; a: number };
	};
	shadow: null | {
		offsetX: number;
		offsetY: number;
		blur: number;
		color: { r: number; g: number; b: number; a: number };
	};
}

export interface NormalizedDesignVisualSpec {
	assetPath: string;
	preferredSizeMode: "RAW" | "CUSTOM";
	useSliced: boolean;
	source: "explicit-map" | "asset-dir";
}

export interface NormalizedDesignNode {
	id: string;
	name: string;
	nodeType: "container" | "image" | "text";
	position: { x: number; y: number };
	size: { width: number; height: number };
	opacity: number;
	rotation: number;
	visible: boolean;
	isButton: boolean;
	text: NormalizedDesignTextSpec | null;
	visual: NormalizedDesignVisualSpec | null;
	binding?: DesignNodeBindingSpec | null;
	children: NormalizedDesignNode[];
}

export interface DesignAssetTask {
	nodeId: string;
	path: string;
	kind: "generated-shape";
	content: Buffer;
	useSliced: boolean;
	preferredSizeMode: "RAW" | "CUSTOM";
}

export interface NormalizedDesignLayoutDocument {
	root: NormalizedDesignNode;
	assetTasks: DesignAssetTask[];
}

export interface DesignLayoutAnalysisNode {
	id: string;
	name: string;
	nodeType: "container" | "image" | "text";
	size: { width: number; height: number };
	assetPath?: string | null;
	source?: "explicit-map" | "asset-dir" | "missing";
	useSliced?: boolean;
	preferredSizeMode?: "RAW" | "CUSTOM";
}

export interface DesignLayoutAnalysis {
	summary: {
		totalNodes: number;
		imageNodes: number;
		textNodes: number;
		containerNodes: number;
		buttonLikeNodes: number;
		resolvedImageNodes: number;
		missingImageNodes: number;
		generatedShapeNodes: number;
	};
	resolvedImageNodes: DesignLayoutAnalysisNode[];
	missingImageNodes: DesignLayoutAnalysisNode[];
	generatedShapeNodes: DesignLayoutAnalysisNode[];
}

export interface DesignLayoutLogicIssue {
	id: string;
	name: string;
	nodeType: "container" | "image" | "text";
	reason:
		| "non-ascii-name"
		| "size-suffixed-name"
		| "layer-style-name"
		| "placeholder-generic-name"
		| "text-content-name";
}

export interface DesignLayoutLogicReadiness {
	requiresExplicitLogic: boolean;
	issues: DesignLayoutLogicIssue[];
}

interface RectLike {
	x: number;
	y: number;
	width: number;
	height: number;
}

function trimSlashes(input: string): string {
	return String(input || "").replace(/[\\/]+$/, "");
}

function ensureDbPath(input: string, fallback: string): string {
	const value = trimSlashes(input || fallback || "db://assets");
	return value || fallback;
}

function ensureDbPathList(inputs: string[] | undefined, fallbackSingle?: string): string[] {
	const source = Array.isArray(inputs) ? inputs : fallbackSingle ? [fallbackSingle] : [];
	return source.map((item) => ensureDbPath(item, "db://assets")).filter(Boolean);
}

function roundNumber(value: number): number {
	return Math.round((Number(value) || 0) * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function sanitizeStem(input: string): string {
	const cleaned = String(input || "")
		.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
		.replace(/\s+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");
	return cleaned || "asset";
}

function splitLogicPath(input: string | undefined): string[] {
	return String(input || "")
		.split("/")
		.map((item) => String(item || "").trim())
		.filter(Boolean);
}

function toPascalCase(input: string): string {
	return String(input || "")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

function trimBindingStemSuffix(input: string): string {
	return String(input || "").replace(/(?:Button|Label|Sprite|RichText|ScrollView|EditBox|Toggle|Group|Container)$/i, "");
}

function deriveSemanticNodeName(
	node: NormalizedDesignNode,
	rule: Pick<DesignLayoutLogicRule, "propertyName" | "dataKey">,
): string | undefined {
	const hint = String(rule.propertyName || rule.dataKey || "").trim();
	if (!hint) {
		return undefined;
	}
	const stem = toPascalCase(trimBindingStemSuffix(hint));
	if (!stem) {
		return undefined;
	}
	const prefix = node.isButton
		? "btn"
		: node.nodeType === "image"
			? "img"
			: node.nodeType === "text"
				? "lab"
				: "grp";
	return `${prefix}${stem}`;
}

function shouldUseDerivedSemanticName(
	node: NormalizedDesignNode,
	rule: DesignLayoutLogicRule,
	derivedName: string | undefined,
): boolean {
	if (!derivedName) {
		return false;
	}
	const explicitName = String(rule.name || "").trim();
	if (!explicitName) {
		return true;
	}
	const expectedPrefix = node.isButton
		? "btn"
		: node.nodeType === "image"
			? "img"
			: node.nodeType === "text"
				? "lab"
				: "grp";
	return !explicitName.toLowerCase().startsWith(expectedPrefix);
}

function normalizeLogicRule(rule: DesignLayoutLogicRule | null | undefined): DesignLayoutLogicRule | null {
	if (!rule) {
		return null;
	}
	const matchId = String(rule.matchId || "").trim() || undefined;
	const matchName = String(rule.matchName || "").trim() || undefined;
	if (!matchId && !matchName) {
		return null;
	}
	const name = String(rule.name || "").trim() || undefined;
	const path = splitLogicPath(rule.path).join("/") || undefined;
	const propertyName = String(rule.propertyName || "").trim() || undefined;
	const dataKey = String(rule.dataKey || "").trim() || undefined;
	const group = String(rule.group || "").trim() || undefined;
	const handlerName = String(rule.handlerName || "").trim() || undefined;
	return {
		matchId,
		matchName,
		name,
		path,
		propertyName,
		dataKey,
		group,
		handlerName,
	};
}

function normalizeLogicSpec(input: DesignLayoutLogicSpec | null | undefined): DesignLayoutLogicSpec | null {
	if (!input) {
		return null;
	}
	const rootName = String(input.rootName || "").trim() || undefined;
	const dataInterfaceName = String(input.dataInterfaceName || "").trim() || undefined;
	const rules = (Array.isArray(input.rules) ? input.rules : [])
		.map((rule) => normalizeLogicRule(rule))
		.filter((rule): rule is DesignLayoutLogicRule => !!rule);
	if (!rootName && !dataInterfaceName && rules.length === 0) {
		return null;
	}
	return {
		rootName,
		dataInterfaceName,
		rules,
	};
}

function normalizeColor(input: any, fallbackAlpha = 1) {
	if (!input) {
		return null;
	}
	return {
		r: clamp(Math.round(Number(input.r) || 0), 0, 255),
		g: clamp(Math.round(Number(input.g) || 0), 0, 255),
		b: clamp(Math.round(Number(input.b) || 0), 0, 255),
		a: clamp(Math.round((input.a === undefined ? fallbackAlpha : Number(input.a)) * 255), 0, 255),
	};
}

function mapHorizontalAlign(value: string): "LEFT" | "CENTER" | "RIGHT" {
	const normalized = String(value || "").toLowerCase();
	if (normalized === "right") {
		return "RIGHT";
	}
	if (normalized === "center") {
		return "CENTER";
	}
	return "LEFT";
}

function looksLikeButtonToken(input: string): boolean {
	return /(btn|button|按钮)/i.test(String(input || ""));
}

function bindingLooksButtonLike(binding?: Pick<DesignNodeBindingSpec, "propertyName" | "handlerName"> | null): boolean {
	if (!binding) {
		return false;
	}
	if (String(binding.handlerName || "").trim()) {
		return true;
	}
	return /button$/i.test(String(binding.propertyName || "").trim());
}

function looksLikeButton(
	name: string,
	assetPath?: string | null,
	binding?: Pick<DesignNodeBindingSpec, "propertyName" | "handlerName"> | null,
): boolean {
	if (bindingLooksButtonLike(binding)) {
		return true;
	}
	if (looksLikeButtonToken(name)) {
		return true;
	}
	if (assetPath) {
		const assetBaseName = path.basename(String(assetPath), path.extname(String(assetPath)));
		return looksLikeButtonToken(assetBaseName);
	}
	return false;
}

function normalizeFrame(frame: any): RectLike {
	return {
		x: Number(frame?.x) || 0,
		y: Number(frame?.y) || 0,
		width: Math.max(0, Number(frame?.width) || 0),
		height: Math.max(0, Number(frame?.height) || 0),
	};
}

function computeEffectiveFrame(node: any): RectLike {
	const rawFrame = normalizeFrame(node?.frame);
	const children = Array.isArray(node?.children) ? node.children : [];
	if (rawFrame.width > 0 && rawFrame.height > 0) {
		return rawFrame;
	}
	if (children.length === 0) {
		return rawFrame;
	}

	const childFrames = children.map((child) => computeEffectiveFrame(child));
	const minX = Math.min(...childFrames.map((frame) => frame.x));
	const minY = Math.min(...childFrames.map((frame) => frame.y));
	const maxX = Math.max(...childFrames.map((frame) => frame.x + frame.width));
	const maxY = Math.max(...childFrames.map((frame) => frame.y + frame.height));
	return {
		x: minX,
		y: minY,
		width: Math.max(0, maxX - minX),
		height: Math.max(0, maxY - minY),
	};
}

function buildTextSpec(node: any): NormalizedDesignTextSpec | null {
	const text = node?.text;
	const font = text?.font;
	if (!text || !font) {
		return null;
	}
	const fontSize = Math.max(1, Math.round(Number(font.size) || 24));
	const rawLineHeight = Math.round(Number(font.lineHeight) || fontSize);
	const stroke = font.stroke || null;
	const shadow = font.textShadow || null;
	return {
		content: String(text.content || ""),
		fontFamily: String(font.family || "Arial"),
		fontSize,
		lineHeight: Math.max(fontSize, rawLineHeight),
		horizontalAlign: mapHorizontalAlign(font.align),
		color: normalizeColor(font.color, 1) || { r: 255, g: 255, b: 255, a: 255 },
		outline: stroke
			? {
				width: Math.max(1, Math.round(Number(stroke.width) || 1)),
				color: normalizeColor(stroke.color, 1) || { r: 0, g: 0, b: 0, a: 255 },
			}
			: null,
		shadow: shadow
			? {
				offsetX: Math.round(Number(shadow.offsetX) || 0),
				offsetY: Math.round(Number(shadow.offsetY) || 0),
				blur: Math.max(0, Math.round(Number(shadow.blur) || 0)),
				color: normalizeColor(shadow.color, 1) || { r: 0, g: 0, b: 0, a: 255 },
			}
			: null,
	};
}

function assetPathLooksNineSlice(assetPath: string | null | undefined): boolean {
	if (!assetPath) {
		return false;
	}
	return isAutoNineSliceTextureName(path.basename(String(assetPath)));
}

function shouldUseSliced(node: any, resolvedAssetPath?: string | null): boolean {
	return /点9/.test(String(node?.name || "")) || assetPathLooksNineSlice(resolvedAssetPath);
}

function stripNodeSizeSuffix(input: string): string {
	return String(input || "").replace(/[\s_-]*\d+\s*[xX×]\s*\d+$/g, "").trim();
}

function stripBracketedSegments(input: string): string {
	return String(input || "").replace(/[（(][^）)]*[）)]/g, "");
}

function stripGenericAssetPrefixes(input: string): string {
	return String(input || "").replace(/^(?:社交图标|图标|按钮)[\s_-]*/i, "");
}

function canonicalizeAssetAlias(input: string): string {
	const normalized = String(input || "").toLowerCase();
	const aliases: Record<string, string> = {
		fb: "facebook",
		facebook: "facebook",
		ins: "instagram",
		instagram: "instagram",
		tg: "telegram",
		telegram: "telegram",
		whatapp: "whatsapp",
		whatsapp: "whatsapp",
	};
	return aliases[normalized] || normalized;
}

function normalizeAssetKey(input: string): string {
	const stem = sanitizeStem(stripNodeSizeSuffix(input))
		.replace(/[（）()]/g, "")
		.replace(/[_-]+/g, "")
		.toLowerCase();
	return canonicalizeAssetAlias(stem);
}

function buildAssetLookupKeys(input: string): string[] {
	const value = String(input || "").trim();
	if (!value) {
		return [];
	}
	const candidates = [
		value,
		stripNodeSizeSuffix(value),
		stripBracketedSegments(value),
		stripBracketedSegments(stripNodeSizeSuffix(value)),
		stripGenericAssetPrefixes(value),
		stripGenericAssetPrefixes(stripNodeSizeSuffix(value)),
		stripGenericAssetPrefixes(stripBracketedSegments(value)),
		stripGenericAssetPrefixes(stripBracketedSegments(stripNodeSizeSuffix(value))),
	];
	return Array.from(new Set(candidates.map((item) => normalizeAssetKey(item)).filter(Boolean)));
}

function buildImageAssetLookup(paths: string[]): Map<string, string> {
	const lookup = new Map<string, string>();
	(paths || []).forEach((assetPath) => {
		const ext = path.extname(assetPath || "");
		const base = path.basename(assetPath || "", ext);
		const keys = buildAssetLookupKeys(base);
		keys.forEach((key) => {
			if (!lookup.has(key)) {
				lookup.set(key, assetPath);
			}
		});
	});
	return lookup;
}

function resolveProvidedImageAsset(node: any, imageAssetLookup: Map<string, string>): string | null {
	if (!imageAssetLookup || imageAssetLookup.size === 0) {
		return null;
	}
	const candidates = Array.from(
		new Set(
			[
		node?.name,
		node?.assetsRef?.imagePath ? path.basename(String(node.assetsRef.imagePath), path.extname(String(node.assetsRef.imagePath))) : "",
			].flatMap((item) => buildAssetLookupKeys(String(item || ""))),
		),
	);
	for (const candidate of candidates) {
		if (imageAssetLookup.has(candidate)) {
			return imageAssetLookup.get(candidate) || null;
		}
	}
	return null;
}

function resolveMappedImageAsset(node: any, imageAssetMap: Record<string, string> | undefined): string | null {
	if (!imageAssetMap) {
		return null;
	}
	const byId = node?.id ? imageAssetMap[String(node.id)] : null;
	if (byId) {
		return byId;
	}
	const byName = node?.name ? imageAssetMap[String(node.name)] : null;
	return byName || null;
}

function createNodeVisual(
	node: any,
	options: {
		imageAssetLookup: Map<string, string>;
		imageAssetMap?: Record<string, string>;
	},
): NormalizedDesignVisualSpec | null {
	const mappedAssetPath = resolveMappedImageAsset(node, options.imageAssetMap);
	if (mappedAssetPath) {
		const sliced = shouldUseSliced(node, mappedAssetPath);
		return {
			assetPath: mappedAssetPath,
			preferredSizeMode: sliced ? "CUSTOM" : "RAW",
			useSliced: sliced,
			source: "explicit-map",
		};
	}
	const providedAssetPath = resolveProvidedImageAsset(node, options.imageAssetLookup);
	if (providedAssetPath) {
		const sliced = shouldUseSliced(node, providedAssetPath);
		return {
			assetPath: providedAssetPath,
			preferredSizeMode: sliced ? "CUSTOM" : "RAW",
			useSliced: sliced,
			source: "asset-dir",
		};
	}
	return null;
}

function normalizeNodeTree(
	node: any,
	parentFrame: RectLike | null,
	options: {
		imageAssetLookup: Map<string, string>;
		imageAssetMap?: Record<string, string>;
	},
	tasks: DesignAssetTask[],
	seenPaths: Set<string>,
): NormalizedDesignNode {
	const effectiveFrame = computeEffectiveFrame(node);
	const visual = createNodeVisual(node, options);
	const size = {
		width: Math.max(0, Math.round(effectiveFrame.width)),
		height: Math.max(0, Math.round(effectiveFrame.height)),
	};
	const style = node?.style || {};
	const position = parentFrame
		? {
			x: roundNumber(
				effectiveFrame.x - parentFrame.x + effectiveFrame.width / 2 - parentFrame.width / 2,
			),
			y: roundNumber(
				parentFrame.y - effectiveFrame.y - effectiveFrame.height / 2 + parentFrame.height / 2,
			),
		}
		: { x: 0, y: 0 };

	return {
		id: String(node?.id || ""),
		name: String(node?.name || "Node"),
		nodeType: node?.type === "text" ? "text" : node?.type === "image" ? "image" : "container",
		position,
		size,
		opacity: clamp(Math.round((Number(style.opacity) || 1) * 255), 0, 255),
		rotation: roundNumber(Number(style.rotation) || 0),
		visible: node?.visible !== false,
		isButton: looksLikeButton(node?.name, visual && visual.assetPath, null),
		text: buildTextSpec(node),
		visual,
		binding: null,
		children: (Array.isArray(node?.children) ? node.children : []).map((child) =>
			normalizeNodeTree(child, effectiveFrame, options, tasks, seenPaths),
		),
	};
}

function getNodeRect(node: Pick<NormalizedDesignNode, "position" | "size">) {
	const halfWidth = Math.max(0, Number(node.size?.width) || 0) / 2;
	const halfHeight = Math.max(0, Number(node.size?.height) || 0) / 2;
	const centerX = Number(node.position?.x) || 0;
	const centerY = Number(node.position?.y) || 0;
	return {
		left: centerX - halfWidth,
		right: centerX + halfWidth,
		top: centerY + halfHeight,
		bottom: centerY - halfHeight,
		width: halfWidth * 2,
		height: halfHeight * 2,
		centerX,
		centerY,
	};
}

function isTextInsideButton(textNode: NormalizedDesignNode, buttonNode: NormalizedDesignNode): boolean {
	if (!textNode?.text || !buttonNode?.isButton) {
		return false;
	}
	const textRect = getNodeRect(textNode);
	const buttonRect = getNodeRect(buttonNode);
	if (buttonRect.width <= 0 || buttonRect.height <= 0 || textRect.width <= 0 || textRect.height <= 0) {
		return false;
	}

	const centerInside =
		textRect.centerX >= buttonRect.left &&
		textRect.centerX <= buttonRect.right &&
		textRect.centerY >= buttonRect.bottom &&
		textRect.centerY <= buttonRect.top;

	const overlapWidth = Math.max(0, Math.min(textRect.right, buttonRect.right) - Math.max(textRect.left, buttonRect.left));
	const overlapHeight = Math.max(0, Math.min(textRect.top, buttonRect.top) - Math.max(textRect.bottom, buttonRect.bottom));
	const overlapArea = overlapWidth * overlapHeight;
	const textArea = textRect.width * textRect.height;

	return centerInside || (textArea > 0 && overlapArea / textArea >= 0.6);
}

function nestButtonLabelsIntoHierarchy(node: NormalizedDesignNode): NormalizedDesignNode {
	if (!node || !Array.isArray(node.children) || node.children.length === 0) {
		return node;
	}

	const buttonCandidates = node.children.filter((child) => child && child.isButton);
	const retainedChildren: NormalizedDesignNode[] = [];

	node.children.forEach((child) => {
		if (child && child.text && !child.isButton) {
			let targetButton: NormalizedDesignNode | null = null;
			let targetArea = Number.POSITIVE_INFINITY;
			buttonCandidates.forEach((candidate) => {
				if (!isTextInsideButton(child, candidate)) {
					return;
				}
				const candidateArea = (Number(candidate.size?.width) || 0) * (Number(candidate.size?.height) || 0);
				if (candidateArea < targetArea) {
					targetButton = candidate;
					targetArea = candidateArea;
				}
			});

			if (targetButton) {
				targetButton.children = [...(targetButton.children || []), {
					...child,
					position: {
						x: roundNumber((Number(child.position?.x) || 0) - (Number(targetButton.position?.x) || 0)),
						y: roundNumber((Number(child.position?.y) || 0) - (Number(targetButton.position?.y) || 0)),
					},
				}];
				return;
			}
		}
		retainedChildren.push(child);
	});

	node.children = retainedChildren.map((child) => nestButtonLabelsIntoHierarchy(child));
	return node;
}

export function normalizeDesignImportArgs(input: DesignImportInput): DesignImportSpec {
	if (!input || !input.jsonPath) {
		throw new Error("jsonPath 为必填项");
	}

	const jsonPath = String(input.jsonPath);
	const prefabName =
		String(input.prefabName || "").trim() || sanitizeStem(path.basename(jsonPath, path.extname(jsonPath)));
	const prefabDir = ensureDbPath(input.prefabDir, "db://assets/prefabs/design-import");
	const assetBaseDir = ensureDbPath(input.assetOutputDir, "db://assets/textures/design-import");
	const imageAssetDirs = ensureDbPathList(input.imageAssetDirs, input.imageAssetDir);

	return {
		jsonPath,
		prefabName,
		prefabDir,
		prefabPath: `${prefabDir}/${prefabName}.prefab`,
		assetOutputDir: `${assetBaseDir}/${prefabName}`,
		imageAssetDirs,
		imageAssetMap: input.imageAssetMap || {},
		rootPreset: input.rootPreset || null,
		importGeneratedShapes: false,
		strictImageAssets: true,
		overwrite: !!input.overwrite,
		logic: normalizeLogicSpec(input.logic),
	};
}

export function normalizeDesignLayoutDocument(
	document: any,
	options: {
		assetOutputDir: string;
		imageAssetPaths?: string[];
		imageAssetMap?: Record<string, string>;
		importGeneratedShapes?: boolean;
	},
): NormalizedDesignLayoutDocument {
	if (!document || !document.node) {
		throw new Error("设计 JSON 缺少 node 根节点");
	}

	const assetTasks: DesignAssetTask[] = [];
	const seenPaths = new Set<string>();
	const imageAssetLookup = buildImageAssetLookup(options?.imageAssetPaths || []);
	const root = normalizeNodeTree(
		document.node,
		null,
		{
			imageAssetLookup,
			imageAssetMap: options?.imageAssetMap || {},
		},
		assetTasks,
		seenPaths,
	);

	return {
		root: nestButtonLabelsIntoHierarchy(root),
		assetTasks,
	};
}

function cloneDesignNode(node: NormalizedDesignNode): NormalizedDesignNode {
	return {
		...node,
		position: { ...node.position },
		size: { ...node.size },
		text: node.text
			? {
				...node.text,
				color: { ...node.text.color },
				outline: node.text.outline
					? {
						...node.text.outline,
						color: { ...node.text.outline.color },
					}
					: null,
				shadow: node.text.shadow
					? {
						...node.text.shadow,
						color: { ...node.text.shadow.color },
					}
					: null,
			}
			: null,
		visual: node.visual ? { ...node.visual } : null,
		binding: node.binding ? { ...node.binding } : null,
		children: (node.children || []).map((child) => cloneDesignNode(child)),
	};
}

function createLogicalGroupNode(name: string, referenceNode: NormalizedDesignNode): NormalizedDesignNode {
	return {
		id: `logic:${name}`,
		name,
		nodeType: "container",
		position: { x: 0, y: 0 },
		size: { ...referenceNode.size },
		opacity: 255,
		rotation: 0,
		visible: true,
		isButton: false,
		text: null,
		visual: null,
		binding: null,
		children: [],
	};
}

function findRuleTarget(
	root: NormalizedDesignNode,
	rule: DesignLayoutLogicRule,
	parent: NormalizedDesignNode | null = null,
): { node: NormalizedDesignNode; parent: NormalizedDesignNode | null } | null {
	if (!root) {
		return null;
	}
	if ((rule.matchId && root.id === rule.matchId) || (rule.matchName && root.name === rule.matchName)) {
		return { node: root, parent };
	}
	for (const child of root.children || []) {
		const found = findRuleTarget(child, rule, root);
		if (found) {
			return found;
		}
	}
	return null;
}

function ensureLogicalPath(root: NormalizedDesignNode, pathSegments: string[]): NormalizedDesignNode {
	let current = root;
	pathSegments.forEach((segment) => {
		let next = (current.children || []).find(
			(child) => child.nodeType === "container" && child.name === segment,
		);
		if (!next) {
			next = createLogicalGroupNode(segment, root);
			current.children.push(next);
		}
		current = next;
	});
	return current;
}

export function applyDesignLayoutLogic(
	layout: NormalizedDesignLayoutDocument,
	logicInput?: DesignLayoutLogicSpec | null,
): NormalizedDesignLayoutDocument {
	const logic = normalizeLogicSpec(logicInput);
	if (!logic) {
		return {
			root: cloneDesignNode(layout.root),
			assetTasks: Array.isArray(layout.assetTasks) ? layout.assetTasks.slice() : [],
		};
	}

	const root = cloneDesignNode(layout.root);
	if (logic.rootName) {
		root.name = logic.rootName;
	}

	(logic.rules || []).forEach((rule) => {
		const found = findRuleTarget(root, rule);
		if (!found || !found.node) {
			return;
		}
		const targetNode = found.node;
		const derivedName = deriveSemanticNodeName(targetNode, rule);
		const semanticName = shouldUseDerivedSemanticName(targetNode, rule, derivedName)
			? derivedName
			: rule.name || derivedName;
		if (semanticName) {
			targetNode.name = semanticName;
		}
		if (rule.propertyName || rule.dataKey || rule.group || rule.handlerName) {
			targetNode.binding = {
				propertyName: rule.propertyName,
				dataKey: rule.dataKey,
				group: rule.group,
				...(rule.handlerName ? { handlerName: rule.handlerName } : {}),
			};
		}
		targetNode.isButton = looksLikeButton(
			targetNode.name,
			targetNode.visual && targetNode.visual.assetPath,
			targetNode.binding,
		);
		if (!rule.path || !found.parent || found.parent === root && splitLogicPath(rule.path).length === 0) {
			return;
		}
		const pathSegments = splitLogicPath(rule.path);
		if (pathSegments.length === 0) {
			return;
		}
		found.parent.children = (found.parent.children || []).filter((child) => child !== targetNode);
		const nextParent = ensureLogicalPath(root, pathSegments);
		nextParent.children.push(targetNode);
	});

	return {
		root: nestButtonLabelsIntoHierarchy(root),
		assetTasks: Array.isArray(layout.assetTasks) ? layout.assetTasks.slice() : [],
	};
}

export function analyzeNormalizedDesignLayout(layout: NormalizedDesignLayoutDocument): DesignLayoutAnalysis {
	const resolvedImageNodes: DesignLayoutAnalysisNode[] = [];
	const missingImageNodes: DesignLayoutAnalysisNode[] = [];
	const generatedShapeNodes: DesignLayoutAnalysisNode[] = [];
	const summary = {
		totalNodes: 0,
		imageNodes: 0,
		textNodes: 0,
		containerNodes: 0,
		buttonLikeNodes: 0,
		resolvedImageNodes: 0,
		missingImageNodes: 0,
		generatedShapeNodes: 0,
	};

	const visit = (node: NormalizedDesignNode) => {
		summary.totalNodes++;
		if (node.nodeType === "image") {
			summary.imageNodes++;
		} else if (node.nodeType === "text") {
			summary.textNodes++;
		} else {
			summary.containerNodes++;
		}
		if (node.isButton) {
			summary.buttonLikeNodes++;
		}

		if (node.nodeType === "image") {
			if (node.visual) {
				summary.resolvedImageNodes++;
				resolvedImageNodes.push({
					id: node.id,
					name: node.name,
					nodeType: node.nodeType,
					size: node.size,
					assetPath: node.visual.assetPath,
					source: node.visual.source,
					useSliced: node.visual.useSliced,
					preferredSizeMode: node.visual.preferredSizeMode,
				});
			} else {
				summary.missingImageNodes++;
				missingImageNodes.push({
					id: node.id,
					name: node.name,
					nodeType: node.nodeType,
					size: node.size,
					source: "missing",
				});
			}
		}

		(node.children || []).forEach(visit);
	};

	visit(layout.root);

	return {
		summary,
		resolvedImageNodes,
		missingImageNodes,
		generatedShapeNodes,
	};
}

function hasNonAsciiName(name: string): boolean {
	return /[^\x00-\x7F]/.test(String(name || ""));
}

function looksLikeSizeSuffixedDesignName(name: string): boolean {
	return /\d+\s*[xX×]\s*\d+/.test(String(name || ""));
}

function looksLikeLayerStyleName(name: string): boolean {
	return /(?:^|[_\s-])layer(?:[_\s-]?\d+)?$/i.test(String(name || ""));
}

function looksLikePlaceholderGenericName(name: string): boolean {
	return /^(?:img|image|txt|text|ctn|container|grp|group|spr|sprite|lab|label|lbl|btn|button|node|icon)[_-]?\d+$/i.test(
		String(name || ""),
	);
}

function looksLikeTextContentName(node: NormalizedDesignNode): boolean {
	if (node.nodeType !== "text" || !node.text || !node.text.content) {
		return false;
	}
	return isNodeNameDerivedFromDisplayCopy(node.name, node.text.content);
}

export function analyzeDesignLayoutLogicReadiness(
	layout: NormalizedDesignLayoutDocument,
): DesignLayoutLogicReadiness {
	const issues: DesignLayoutLogicIssue[] = [];

	const visit = (node: NormalizedDesignNode) => {
		const rawName = String(node.name || "");
		if (hasNonAsciiName(rawName)) {
			issues.push({
				id: node.id,
				name: rawName,
				nodeType: node.nodeType,
				reason: "non-ascii-name",
			});
		} else if (looksLikeTextContentName(node)) {
			issues.push({
				id: node.id,
				name: rawName,
				nodeType: node.nodeType,
				reason: "text-content-name",
			});
		} else if (looksLikePlaceholderGenericName(rawName)) {
			issues.push({
				id: node.id,
				name: rawName,
				nodeType: node.nodeType,
				reason: "placeholder-generic-name",
			});
		} else if (looksLikeSizeSuffixedDesignName(rawName)) {
			issues.push({
				id: node.id,
				name: rawName,
				nodeType: node.nodeType,
				reason: "size-suffixed-name",
			});
		} else if (looksLikeLayerStyleName(rawName)) {
			issues.push({
				id: node.id,
				name: rawName,
				nodeType: node.nodeType,
				reason: "layer-style-name",
			});
		}

		(node.children || []).forEach(visit);
	};

	visit(layout.root);

	return {
		requiresExplicitLogic: issues.length > 0,
		issues,
	};
}
