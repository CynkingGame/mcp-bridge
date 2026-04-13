export interface ImportedDesignVisualLike {
	preferredSizeMode?: "RAW" | "CUSTOM" | string | null;
}

export type ImportedSpritePreferredMode = "RAW" | "CUSTOM";

export interface ImportedDesignSizeLike {
	width?: number | null;
	height?: number | null;
}

export interface ImportedDesignNodeLike {
	width?: number;
	height?: number;
	setContentSize?: (width: number, height: number) => void;
}

export function resolveImportedSpritePreferredMode(
	visual: ImportedDesignVisualLike | null | undefined,
	detectedPreferredMode?: ImportedSpritePreferredMode | string | null,
): ImportedSpritePreferredMode {
	if (visual && visual.preferredSizeMode === "CUSTOM") {
		return "CUSTOM";
	}
	return detectedPreferredMode === "CUSTOM" ? "CUSTOM" : "RAW";
}

export function preserveImportedSpriteNodeSize(
	node: ImportedDesignNodeLike | null | undefined,
	visual: ImportedDesignVisualLike | null | undefined,
	size: ImportedDesignSizeLike | null | undefined,
	detectedPreferredMode?: ImportedSpritePreferredMode | string | null,
): void {
	if (!node || resolveImportedSpritePreferredMode(visual, detectedPreferredMode) !== "CUSTOM" || !size) {
		return;
	}

	const width = Number(size.width);
	const height = Number(size.height);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return;
	}

	if (typeof node.setContentSize === "function") {
		node.setContentSize(width, height);
		return;
	}

	node.width = width;
	node.height = height;
}
