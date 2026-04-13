import path from "path";

function normalizeFontKey(input: string): string {
	return String(input || "")
		.replace(/\.(ttf|otf|fnt)$/i, "")
		.replace(/[^A-Za-z0-9]+/g, "")
		.toLowerCase();
}

function buildFontAliases(assetUrl: string): string[] {
	const basename = path.basename(String(assetUrl || ""), path.extname(String(assetUrl || "")));
	const normalized = normalizeFontKey(basename);
	const aliases = new Set<string>();
	if (normalized) {
		aliases.add(normalized);
	}
	if (normalized.endsWith("regular")) {
		aliases.add(normalized.slice(0, -"regular".length));
	}
	return Array.from(aliases);
}

export function buildProjectFontAssetIndex(assetUrls: string[]): Map<string, string> {
	const index = new Map<string, string>();
	(assetUrls || []).forEach((assetUrl) => {
		buildFontAliases(assetUrl).forEach((alias) => {
			if (!index.has(alias)) {
				index.set(alias, assetUrl);
			}
		});
	});
	return index;
}

export function resolveProjectFontAssetUrl(fontFamily: string, assetUrls: string[]): string | null {
	const normalizedFamily = normalizeFontKey(fontFamily);
	if (!normalizedFamily) {
		return null;
	}
	const index = buildProjectFontAssetIndex(assetUrls);
	return index.get(normalizedFamily) || null;
}

export function resolveProjectFontAssetUuid(
	fontFamily: string,
	assetUrls: string[],
	resolveUuid: (assetUrl: string) => string | null | undefined,
): string | null {
	const assetUrl = resolveProjectFontAssetUrl(fontFamily, assetUrls);
	if (!assetUrl) {
		return null;
	}
	return resolveUuid(assetUrl) || null;
}
