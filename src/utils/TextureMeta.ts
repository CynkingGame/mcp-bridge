export function disableSpriteFrameTrim(meta: any): boolean {
	if (!meta || typeof meta !== "object" || !meta.subMetas || typeof meta.subMetas !== "object") {
		return false;
	}

	let changed = false;
	Object.values(meta.subMetas).forEach((subMeta: any) => {
		if (!subMeta || typeof subMeta !== "object") {
			return;
		}
		const looksLikeSpriteFrame =
			subMeta.importer === "sprite-frame" ||
			typeof subMeta.rawTextureUuid === "string" ||
			"trimType" in subMeta;
		if (!looksLikeSpriteFrame) {
			return;
		}
		if (subMeta.trimType !== "none") {
			subMeta.trimType = "none";
			changed = true;
		}
	});

	return changed;
}
