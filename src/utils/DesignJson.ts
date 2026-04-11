import path from "path";

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
}

export interface NormalizedDesignTextSpec {
	content: string;
	fontFamily: string;
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

function looksLikeButton(name: string): boolean {
	return /(btn|button|按钮)/i.test(String(name || ""));
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

function shouldUseSliced(node: any): boolean {
	return /点9/.test(String(node?.name || ""));
}

function stripNodeSizeSuffix(input: string): string {
	return String(input || "").replace(/[\s_-]*\d+\s*[xX×]\s*\d+$/g, "").trim();
}

function normalizeAssetKey(input: string): string {
	return sanitizeStem(stripNodeSizeSuffix(input)).replace(/[_-]+/g, "").toLowerCase();
}

function buildImageAssetLookup(paths: string[]): Map<string, string> {
	const lookup = new Map<string, string>();
	(paths || []).forEach((assetPath) => {
		const ext = path.extname(assetPath || "");
		const base = path.basename(assetPath || "", ext);
		const keys = [base, stripNodeSizeSuffix(base)]
			.map((item) => normalizeAssetKey(item))
			.filter(Boolean);
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
	const candidates = [
		node?.name,
		node?.assetsRef?.imagePath ? path.basename(String(node.assetsRef.imagePath), path.extname(String(node.assetsRef.imagePath))) : "",
	]
		.map((item) => normalizeAssetKey(String(item || "")))
		.filter(Boolean);
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
	const sliced = shouldUseSliced(node);
	const mappedAssetPath = resolveMappedImageAsset(node, options.imageAssetMap);
	if (mappedAssetPath) {
		return {
			assetPath: mappedAssetPath,
			preferredSizeMode: sliced ? "CUSTOM" : "RAW",
			useSliced: sliced,
			source: "explicit-map",
		};
	}
	const providedAssetPath = resolveProvidedImageAsset(node, options.imageAssetLookup);
	if (providedAssetPath) {
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
		isButton: looksLikeButton(node?.name),
		text: buildTextSpec(node),
		visual: createNodeVisual(node, options),
		children: (Array.isArray(node?.children) ? node.children : []).map((child) =>
			normalizeNodeTree(child, effectiveFrame, options, tasks, seenPaths),
		),
	};
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
		root,
		assetTasks,
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
