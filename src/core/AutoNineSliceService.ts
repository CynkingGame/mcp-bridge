import fs from "fs";
import path from "path";
import {
	AutoNineSlicePolicy,
	AutoNineSliceRule,
	AutoNineSliceState,
	hasProcessedAutoNineSliceMarker,
	markAutoNineSliceProcessed,
	normalizeAutoNineSlicePolicy,
	readConfiguredNineSliceBorder,
	resolveAutoNineSliceRule,
} from "../utils/AutoNineSlice";
import { loadProjectUiPolicyForCurrentEditor } from "../utils/UiPolicyLoader";

declare const Editor: any;

interface TextureDescriptor {
	sourceUuid: string;
	sourceUrl: string;
	textureUuid: string;
	textureUrl: string;
	textureName: string;
}

interface EnsureContext {
	policy: AutoNineSlicePolicy;
	state: AutoNineSliceState;
}

function getProfile() {
	return Editor.Profile.load("profile://project/mcp-bridge.json", "mcp-bridge");
}

function readStateFromProfile(): AutoNineSliceState {
	const profile = getProfile();
	const stored = profile.get("auto-nine-slice") || {};
	return normalizeAutoNineSlicePolicy({ state: stored }).state;
}

function saveStateToProfile(state: AutoNineSliceState) {
	const profile = getProfile();
	profile.set("auto-nine-slice", state);
	profile.save();
}

function extractTextureUrl(assetUrl: string): string | null {
	if (!assetUrl) {
		return null;
	}
	const matched = assetUrl.match(/^(db:\/\/.+?\.(png|jpg|jpeg|webp))/i);
	return matched ? matched[1] : null;
}

function resolveTextureDescriptor(uuid: string): TextureDescriptor | null {
	if (!uuid) {
		return null;
	}
	const sourceUrl = Editor.assetdb.uuidToUrl(uuid);
	if (!sourceUrl) {
		return null;
	}
	const textureUrl = extractTextureUrl(sourceUrl) || sourceUrl;
	const textureUuid = Editor.assetdb.urlToUuid(textureUrl) || uuid;
	return {
		sourceUuid: uuid,
		sourceUrl,
		textureUuid,
		textureUrl,
		textureName: path.basename(textureUrl),
	};
}

function loadTextureMeta(texture: TextureDescriptor): any | null {
	let meta = Editor.assetdb.loadMeta(texture.textureUuid);
	if (meta) {
		return meta;
	}

	try {
		const fspath = Editor.assetdb.urlToFspath(texture.textureUrl);
		const metaPath = `${fspath}.meta`;
		if (fs.existsSync(metaPath)) {
			return JSON.parse(fs.readFileSync(metaPath, "utf8"));
		}
	} catch (_error) {
		return null;
	}

	return null;
}

function getPrimarySubMeta(meta: any): Record<string, any> | null {
	if (!meta || !meta.subMetas) {
		return null;
	}
	const firstEntry = Object.keys(meta.subMetas)[0];
	return firstEntry ? meta.subMetas[firstEntry] : null;
}

function applyBorderToSubMeta(subMeta: Record<string, any>, border: [number, number, number, number]) {
	if (subMeta.border !== undefined) {
		subMeta.border = border;
		return;
	}
	subMeta.borderTop = border[0];
	subMeta.borderBottom = border[1];
	subMeta.borderLeft = border[2];
	subMeta.borderRight = border[3];
}

function buildNoopResult(texture: TextureDescriptor | null, reason: string, extra?: Record<string, any>) {
	return {
		ok: true,
		status: "skipped",
		reason,
		textureUrl: texture ? texture.textureUrl : null,
		textureName: texture ? texture.textureName : null,
		...extra,
	};
}

function ensureTexture(
	texture: TextureDescriptor | null,
	context: EnsureContext,
	callback: (err: string | null, result?: Record<string, any>) => void,
) {
	if (!texture) {
		return callback(null, buildNoopResult(null, "invalid-texture"));
	}

	const rule = resolveAutoNineSliceRule(context.policy, texture.textureName);
	if (!rule) {
		return callback(null, buildNoopResult(texture, "no-rule"));
	}

	if (hasProcessedAutoNineSliceMarker(context.state, texture.textureUrl, rule)) {
		return callback(null, buildNoopResult(texture, "already-marked", { border: rule.border }));
	}

	const meta = loadTextureMeta(texture);
	if (!meta) {
		return callback(`加载纹理 Meta 失败: ${texture.textureUrl}`);
	}
	const subMeta = getPrimarySubMeta(meta);
	if (!subMeta) {
		return callback(`纹理缺少 subMetas，无法设置 9-slice: ${texture.textureUrl}`);
	}

	const existingBorder = readConfiguredNineSliceBorder(subMeta);
	if (existingBorder) {
		context.state = markAutoNineSliceProcessed(context.state, texture.textureUrl, rule);
		saveStateToProfile(context.state);
		return callback(
			null,
			buildNoopResult(texture, "already-configured", {
				border: existingBorder,
				marked: true,
			}),
		);
	}

	meta.type = "sprite";
	applyBorderToSubMeta(subMeta, rule.border);
	Editor.assetdb.saveMeta(texture.textureUuid, JSON.stringify(meta), (err) => {
		if (err) {
			return callback(`保存 9-slice Meta 失败: ${err}`);
		}
		context.state = markAutoNineSliceProcessed(context.state, texture.textureUrl, rule);
		saveStateToProfile(context.state);
		callback(null, {
			ok: true,
			status: "updated",
			reason: "border-applied",
			textureUrl: texture.textureUrl,
			textureName: texture.textureName,
			border: rule.border,
			marked: true,
		});
	});
}

export class AutoNineSliceService {
	static getPolicy(): AutoNineSlicePolicy {
		const uiPolicy = loadProjectUiPolicyForCurrentEditor();
		return normalizeAutoNineSlicePolicy(uiPolicy);
	}

	static ensureForAssignedAsset(
		uuid: string,
		callback: (err: string | null, result?: Record<string, any>) => void,
	) {
		const policy = this.getPolicy();
		if (!policy.enabled || !policy.triggerOnSpriteAssignment) {
			return callback(null, buildNoopResult(null, "policy-disabled"));
		}

		const context: EnsureContext = {
			policy,
			state: readStateFromProfile(),
		};
		ensureTexture(resolveTextureDescriptor(uuid), context, callback);
	}

	static ensureForAssetUuids(
		uuids: string[],
		callback: (err: string | null, result?: Record<string, any>) => void,
	) {
		const policy = this.getPolicy();
		if (!policy.enabled) {
			return callback(null, {
				ok: true,
				updated: 0,
				scanned: 0,
				results: [],
				reason: "policy-disabled",
			});
		}

		const uniqueUuids = Array.from(new Set((uuids || []).filter(Boolean)));
		const context: EnsureContext = {
			policy,
			state: readStateFromProfile(),
		};
		const results: Record<string, any>[] = [];

		const next = (index: number) => {
			if (index >= uniqueUuids.length) {
				return callback(null, {
					ok: true,
					scanned: uniqueUuids.length,
					updated: results.filter((item) => item.status === "updated").length,
					skipped: results.filter((item) => item.status === "skipped").length,
					results,
				});
			}

			ensureTexture(resolveTextureDescriptor(uniqueUuids[index]), context, (err, result) => {
				if (err) {
					results.push({
						ok: false,
						status: "error",
						reason: err,
						uuid: uniqueUuids[index],
					});
				} else if (result) {
					results.push(result);
				}
				next(index + 1);
			});
		};

		next(0);
	}
}
