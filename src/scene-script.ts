
"use strict";
import { resolveCreateNodePolicy, resolveNamedUiPreset, resolvePrefabRootPolicy } from "./utils/UiPolicy";
import { validateUiTree } from "./utils/UiPolicyValidation";
import { resolvePreferredSpriteSizeMode } from "./utils/AutoNineSlice";
import { preserveImportedSpriteNodeSize, resolveImportedSpritePreferredMode } from "./utils/ImportedDesignSprite";
import { resolveSerializedPrefabSubtree } from "./utils/PrefabSerialization";
import { resolveProjectFontAssetUrl } from "./utils/FontAssetResolver";

/**
 * 更加健壮的节点查找函数，支持解压后的 UUID
 * @param {string} id 节点的 UUID (支持 22 位压缩格式)
 * @returns {cc.Node | null} 找到的节点对象或 null
 */
const findNode = (id) => {
    if (!id) return null;
    let node = cc.engine.getInstanceById(id);
    if (!node && typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
        // 如果直接查不到，尝试对可能是压缩格式的 ID 进行解压后再次查找
        try {
            const decompressed = Editor.Utils.UuidUtils.decompressUuid(id);
            if (decompressed !== id) {
                node = cc.engine.getInstanceById(decompressed);
            }
        } catch (e) {
            // 忽略转换错误
        }
    }
    return node;
};

const getCanvasComponent = (scene) => {
    if (!scene) return null;
    return scene.getComponentInChildren(cc.Canvas);
};

const getCanvasDesignResolution = (scene, uiPolicy) => {
    const canvasComp = getCanvasComponent(scene);
    if (canvasComp && canvasComp.designResolution) {
        return {
            width: canvasComp.designResolution.width,
            height: canvasComp.designResolution.height,
        };
    }
    const fallback = uiPolicy && uiPolicy.canvas && uiPolicy.canvas.designResolution;
    if (fallback) {
        return {
            width: fallback.width,
            height: fallback.height,
        };
    }
    return null;
};

const ensureWidget = (node) => {
    return node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
};

const resetWidgetAlignment = (widget) => {
    widget.target = null;
    widget.alignMode = cc.Widget.AlignMode.ONCE;
    widget.isAlignTop = false;
    widget.isAlignBottom = false;
    widget.isAlignLeft = false;
    widget.isAlignRight = false;
    widget.isAlignHorizontalCenter = false;
    widget.isAlignVerticalCenter = false;
    widget.top = 0;
    widget.bottom = 0;
    widget.left = 0;
    widget.right = 0;
    widget.horizontalCenter = 0;
    widget.verticalCenter = 0;
    widget.isAbsoluteTop = true;
    widget.isAbsoluteBottom = true;
    widget.isAbsoluteLeft = true;
    widget.isAbsoluteRight = true;
    widget.isAbsoluteHorizontalCenter = true;
    widget.isAbsoluteVerticalCenter = true;
};

const applyLayoutToWidget = (widget, layout) => {
    if (!widget || !layout) return;
    resetWidgetAlignment(widget);

    switch (layout) {
        case "center":
            widget.isAlignHorizontalCenter = true;
            widget.isAlignVerticalCenter = true;
            break;
        case "full":
            widget.isAlignTop = true;
            widget.isAlignBottom = true;
            widget.isAlignLeft = true;
            widget.isAlignRight = true;
            break;
        case "top":
            widget.isAlignTop = true;
            widget.isAlignHorizontalCenter = true;
            break;
        case "bottom":
            widget.isAlignBottom = true;
            widget.isAlignHorizontalCenter = true;
            break;
        case "left":
            widget.isAlignLeft = true;
            widget.isAlignVerticalCenter = true;
            break;
        case "right":
            widget.isAlignRight = true;
            widget.isAlignVerticalCenter = true;
            break;
        case "top-left":
            widget.isAlignTop = true;
            widget.isAlignLeft = true;
            break;
        case "top-right":
            widget.isAlignTop = true;
            widget.isAlignRight = true;
            break;
        case "bottom-left":
            widget.isAlignBottom = true;
            widget.isAlignLeft = true;
            break;
        case "bottom-right":
            widget.isAlignBottom = true;
            widget.isAlignRight = true;
            break;
    }
};

const getSpriteFrameUuid = (spriteFrame) => {
    if (!spriteFrame) return null;
    return spriteFrame._uuid || spriteFrame._rawFilesUuid || null;
};

const collectCurrentSpriteAssetUuids = () => {
    const collected = new Set();
    const addSpriteFrame = (spriteFrame) => {
        const uuid = getSpriteFrameUuid(spriteFrame);
        if (uuid) {
            collected.add(uuid);
        }
    };
    const visit = (node) => {
        if (!node) return;
        const sprite = node.getComponent(cc.Sprite);
        if (sprite) {
            addSpriteFrame(sprite.spriteFrame);
        }
        const button = node.getComponent(cc.Button);
        if (button) {
            ["normalSprite", "pressedSprite", "hoverSprite", "disabledSprite"].forEach((key) => {
                addSpriteFrame(button[key]);
            });
        }
        node.children.forEach((child) => visit(child));
    };
    const scene = cc.director.getScene();
    if (scene) {
        visit(scene);
    }
    return Array.from(collected);
};

let cachedProjectFontAssetUrls = null;

const collectProjectFontAssetUrls = () => {
    if (cachedProjectFontAssetUrls) {
        return cachedProjectFontAssetUrls.slice();
    }
    if (!Editor || !Editor.assetdb || !Editor.assetdb.urlToFspath) {
        cachedProjectFontAssetUrls = [];
        return [];
    }
    try {
        const fs = require("fs");
        const path = require("path");
        const rootFsPath = Editor.assetdb.urlToFspath("db://assets");
        if (!rootFsPath || !fs.existsSync(rootFsPath)) {
            cachedProjectFontAssetUrls = [];
            return [];
        }
        const collected = [];
        const visit = (dirPath) => {
            fs.readdirSync(dirPath, { withFileTypes: true }).forEach((entry) => {
                const nextPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    visit(nextPath);
                    return;
                }
                if (!/\.(ttf|otf)$/i.test(entry.name)) {
                    return;
                }
                const assetUrl =
                    (Editor.assetdb.fspathToUrl && Editor.assetdb.fspathToUrl(nextPath)) ||
                    null;
                if (assetUrl) {
                    collected.push(assetUrl);
                }
            });
        };
        visit(rootFsPath);
        cachedProjectFontAssetUrls = collected;
        return collected.slice();
    } catch (_error) {
        cachedProjectFontAssetUrls = [];
        return [];
    }
};

const resolveDesignFontAssetUuid = (fontFamily) => {
    if (!fontFamily || !Editor || !Editor.assetdb || !Editor.assetdb.urlToUuid) {
        return null;
    }
    const assetUrl = resolveProjectFontAssetUrl(fontFamily, collectProjectFontAssetUrls());
    return assetUrl ? Editor.assetdb.urlToUuid(assetUrl) : null;
};

const extractTextureUrl = (assetUrl) => {
    if (!assetUrl || typeof assetUrl !== "string") return null;
    const matched = assetUrl.match(/^(db:\/\/.+?\.(png|jpg|jpeg|webp))/i);
    return matched ? matched[1] : assetUrl;
};

const readSpriteAssetMetaInfo = (uuid) => {
    if (!uuid || !Editor || !Editor.assetdb) {
        return null;
    }
    try {
        const sourceUrl =
            (Editor.assetdb.remote && Editor.assetdb.remote.uuidToUrl && Editor.assetdb.remote.uuidToUrl(uuid)) ||
            Editor.assetdb.uuidToUrl(uuid);
        if (!sourceUrl) {
            return null;
        }
        const textureUrl = extractTextureUrl(sourceUrl);
        if (!textureUrl) {
            return null;
        }
        const fspath = Editor.assetdb.urlToFspath(textureUrl);
        if (!fspath) {
            return null;
        }
        const fs = require("fs");
        const path = require("path");
        const metaPath = fspath + ".meta";
        let subMeta = null;
        if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
            if (meta && meta.subMetas) {
                const subKey = sourceUrl.indexOf(textureUrl + "/") === 0 ? sourceUrl.slice(textureUrl.length + 1) : "";
                if (subKey && meta.subMetas[subKey]) {
                    subMeta = meta.subMetas[subKey];
                } else {
                    const firstKey = Object.keys(meta.subMetas)[0];
                    subMeta = firstKey ? meta.subMetas[firstKey] : null;
                }
            }
        }
        return {
            textureName: path.basename(textureUrl),
            subMeta,
        };
    } catch (_error) {
        return null;
    }
};

const resolveSpriteSizeModeName = (sizeMode) => {
    if (!cc || !cc.Sprite || !cc.Sprite.SizeMode) {
        return "UNKNOWN";
    }
    if (sizeMode === cc.Sprite.SizeMode.CUSTOM) {
        return "CUSTOM";
    }
    if (sizeMode === cc.Sprite.SizeMode.RAW) {
        return "RAW";
    }
    return "TRIMMED";
};

const resolveSpriteTypeName = (type) => {
    if (!cc || !cc.Sprite || !cc.Sprite.Type) {
        return "UNKNOWN";
    }
    if (type === cc.Sprite.Type.SLICED) {
        return "SLICED";
    }
    if (type === cc.Sprite.Type.SIMPLE) {
        return "SIMPLE";
    }
    return String(type);
};

const captureImportedNodeSize = (node) => ({
    width: Math.round(Number(node && node.width) || 0),
    height: Math.round(Number(node && node.height) || 0),
});

const hasValidImportedDesignSize = (size) =>
    !!size &&
    Number.isFinite(Number(size.width)) &&
    Number(size.width) > 0 &&
    Number.isFinite(Number(size.height)) &&
    Number(size.height) > 0;

const applyPreferredSpriteSizeMode = (sprite, uiPolicy, uuid, preferredModeHint) => {
    if (!sprite || !cc || !cc.Sprite || !cc.Sprite.SizeMode) {
        return {
            textureName: "",
            detectedPreferredMode: "RAW",
            appliedPreferredMode: preferredModeHint === "CUSTOM" ? "CUSTOM" : "RAW",
        };
    }
    const metaInfo = readSpriteAssetMetaInfo(uuid);
    const detectedPreferredMode = resolvePreferredSpriteSizeMode(
        uiPolicy,
        (metaInfo && metaInfo.textureName) || "",
        metaInfo && metaInfo.subMeta,
    );
    const preferredMode = resolveImportedSpritePreferredMode(
        preferredModeHint ? { preferredSizeMode: preferredModeHint } : null,
        detectedPreferredMode,
    );
    const isCustom = preferredMode === "CUSTOM";
    sprite.sizeMode = isCustom ? cc.Sprite.SizeMode.CUSTOM : cc.Sprite.SizeMode.RAW;
    sprite.type = isCustom ? cc.Sprite.Type.SLICED : cc.Sprite.Type.SIMPLE;
    return {
        textureName: (metaInfo && metaInfo.textureName) || "",
        detectedPreferredMode,
        appliedPreferredMode: preferredMode,
    };
};

const applyResolvedUiPolicyToNode = (node, resolvedPolicy) => {
    if (!node || !resolvedPolicy) return;

    if (resolvedPolicy.anchor) {
        node.anchorX = Number(resolvedPolicy.anchor.x);
        node.anchorY = Number(resolvedPolicy.anchor.y);
    }

    if (resolvedPolicy.layout) {
        const widget = ensureWidget(node);
        applyLayoutToWidget(widget, resolvedPolicy.layout);
    }

    if (resolvedPolicy.safeArea && !node.getComponent(cc.SafeArea)) {
        node.addComponent(cc.SafeArea);
    }
};

const applyDefaultLabelPolicy = (label) => {
    if (!label || !cc || !cc.Label) {
        return;
    }
    label.overflow = cc.Label.Overflow.NONE;
};

const applyDefaultButtonPolicy = (button) => {
    if (!button || !cc || !cc.Button || !cc.Button.Transition) {
        return;
    }
    button.transition = cc.Button.Transition.SCALE;
    button.zoomScale = 1.03;
};

const captureUiState = (node) => {
    const widget = node.getComponent(cc.Widget);
    const safeArea = node.getComponent(cc.SafeArea);
    return {
        anchorX: node.anchorX,
        anchorY: node.anchorY,
        hadWidget: !!widget,
        widget: widget
            ? {
                enabled: widget.enabled,
                target: widget.target,
                alignMode: widget.alignMode,
                isAlignTop: widget.isAlignTop,
                isAlignBottom: widget.isAlignBottom,
                isAlignLeft: widget.isAlignLeft,
                isAlignRight: widget.isAlignRight,
                isAlignHorizontalCenter: widget.isAlignHorizontalCenter,
                isAlignVerticalCenter: widget.isAlignVerticalCenter,
                top: widget.top,
                bottom: widget.bottom,
                left: widget.left,
                right: widget.right,
                horizontalCenter: widget.horizontalCenter,
                verticalCenter: widget.verticalCenter,
                isAbsoluteTop: widget.isAbsoluteTop,
                isAbsoluteBottom: widget.isAbsoluteBottom,
                isAbsoluteLeft: widget.isAbsoluteLeft,
                isAbsoluteRight: widget.isAbsoluteRight,
                isAbsoluteHorizontalCenter: widget.isAbsoluteHorizontalCenter,
                isAbsoluteVerticalCenter: widget.isAbsoluteVerticalCenter,
            }
            : null,
        hadSafeArea: !!safeArea,
        safeAreaEnabled: safeArea ? safeArea.enabled : false,
    };
};

const restoreUiState = (node, snapshot) => {
    if (!node || !snapshot) return;

    node.anchorX = snapshot.anchorX;
    node.anchorY = snapshot.anchorY;

    let widget = node.getComponent(cc.Widget);
    if (!snapshot.hadWidget) {
        if (widget) {
            node.removeComponent(widget);
        }
    } else {
        widget = widget || node.addComponent(cc.Widget);
        widget.enabled = snapshot.widget.enabled;
        widget.target = snapshot.widget.target;
        widget.alignMode = snapshot.widget.alignMode;
        widget.isAlignTop = snapshot.widget.isAlignTop;
        widget.isAlignBottom = snapshot.widget.isAlignBottom;
        widget.isAlignLeft = snapshot.widget.isAlignLeft;
        widget.isAlignRight = snapshot.widget.isAlignRight;
        widget.isAlignHorizontalCenter = snapshot.widget.isAlignHorizontalCenter;
        widget.isAlignVerticalCenter = snapshot.widget.isAlignVerticalCenter;
        widget.top = snapshot.widget.top;
        widget.bottom = snapshot.widget.bottom;
        widget.left = snapshot.widget.left;
        widget.right = snapshot.widget.right;
        widget.horizontalCenter = snapshot.widget.horizontalCenter;
        widget.verticalCenter = snapshot.widget.verticalCenter;
        widget.isAbsoluteTop = snapshot.widget.isAbsoluteTop;
        widget.isAbsoluteBottom = snapshot.widget.isAbsoluteBottom;
        widget.isAbsoluteLeft = snapshot.widget.isAbsoluteLeft;
        widget.isAbsoluteRight = snapshot.widget.isAbsoluteRight;
        widget.isAbsoluteHorizontalCenter = snapshot.widget.isAbsoluteHorizontalCenter;
        widget.isAbsoluteVerticalCenter = snapshot.widget.isAbsoluteVerticalCenter;
    }

    let safeArea = node.getComponent(cc.SafeArea);
    if (!snapshot.hadSafeArea) {
        if (safeArea) {
            node.removeComponent(safeArea);
        }
    } else {
        safeArea = safeArea || node.addComponent(cc.SafeArea);
        safeArea.enabled = snapshot.safeAreaEnabled;
    }
};

const snapshotNodeForValidation = (node) => {
    if (!node) return null;

    const widget = node.getComponent(cc.Widget);
    const safeArea = node.getComponent(cc.SafeArea);
    const label = node.getComponent(cc.Label);
    const richText = node.getComponent(cc.RichText);
    const components = (node._components || []).map((component) => cc.js.getClassName(component));

    return {
        name: node.name,
        uuid: node.uuid,
        anchor: {
            x: node.anchorX,
            y: node.anchorY,
        },
        size: {
            width: node.width,
            height: node.height,
        },
        components,
        labelText: label ? label.string : richText ? richText.string : null,
        hasSafeArea: !!safeArea,
        widget: widget
            ? {
                isAlignTop: widget.isAlignTop,
                isAlignBottom: widget.isAlignBottom,
                isAlignLeft: widget.isAlignLeft,
                isAlignRight: widget.isAlignRight,
                isAlignHorizontalCenter: widget.isAlignHorizontalCenter,
                isAlignVerticalCenter: widget.isAlignVerticalCenter,
            }
            : null,
        children: node.children.map((child) => snapshotNodeForValidation(child)),
    };
};

const generatePrefabFileId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    for (let i = 0; i < 22; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const serializeNodeToPrefabJson = (node, options) => {
    const scene = cc.director.getScene();
    const resolvedPrefabRootPolicy = resolvePrefabRootPolicy(options && options.uiPolicy, {
        rootPreset: options && options.rootPreset,
        nodeSize: {
            width: node.width,
            height: node.height,
        },
        canvasDesignResolution: getCanvasDesignResolution(scene, options && options.uiPolicy),
    });
    const nodeUiSnapshot = resolvedPrefabRootPolicy.shouldApply ? captureUiState(node) : null;
    const originalNodeName = node.name;
    const serializeRootMarker = `__MCP_SERIALIZE_ROOT__${Date.now()}__`;

    try {
        if (resolvedPrefabRootPolicy.shouldApply) {
            applyResolvedUiPolicyToNode(node, resolvedPrefabRootPolicy);
        }

        node.name = serializeRootMarker;
        const serializedStr = Editor.serialize(node);
        const nodeData = JSON.parse(serializedStr);
        const sceneSerializedStr = scene ? Editor.serialize(scene) : null;
        const sceneData = sceneSerializedStr ? JSON.parse(sceneSerializedStr) : null;
        const subtree = resolveSerializedPrefabSubtree(nodeData, sceneData, serializeRootMarker);
        const orderedIndices = subtree.orderedIndices;
        const oldToNewIndex = {};
        const filteredData: any[] = orderedIndices.map((oldIndex, position) => {
            oldToNewIndex[oldIndex] = position + 1;
            const sourceData = subtree.usedFallback ? sceneData : nodeData;
            const cloned = JSON.parse(JSON.stringify(sourceData[oldIndex]));
            if (cloned && cloned.__type__ === "cc.Node") {
                cloned._prefab = null;
            }
            return cloned;
        });

        const rootNodeNewIndex = 1;
        const nodeEntries: any[] = [];
        for (let i = 0; i < filteredData.length; i++) {
            if (filteredData[i].__type__ === "cc.Node") {
                nodeEntries.push({
                    arrayIndex: i + 1,
                    isRoot: i === 0,
                });
            }
        }

        let prefabData: any[] = [
            {
                __type__: "cc.Prefab",
                _name: "",
                _objFlags: 0,
                _native: "",
                data: { __id__: rootNodeNewIndex },
                optimizationPolicy: 0,
                asyncLoadAssets: false,
                readonly: false,
            },
        ];

        for (let i = 0; i < filteredData.length; i++) {
            prefabData.push(filteredData[i]);
        }

        const updateRefs = (obj, parentKey = "") => {
            if (obj === null || obj === undefined || typeof obj !== "object") return;
            if (Array.isArray(obj)) {
                obj.forEach((item) => updateRefs(item, parentKey));
                return;
            }
            for (let key in obj) {
                if (!obj.hasOwnProperty(key)) continue;
                if (key === "__id__" && typeof obj[key] === "number") {
                    const oldIdx = obj[key];
                    if (oldToNewIndex.hasOwnProperty(oldIdx)) {
                        obj[key] = oldToNewIndex[oldIdx];
                    } else if (parentKey === "_parent" || parentKey === "_prefab") {
                        obj.__id__ = -1;
                    }
                } else if (typeof obj[key] === "object" && obj[key] !== null) {
                    updateRefs(obj[key], key);
                }
            }
        };

        for (let i = 1; i < prefabData.length; i++) {
            updateRefs(prefabData[i]);
        }

        let rootNodeObj = prefabData[rootNodeNewIndex];
        if (rootNodeObj) {
            rootNodeObj._name = originalNodeName;
            rootNodeObj._parent = null;
        }

        for (let i = 1; i < prefabData.length; i++) {
            if (prefabData[i]._id !== undefined) {
                prefabData[i]._id = "";
            }
        }

        let prefabInfoStartIndex = prefabData.length;
        for (let ni = 0; ni < nodeEntries.length; ni++) {
            let entry = nodeEntries[ni];
            let prefabInfoIndex = prefabInfoStartIndex + ni;

            let nodeObj = prefabData[entry.arrayIndex];
            if (nodeObj) {
                nodeObj._prefab = { __id__: prefabInfoIndex };
            }

            prefabData.push({
                __type__: "cc.PrefabInfo",
                root: { __id__: rootNodeNewIndex },
                asset: { __id__: 0 },
                fileId: entry.isRoot ? "" : generatePrefabFileId(),
                sync: false,
            });
        }

        return JSON.stringify(prefabData, null, 2);
    } finally {
        node.name = originalNodeName;
        if (nodeUiSnapshot) {
            restoreUiState(node, nodeUiSnapshot);
        }
    }
};

const configureRepeatableLayout = (layout, direction) => {
    layout.resizeMode = cc.Layout.ResizeMode.CONTAINER;
    layout.paddingLeft = 16;
    layout.paddingRight = 16;
    layout.paddingTop = 16;
    layout.paddingBottom = 16;
    layout.spacingX = 12;
    layout.spacingY = 12;

    if (direction === "horizontal") {
        layout.type = cc.Layout.Type.HORIZONTAL;
        return;
    }
    if (direction === "grid") {
        layout.type = cc.Layout.Type.GRID;
        layout.startAxis = cc.Layout.AxisDirection.HORIZONTAL;
        layout.cellSize = cc.size(120, 120);
        return;
    }
    layout.type = cc.Layout.Type.VERTICAL;
};

const createRepeatableFieldNode = (field) => {
    const fieldNode = new cc.Node(field.nodeName || field.name);
    fieldNode.anchorX = 0.5;
    fieldNode.anchorY = 0.5;

    if (field.type === "sprite") {
        const sprite = fieldNode.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.RAW;
        fieldNode.width = field.width || 72;
        fieldNode.height = field.height || 72;
        return fieldNode;
    }

    const label = fieldNode.addComponent(cc.Label);
    label.string = field.placeholder || field.name;
    applyDefaultLabelPolicy(label);
    fieldNode.width = field.width || 160;
    fieldNode.height = field.height || 40;
    return fieldNode;
};

const createRepeatableItemNode = (spec) => {
    const itemNode = new cc.Node(spec.itemName);
    itemNode.anchorX = 0.5;
    itemNode.anchorY = 0.5;
    itemNode.width = spec.itemWidth || 600;
    itemNode.height = spec.itemHeight || 96;

    const layout = itemNode.addComponent(cc.Layout);
    layout.type = cc.Layout.Type.HORIZONTAL;
    layout.resizeMode = cc.Layout.ResizeMode.CONTAINER;
    layout.paddingLeft = 16;
    layout.paddingRight = 16;
    layout.paddingTop = 12;
    layout.paddingBottom = 12;
    layout.spacingX = 12;

    (spec.fields || []).forEach((field) => {
        itemNode.addChild(createRepeatableFieldNode(field));
    });
    layout.updateLayout();
    return itemNode;
};

const createRepeatableContainerNode = (spec) => {
    const containerNode = new cc.Node(spec.containerName);
    containerNode.anchorX = 0.5;
    containerNode.anchorY = 0.5;
    containerNode.width = spec.containerWidth || 720;
    containerNode.height = spec.containerHeight || 960;

    let contentParent = containerNode;
    if (spec.useScrollView) {
        const mask = containerNode.addComponent(cc.Mask);
        mask.type = cc.Mask.Type.RECT;
        const scrollView = containerNode.addComponent(cc.ScrollView);
        scrollView.horizontal = spec.listDirection !== "vertical";
        scrollView.vertical = spec.listDirection !== "horizontal";
        scrollView.inertia = true;
        scrollView.elastic = true;

        const content = new cc.Node("Content");
        content.anchorX = 0.5;
        content.anchorY = 1;
        content.width = containerNode.width;
        content.height = containerNode.height;
        containerNode.addChild(content);
        scrollView.content = content;
        contentParent = content;
    } else {
        const content = new cc.Node("Content");
        content.anchorX = 0.5;
        content.anchorY = 1;
        content.width = containerNode.width;
        content.height = containerNode.height;
        containerNode.addChild(content);
        contentParent = content;
    }

    const layout = contentParent.addComponent(cc.Layout);
    configureRepeatableLayout(layout, spec.listDirection);
    layout.updateLayout();
    return containerNode;
};

const enqueueDesignFontLoad = (label, textSpec, pendingLoads) => {
    const fontUuid = (textSpec && textSpec.fontUuid) || resolveDesignFontAssetUuid(textSpec && textSpec.fontFamily);
    if (!fontUuid) {
        if (textSpec && textSpec.fontFamily && textSpec.fontFamily !== "Arial") {
            Editor.warn(
                `[import_design_layout] 未解析到字体资源 family=${textSpec.fontFamily} node=${label.node && label.node.name ? label.node.name : "unknown"}`,
            );
        }
        label.useSystemFont = true;
        label.font = null;
        label.fontFamily = textSpec.fontFamily || "Arial";
        return;
    }
    label.useSystemFont = false;
    label.fontFamily = "";
    pendingLoads.push((done) => {
        cc.assetManager.loadAny(fontUuid, (err, asset) => {
            if (!err && asset) {
                label.useSystemFont = false;
                label.font = asset;
            } else {
                Editor.warn(
                    `[import_design_layout] 字体资源加载失败 family=${textSpec && textSpec.fontFamily ? textSpec.fontFamily : "unknown"} uuid=${fontUuid} error=${err ? String(err.message || err) : "unknown"}`,
                );
                label.useSystemFont = true;
                label.font = null;
                label.fontFamily = textSpec.fontFamily || "Arial";
            }
            done();
        });
    });
};

const applyDesignTextStyle = (node, textSpec, pendingLoads) => {
    if (!textSpec) {
        return;
    }
    const label = node.getComponent(cc.Label) || node.addComponent(cc.Label);
    label.string = textSpec.content || "";
    label.fontSize = textSpec.fontSize || 24;
    label.lineHeight = textSpec.lineHeight || label.fontSize;
    label.enableWrapText = true;
    enqueueDesignFontLoad(label, textSpec, pendingLoads || []);
    applyDefaultLabelPolicy(label);
    label.horizontalAlign =
        textSpec.horizontalAlign === "RIGHT"
            ? cc.Label.HorizontalAlign.RIGHT
            : textSpec.horizontalAlign === "CENTER"
                ? cc.Label.HorizontalAlign.CENTER
                : cc.Label.HorizontalAlign.LEFT;
    label.verticalAlign = cc.Label.VerticalAlign.CENTER;

    if (textSpec.color) {
        node.color = new cc.Color(
            textSpec.color.r,
            textSpec.color.g,
            textSpec.color.b,
            textSpec.color.a,
        );
    }

    if (textSpec.outline) {
        const outline = node.getComponent(cc.LabelOutline) || node.addComponent(cc.LabelOutline);
        outline.width = textSpec.outline.width || 1;
        outline.color = new cc.Color(
            textSpec.outline.color.r,
            textSpec.outline.color.g,
            textSpec.outline.color.b,
            textSpec.outline.color.a,
        );
    }

    if (textSpec.shadow) {
        const shadow = node.getComponent(cc.LabelShadow) || node.addComponent(cc.LabelShadow);
        shadow.offset = cc.v2(textSpec.shadow.offsetX || 0, -(textSpec.shadow.offsetY || 0));
        shadow.blur = textSpec.shadow.blur || 0;
        shadow.color = new cc.Color(
            textSpec.shadow.color.r,
            textSpec.shadow.color.g,
            textSpec.shadow.color.b,
            textSpec.shadow.color.a,
        );
    }
};

const joinImportedDesignPath = (pathSegments, nodeName) => [...(pathSegments || []), nodeName || "DesignNode"].join(" / ");

const IMPORTED_SPRITE_HOST_TAG = "__mcpImportedSpriteHost";

const isImportedDesignSpriteHostNode = (node) => !!(node && node[IMPORTED_SPRITE_HOST_TAG]);

const findImportedDesignSpriteHostNode = (node) => {
    if (!node || !node.children || !node.children.length) {
        return null;
    }
    return node.children.find((child) => isImportedDesignSpriteHostNode(child)) || null;
};

const buildImportedDesignSpriteHostName = (nodeName) => {
    if (!nodeName) {
        return "imgBgHost";
    }
    if (nodeName.startsWith("lab")) {
        return `img${nodeName.slice(3)}Bg`;
    }
    return `${nodeName}Bg`;
};

const resolveImportedDesignSpriteTarget = (node, spec, path) => {
    let sprite = node.getComponent(cc.Sprite);
    if (sprite) {
        return { hostNode: node, sprite };
    }

    sprite = node.addComponent(cc.Sprite);
    if (sprite) {
        return { hostNode: node, sprite };
    }

    const label = node.getComponent(cc.Label) || node.getComponent(cc.RichText);
    if (label) {
        let hostNode = findImportedDesignSpriteHostNode(node);
        if (!hostNode) {
            hostNode = new cc.Node(buildImportedDesignSpriteHostName(node.name));
            hostNode[IMPORTED_SPRITE_HOST_TAG] = true;
            hostNode.anchorX = 0.5;
            hostNode.anchorY = 0.5;
            hostNode.x = 0;
            hostNode.y = 0;
            hostNode.width = node.width;
            hostNode.height = node.height;
            hostNode.opacity = 255;
            node.addChild(hostNode);
            hostNode.setSiblingIndex(0);
        }
        sprite = hostNode.getComponent(cc.Sprite) || hostNode.addComponent(cc.Sprite);
        if (sprite) {
            return { hostNode, sprite };
        }
    }

    const componentNames = (node._components || []).map((component) => cc.js.getClassName(component));
    throw new Error(
        `[import_design_layout] 无法为节点挂载 cc.Sprite path=${path} name=${node.name} components=${componentNames.join(",") || "none"} hasText=${!!spec.text} isButton=${!!spec.isButton}`,
    );
};

const reconcileImportedDesignNodeSize = (node, spec, importDiagnostics, pathSegments) => {
    if (!node || !spec) {
        return;
    }

    const visual = spec.visual || null;
    const path = joinImportedDesignPath(pathSegments, spec.name);
    const beforeSize = captureImportedNodeSize(node);
    const spriteHostNode = (node.getComponent && node.getComponent(cc.Sprite))
        ? node
        : findImportedDesignSpriteHostNode(node);
    const sprite = spriteHostNode && spriteHostNode.getComponent ? spriteHostNode.getComponent(cc.Sprite) : null;
    const beforeMode = sprite ? resolveSpriteSizeModeName(sprite.sizeMode) : null;
    const beforeType = sprite ? resolveSpriteTypeName(sprite.type) : null;
    const finalPreferredMode = resolveImportedSpritePreferredMode(visual, beforeMode);

    if (visual && finalPreferredMode === "CUSTOM" && hasValidImportedDesignSize(spec.size)) {
        if (sprite) {
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            sprite.type = cc.Sprite.Type.SLICED;
        }
        preserveImportedSpriteNodeSize(spriteHostNode || node, visual, spec.size, finalPreferredMode);
        const afterSize = captureImportedNodeSize(spriteHostNode || node);
        const afterMode = sprite ? resolveSpriteSizeModeName(sprite.sizeMode) : null;
        const afterType = sprite ? resolveSpriteTypeName(sprite.type) : null;
        importDiagnostics.push({
            phase: "finalize",
            path,
            assetPath: visual.assetPath || null,
            spriteFrameUuid: visual.spriteFrameUuid || null,
            designSize: {
                width: Number(spec.size.width),
                height: Number(spec.size.height),
            },
            finalPreferredMode,
            nodeSizeBefore: beforeSize,
            nodeSizeAfter: afterSize,
            spriteModeBefore: beforeMode,
            spriteModeAfter: afterMode,
            spriteTypeBefore: beforeType,
            spriteTypeAfter: afterType,
        });
    }

    const childNodes = (node.children || []).filter((child) => !isImportedDesignSpriteHostNode(child));
    const childSpecs = spec.children || [];
    const childCount = Math.max(childNodes.length, childSpecs.length);
    for (let index = 0; index < childCount; index++) {
        const childNode = childNodes[index];
        const childSpec = childSpecs[index];
        if (!childNode || !childSpec) {
            importDiagnostics.push({
                phase: "tree-mismatch",
                path,
                childIndex: index,
                hasNode: !!childNode,
                hasSpec: !!childSpec,
            });
            continue;
        }
        reconcileImportedDesignNodeSize(childNode, childSpec, importDiagnostics, [...(pathSegments || []), spec.name]);
    }
};

const enqueueDesignSpriteLoad = (node, spec, pendingLoads, uiPolicy, importDiagnostics, pathSegments) => {
    const visual = spec && spec.visual;
    if (!visual || !visual.spriteFrameUuid) {
        return;
    }
    const designSize = spec && spec.size;
    const path = joinImportedDesignPath(pathSegments, spec.name);

    const { hostNode: spriteHostNode, sprite } = resolveImportedDesignSpriteTarget(node, spec, path);
    sprite.sizeMode =
        visual.preferredSizeMode === "CUSTOM" ? cc.Sprite.SizeMode.CUSTOM : cc.Sprite.SizeMode.RAW;
    sprite.type = visual.useSliced ? cc.Sprite.Type.SLICED : cc.Sprite.Type.SIMPLE;

    pendingLoads.push((done) => {
        cc.assetManager.loadAny(visual.spriteFrameUuid, (err, asset) => {
            const beforeSize = captureImportedNodeSize(spriteHostNode);
            if (!err && asset) {
                sprite.spriteFrame = asset instanceof cc.SpriteFrame ? asset : new cc.SpriteFrame(asset);
                const spriteModeInfo = applyPreferredSpriteSizeMode(
                    sprite,
                    uiPolicy,
                    visual.spriteFrameUuid,
                    visual.preferredSizeMode,
                );
                preserveImportedSpriteNodeSize(
                    spriteHostNode,
                    visual,
                    designSize,
                    spriteModeInfo.appliedPreferredMode,
                );
                importDiagnostics.push({
                    phase: "asset-load",
                    path,
                    assetPath: visual.assetPath || null,
                    spriteFrameUuid: visual.spriteFrameUuid || null,
                    designPreferredMode: visual.preferredSizeMode || null,
                    detectedPreferredMode: spriteModeInfo.detectedPreferredMode,
                    appliedPreferredMode: spriteModeInfo.appliedPreferredMode,
                    textureName: spriteModeInfo.textureName || null,
                    designSize: hasValidImportedDesignSize(designSize)
                        ? {
                              width: Number(designSize.width),
                              height: Number(designSize.height),
                          }
                        : null,
                    sizePreserveMode: resolveImportedSpritePreferredMode(
                        visual,
                        spriteModeInfo.appliedPreferredMode,
                    ),
                    nodeSizeBefore: beforeSize,
                    nodeSizeAfter: captureImportedNodeSize(spriteHostNode),
                    spriteModeAfter: resolveSpriteSizeModeName(sprite.sizeMode),
                    spriteTypeAfter: resolveSpriteTypeName(sprite.type),
                });
            } else {
                importDiagnostics.push({
                    phase: "asset-load-error",
                    path,
                    assetPath: visual.assetPath || null,
                    spriteFrameUuid: visual.spriteFrameUuid || null,
                    error: err ? String(err.message || err) : "unknown-load-error",
                });
            }
            done();
        });
    });
};

const createImportedDesignNode = (spec, pendingLoads, uiPolicy, importDiagnostics, pathSegments = []) => {
    const node = new cc.Node(spec.name || "DesignNode");
    node.anchorX = 0.5;
    node.anchorY = 0.5;
    node.x = spec.position ? spec.position.x || 0 : 0;
    node.y = spec.position ? spec.position.y || 0 : 0;
    node.width = spec.size ? spec.size.width || 0 : 0;
    node.height = spec.size ? spec.size.height || 0 : 0;
    node.opacity = spec.opacity === undefined ? 255 : spec.opacity;
    node.rotation = spec.rotation || 0;
    node.active = spec.visible !== false;

    if (spec.text) {
        applyDesignTextStyle(node, spec.text, pendingLoads);
    }

    enqueueDesignSpriteLoad(node, spec, pendingLoads, uiPolicy, importDiagnostics, pathSegments);

    if (spec.isButton && !node.getComponent(cc.Button)) {
        applyDefaultButtonPolicy(node.addComponent(cc.Button));
    }

    (spec.children || []).forEach((childSpec) => {
        node.addChild(
            createImportedDesignNode(
                childSpec,
                pendingLoads,
                uiPolicy,
                importDiagnostics,
                [...pathSegments, spec.name],
            ),
        );
    });

    return node;
};

const countImportedDesignNodes = (spec) => {
    if (!spec) {
        return 0;
    }
    return 1 + (spec.children || []).reduce((sum, child) => sum + countImportedDesignNodes(child), 0);
};

const runPendingDesignLoads = (pendingLoads, done) => {
    if (!pendingLoads || pendingLoads.length === 0) {
        done();
        return;
    }
    let index = 0;
    const next = () => {
        if (index >= pendingLoads.length) {
            done();
            return;
        }
        const task = pendingLoads[index++];
        task(() => next());
    };
    next();
};

export = {
    /**
     * 修改节点的基础属性
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (id, path, value)
     */
    "set-property": function (event, args) {
        const { id, path, value } = args;

        // 1. 获取节点
        let node = findNode(id);

        if (node) {
            // 2. 修改属性
            if (path === "name") {
                node.name = value;
            } else {
                node[path] = value;
            }

            // 3. 【解决报错的关键】告诉编辑器场景变脏了（需要保存）
            // 在场景进程中，我们发送 IPC 给主进程
            Editor.Ipc.sendToMain("scene:dirty");

            // 4. 【额外补丁】通知层级管理器（Hierarchy）同步更新节点名称
            // 否则你修改了名字，层级管理器可能还是显示旧名字
            Editor.Ipc.sendToAll("scene:node-changed", {
                uuid: id,
            });

            if (event.reply) {
                event.reply(null, `节点 ${id} 已更新为 ${value}`);
            }
        } else {
            if (event.reply) {
                event.reply(new Error("场景脚本：找不到节点 " + id));
            }
        }
    },
    /**
     * 获取当前场景的完整层级树
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (nodeId, depth, includeDetails)
     */
    "get-hierarchy": function (event, args) {
        const { nodeId = null, depth = 2, includeDetails = false } = args || {};
        const scene = cc.director.getScene();

        let rootNode = scene;
        if (nodeId) {
            rootNode = findNode(nodeId);
            if (!rootNode) {
                if (event.reply) event.reply(new Error(`找不到指定的起始节点: ${nodeId}`));
                return;
            }
        }

        /**
         * 递归遍历并序列化节点树
         * @param {cc.Node} node 目标节点
         * @param {number} currentDepth 当前深度
         * @returns {Object|null} 序列化后的节点数据
         */
        function dumpNodes(node, currentDepth) {
            // 【优化】跳过编辑器内部的私有节点，减少数据量
            if (
                !node ||
                !node.name ||
                (typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot"))
            ) {
                return null;
            }

            let nodeData: any = {
                name: node.name,
                uuid: node.uuid,
                childrenCount: node.childrenCount,
            };

            const comps = node._components || [];

            // 根据是否需要详情来决定附加哪些数据以节省 Token
            if (includeDetails) {
                nodeData.active = node.active;
                nodeData.position = { x: Math.round(node.x), y: Math.round(node.y) };
                nodeData.rotation = node.angle;
                nodeData.scale = { x: node.scaleX, y: node.scaleY };
                nodeData.anchor = { x: node.anchorX, y: node.anchorY };
                nodeData.size = { width: node.width, height: node.height };
                nodeData.color = { r: node.color.r, g: node.color.g, b: node.color.b };
                nodeData.opacity = node.opacity;
                nodeData.skew = { x: node.skewX, y: node.skewY };
                nodeData.group = node.group;
                nodeData.components = comps.map((c) => cc.js.getClassName(c));
            } else {
                // 简略模式下如果存在组件，至少提供一个极简列表让 AI 知道节点的作用
                if (comps.length > 0) {
                    nodeData.components = comps.map((c) => {
                        const parts = (cc.js.getClassName(c) || "").split(".");
                        return parts[parts.length - 1]; // 只取类名，例如 cc.Sprite -> Sprite
                    });
                }
            }

            // 如果未超出深度限制，继续递归子树（每层最多返回 50 个子节点作为安全上限）
            const MAX_CHILDREN_PER_LEVEL = 50;
            if (currentDepth < depth && node.childrenCount > 0) {
                nodeData.children = [];
                const childLimit = Math.min(node.childrenCount, MAX_CHILDREN_PER_LEVEL);
                for (let i = 0; i < childLimit; i++) {
                    let childData = dumpNodes(node.children[i], currentDepth + 1);
                    if (childData) nodeData.children.push(childData);
                }
                if (node.childrenCount > MAX_CHILDREN_PER_LEVEL) {
                    nodeData.childrenTruncated = node.childrenCount - MAX_CHILDREN_PER_LEVEL;
                }
            }

            return nodeData;
        }

        const hierarchy = dumpNodes(rootNode, 0);
        if (event.reply) event.reply(null, hierarchy);
    },

    /**
     * 批量更新节点的变换信息 (坐标、缩放、颜色等)
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (id, x, y, rotation, scaleX, scaleY, anchorX, anchorY, color, opacity, skewX, skewY, width, height)
     */
    "update-node-transform": function (event, args) {
        const { id, x, y, scaleX, scaleY, color } = args;

        let node = findNode(id);

        if (node) {
            // 直接赋值，确保同步生效
            if (x !== undefined) {
                node.x = Number(x);
            }
            if (y !== undefined) {
                node.y = Number(y);
            }
            if (args.rotation !== undefined) {
                node.angle = Number(args.rotation);
            }
            if (args.width !== undefined) {
                node.width = Number(args.width);
            }
            if (args.height !== undefined) {
                node.height = Number(args.height);
            }
            if (scaleX !== undefined) {
                node.scaleX = Number(scaleX);
            }
            if (scaleY !== undefined) {
                node.scaleY = Number(scaleY);
            }
            if (args.anchorX !== undefined) {
                node.anchorX = Number(args.anchorX);
            }
            if (args.anchorY !== undefined) {
                node.anchorY = Number(args.anchorY);
            }
            if (color) {
                node.color = new cc.Color().fromHEX(color);
            }
            if (args.opacity !== undefined) {
                node.opacity = Number(args.opacity);
            }
            if (args.skewX !== undefined) {
                node.skewX = Number(args.skewX);
            }
            if (args.skewY !== undefined) {
                node.skewY = Number(args.skewY);
            }
            if (args.active !== undefined) {
                node.active = !!args.active;
            }

            Editor.Ipc.sendToMain("scene:dirty");
            Editor.Ipc.sendToAll("scene:node-changed", { uuid: id });

            if (event.reply) event.reply(null, "变换信息已更新");
        } else {
            if (event.reply) event.reply(new Error("找不到节点"));
        }
    },
    /**
     * 在场景中创建新节点
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (name, parentId, type)
     */
    "create-node": function (event, args) {
        const { name, parentId, type } = args;
        const scene = cc.director.getScene();
        const resolvedCreateNodePolicy = resolveCreateNodePolicy(args.uiPolicy, args);
        if (!scene) {
            if (event.reply) event.reply(new Error("场景尚未准备好或正在加载。"));
            return;
        }

        let newNode = null;

        // 特殊处理：如果是创建 Canvas，自动设置好适配
        if (type === "canvas" || name === "Canvas") {
            newNode = new cc.Node("Canvas");
            let canvas = newNode.addComponent(cc.Canvas);
            newNode.addComponent(cc.Widget);
            // 设置默认设计分辨率
            const designResolution =
                (args.uiPolicy &&
                    args.uiPolicy.canvas &&
                    args.uiPolicy.canvas.designResolution) || { width: 960, height: 640 };
            canvas.designResolution = cc.size(designResolution.width, designResolution.height);
            canvas.fitWidth =
                !!(args.uiPolicy && args.uiPolicy.canvas && args.uiPolicy.canvas.fitWidth);
            canvas.fitHeight =
                args.uiPolicy && args.uiPolicy.canvas && args.uiPolicy.canvas.fitHeight !== undefined
                    ? !!args.uiPolicy.canvas.fitHeight
                    : true;
            // 自动在 Canvas 下创建一个 Camera
            let camNode = new cc.Node("Main Camera");
            camNode.addComponent(cc.Camera);
            camNode.parent = newNode;
        } else if (type === "sprite") {
            newNode = new cc.Node(name || "新建精灵节点");
            let sprite = newNode.addComponent(cc.Sprite);
            // 默认先用 RAW，真实赋图后会根据是否为点9自动切换
            sprite.sizeMode = cc.Sprite.SizeMode.RAW;
            // 为精灵设置默认尺寸
            newNode.width = 100;
            newNode.height = 100;

            // 加载引擎默认图做占位
            if (args.defaultSpriteUuid) {
                cc.assetManager.loadAny(args.defaultSpriteUuid, (err, asset) => {
                    if (!err && (asset instanceof cc.SpriteFrame || asset instanceof cc.Texture2D)) {
                        const spriteFrame = asset instanceof cc.SpriteFrame ? asset : new cc.SpriteFrame(asset);
                        sprite.spriteFrame = spriteFrame;
                        applyPreferredSpriteSizeMode(
                            sprite,
                            args.uiPolicy,
                            getSpriteFrameUuid(spriteFrame),
                            null,
                        );
                        Editor.Ipc.sendToMain("scene:dirty");
                    }
                });
            }
        } else if (type === "button") {
            newNode = new cc.Node(name || "新建按钮节点");
            let sprite = newNode.addComponent(cc.Sprite);
            applyDefaultButtonPolicy(newNode.addComponent(cc.Button));

            // 设置为 CUSTOM 模式并应用按钮专用尺寸
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            newNode.width = 150;
            newNode.height = 50;

            // 设置稍暗的背景颜色 (#A0A0A0)，以便于看清其上的文字
            newNode.color = new cc.Color(160, 160, 160);

            // 加载引擎默认图
            if (args.defaultSpriteUuid) {
                cc.assetManager.loadAny(args.defaultSpriteUuid, (err, asset) => {
                    if (!err && (asset instanceof cc.SpriteFrame || asset instanceof cc.Texture2D)) {
                        sprite.spriteFrame = asset instanceof cc.SpriteFrame ? asset : new cc.SpriteFrame(asset);
                        Editor.Ipc.sendToMain("scene:dirty");
                    }
                });
            }
        } else if (type === "label") {
            newNode = new cc.Node(name || "新建文本节点");
            let l = newNode.addComponent(cc.Label);
            l.string = "新文本";
            applyDefaultLabelPolicy(l);
            newNode.width = 120;
            newNode.height = 40;
        } else {
            newNode = new cc.Node(name || "新建节点");
        }

        applyResolvedUiPolicyToNode(newNode, resolvedCreateNodePolicy);

        // 设置层级
        let parent = null;
        if (parentId) {
            parent = findNode(parentId);
        } else {
            // 【Canvas Sniffing】如果是 UI 节点且未指定 parentId，尝试挂载到 Canvas
            if (resolvedCreateNodePolicy.autoParentToCanvas) {
                const canvasComp = getCanvasComponent(scene);
                if (canvasComp) {
                    parent = canvasComp.node;
                }
            }
            if (!parent) parent = scene;
        }
        if (parent) {
            newNode.parent = parent;

            // 不要在这里同步调用 widget.updateAlignment()，因为此刻场景树的世界矩阵可能未刷新，
            // 导致 cc.Widget 计算出双倍的错误坐标（如将 405 算成 810）。
            // 让 Cocos 引擎在下一帧自动接管并对齐！

            // 【优化】通知主进程场景变脏
            Editor.Ipc.sendToMain("scene:dirty");

            // 【关键】使用 setTimeout 延迟通知 UI 刷新，让出主循环
            setTimeout(() => {
                Editor.Ipc.sendToAll("scene:node-created", {
                    uuid: newNode.uuid,
                    parentUuid: parent.uuid,
                });
            }, 10);

            if (event.reply) {
                // 如果父节点有 Canvas，返回设计分辨率信息
                let canvasInfo = "";
                let canvasComp = parent.getComponent(cc.Canvas);
                if (canvasComp) {
                    canvasInfo = `CanvasSize(${parent.width}x${parent.height}) Design(${canvasComp.designResolution.width}x${canvasComp.designResolution.height})`;
                }
                const policyInfo = resolvedCreateNodePolicy.presetName
                    ? ` UiPreset(${resolvedCreateNodePolicy.presetName})`
                    : "";
                event.reply(null, `节点创建成功 UUID: ${newNode.uuid}, 已挂载至 ${parent.name}${canvasInfo ? ' ' + canvasInfo : ''}${policyInfo}. ComputedPos: (${newNode.x}, ${newNode.y})`);
            }
        } else {
            if (event.reply) event.reply(new Error(`无法创建节点：找不到父节点 ${parentId}`));
        }
    },

    "apply-ui-policy": function (event, args) {
        const { nodeId, preset } = args;
        const node = findNode(nodeId);
        if (!node) {
            if (event.reply) event.reply(new Error(`找不到节点: ${nodeId}`));
            return;
        }

        const resolvedPreset = resolveNamedUiPreset(args.uiPolicy, preset);
        if (!resolvedPreset.presetName) {
            if (event.reply) event.reply(new Error(`未知的 UI 预设: ${preset}`));
            return;
        }

        applyResolvedUiPolicyToNode(node, resolvedPreset);
        Editor.Ipc.sendToMain("scene:dirty");
        Editor.Ipc.sendToAll("scene:node-changed", {
            uuid: node.uuid,
        });

        if (event.reply) {
            event.reply(null, `已将 UI 预设 ${resolvedPreset.presetName} 应用到节点 ${node.name} (${node.uuid})`);
        }
    },

    "validate-ui-prefab": function (event, args) {
        const { nodeId, expectedRootPreset } = args;
        const node = findNode(nodeId);
        if (!node) {
            if (event.reply) event.reply(new Error(`找不到节点: ${nodeId}`));
            return;
        }

        const snapshot = snapshotNodeForValidation(node);
        const result = validateUiTree(args.uiPolicy, snapshot, {
            expectedRootPreset,
        });

        if (event.reply) {
            event.reply(null, result);
        }
    },

    /**
     * 管理节点上的组件 (添加、移除、更新属性)
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (nodeId, action, componentType, componentId, properties)
     */
    "manage-components": function (event, args) {
        let { nodeId, action, operation, componentType, componentId, properties } = args;
        // 兼容 AI 幻觉带来的传参错误
        action = action || operation;

        let node = findNode(nodeId);

        /**
         * 辅助函数：应用属性并智能解析 (支持 UUID 资源与节点引用)
         * @param {cc.Component} component 目标组件实例
         * @param {Object} props 待更新的属性键值对
         */
        const applyProperties = (component, props) => {
            if (!props) return;
            // 尝试获取组件类的属性定义
            const compClass = component.constructor;

            for (const [key, value] of Object.entries(props)) {
                // 【防呆设计】拦截对核心只读属性的非法重写
                // 如果直接修改组件的 node 属性，会导致该引用丢失变成普通对象，进而引发编辑器卡死
                if (key === "node" || key === "uuid" || key === "_id") {
                    Editor.warn(
                        `[scene-script] 拒绝覆盖组件的只读/核心属性: ${key}。请勿对组件执行此操作，修改位置/激活状态等请操作 Node 节点！`,
                    );
                    continue;
                }

                // 【核心修复】专门处理各类事件属性 (ClickEvents, ScrollEvents 等)
                const isEventProp =
                    Array.isArray(value) && (key.toLowerCase().endsWith("events") || key === "clickEvents");

                if (isEventProp) {
                    const eventHandlers = [];
                    for (const item of value) {
                        if (typeof item === "object" && (item.target || item.component || item.handler)) {
                            const handler = new cc.Component.EventHandler();

                            // 解析 Target Node
                            if (item.target) {
                                let targetNode = findNode(item.target);
                                if (!targetNode && item.target instanceof cc.Node) {
                                    targetNode = item.target;
                                }

                                if (targetNode) {
                                    handler.target = targetNode;
                                }
                            }

                            if (item.component) handler.component = item.component;
                            if (item.handler) handler.handler = item.handler;
                            if (item.customEventData !== undefined)
                                handler.customEventData = String(item.customEventData);

                            eventHandlers.push(handler);
                        } else {
                            // 如果不是对象，原样保留
                            eventHandlers.push(item);
                        }
                    }
                    component[key] = eventHandlers;
                    continue; // 处理完事件数组，跳出本次循环
                }

                // 检查属性是否存在
                if (component[key] !== undefined) {
                    let finalValue = value;

                    // 【核心逻辑】智能类型识别与赋值
                    try {
                        const attrs = (cc.Class.Attr.getClassAttrs && cc.Class.Attr.getClassAttrs(compClass)) || {};
                        let propertyType = attrs[key] ? attrs[key].type : null;
                        if (!propertyType && attrs[key + "$_$ctor"]) {
                            propertyType = attrs[key + "$_$ctor"];
                        }

                        let isAsset =
                            propertyType &&
                            (propertyType.prototype instanceof cc.Asset ||
                                propertyType === cc.Asset ||
                                propertyType === cc.Prefab ||
                                propertyType === cc.SpriteFrame);
                        let isAssetArray =
                            Array.isArray(value) && (key === "materials" || key.toLowerCase().includes("assets"));

                        // 启发式：如果属性名包含 prefab/sprite/texture 等，且值为 UUID 且不是节点
                        if (!isAsset && !isAssetArray && typeof value === "string" && value.length > 20) {
                            const lowerKey = key.toLowerCase();
                            const assetKeywords = [
                                "prefab",
                                "sprite",
                                "texture",
                                "material",
                                "skeleton",
                                "spine",
                                "atlas",
                                "font",
                                "audio",
                                "data",
                            ];
                            if (assetKeywords.some((k) => lowerKey.includes(k))) {
                                if (!findNode(value)) {
                                    isAsset = true;
                                }
                            }
                        }

                        if (isAsset || isAssetArray) {
                            // 1. 处理资源引用 (单个或数组)
                            const uuids: any[] = isAssetArray ? (value as any[]) : [value];
                            const loadedAssets = [];
                            let loadedCount = 0;
                            const autoNineSliceCandidateUuids = [];

                            if (uuids.length === 0) {
                                component[key] = [];
                                return;
                            }

                            const fs = require("fs");
                            const path = require("path");

                            uuids.forEach((uuid, idx) => {
                                if (typeof uuid !== "string" || uuid.length < 10) {
                                    loadedCount++;
                                    return;
                                }

                                // 尝试进行自动转换：如果这是原图，且需要 SpriteFrame，自动读取其 meta 获取子 UUID
                                const needsSpriteFrame =
                                    propertyType === cc.SpriteFrame || key.toLowerCase().includes("sprite");

                                let targetUuid = uuid;

                                if (needsSpriteFrame && Editor && Editor.assetdb && Editor.assetdb.remote) {
                                    try {
                                        const fspath = Editor.assetdb.remote.uuidToFspath(uuid);
                                        if (fspath) {
                                            const metaPath = fspath + ".meta";
                                            if (fs.existsSync(metaPath)) {
                                                const metaContent = fs.readFileSync(metaPath, "utf-8");
                                                const metaObj = JSON.parse(metaContent);
                                                // Creator 2.x 图片的 subMetas 里通常存储着以图片名命名的 spriteFrame
                                                if (metaObj && metaObj.subMetas) {
                                                    const subKeys = Object.keys(metaObj.subMetas);
                                                    // 如果有子 spriteFrame，提取它的 uuid
                                                    for (const subKey of subKeys) {
                                                        const subMeta = metaObj.subMetas[subKey];
                                                        if (subMeta && (subMeta.uuid || subMeta.rawTextureUuid)) {
                                                            targetUuid = subMeta.uuid;
                                                            Editor.log(
                                                                `[scene-script] 自动转换 UUID: ${uuid} (Texture2D) -> ${targetUuid} (SpriteFrame)`,
                                                            );
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    } catch (err) {
                                        Editor.log(`[scene-script] 读取 meta 失败: ${err.message}`);
                                    }
                                }

                                cc.AssetLibrary.loadAsset(targetUuid, (err, asset) => {
                                    loadedCount++;
                                    if (!err && asset) {
                                        // 判断是否依然是 Texture2D，并且需要 SpriteFrame
                                        const stillIsTexture = asset instanceof cc.Texture2D && needsSpriteFrame;

                                        if (stillIsTexture) {
                                            Editor.warn(
                                                `[scene-script] 拒绝为 ${key}[${idx}] 赋值：给 SpriteFrame 属性传递了 Texture2D (原图) 的 UUID ${targetUuid}。自动转换失败，请使用正确的 SpriteFrame UUID。`,
                                            );
                                        } else {
                                            loadedAssets[idx] = asset;
                                            if (needsSpriteFrame && typeof targetUuid === "string") {
                                                autoNineSliceCandidateUuids.push(targetUuid);
                                            }
                                        }
                                    } else {
                                        Editor.warn(
                                            `[scene-script] 未能为 ${key}[${idx}] 加载资源 ${targetUuid}: ${err}`,
                                        );
                                    }

                                    if (loadedCount === uuids.length) {
                                        if (isAssetArray) {
                                            // 过滤掉加载失败的
                                            component[key] = loadedAssets.filter((a) => !!a);
                                        } else {
                                            if (loadedAssets[0]) component[key] = loadedAssets[0];
                                            if (
                                                component instanceof cc.Sprite &&
                                                key === "spriteFrame" &&
                                                autoNineSliceCandidateUuids.length > 0
                                            ) {
                                                applyPreferredSpriteSizeMode(
                                                    component,
                                                    args.uiPolicy,
                                                    autoNineSliceCandidateUuids[0],
                                                    null,
                                                );
                                            }
                                        }

                                        // 通知编辑器 UI 更新
                                        const compIndex = node._components.indexOf(component);
                                        if (compIndex !== -1) {
                                            Editor.Ipc.sendToPanel("scene", "scene:set-property", {
                                                id: node.uuid,
                                                path: `_components.${compIndex}.${key}`,
                                                type: isAssetArray ? "Array" : "Object",
                                                value: isAssetArray ? uuids.map((u) => ({ uuid: u })) : { uuid: value },
                                                isSubProp: false,
                                            });
                                        }
                                        Editor.Ipc.sendToMain("scene:dirty");
                                        Array.from(new Set(autoNineSliceCandidateUuids)).forEach((candidateUuid) => {
                                            Editor.Ipc.sendToMain("mcp-bridge:auto-ensure-nine-slice-for-asset", {
                                                uuid: candidateUuid,
                                            });
                                        });
                                    }
                                });
                            });
                            // 【重要修复】使用 continue 而不是 return，确保处理完 Asset 属性后
                            // 还能继续处理后续的普通属性 (如 type, sizeMode 等)
                            continue;
                        } else if (
                            propertyType &&
                            (propertyType.prototype instanceof cc.Component ||
                                propertyType === cc.Component ||
                                propertyType === cc.Node)
                        ) {
                            // 2. 处理节点或组件引用
                            const targetNode = findNode(value);
                            if (targetNode) {
                                if (propertyType === cc.Node) {
                                    finalValue = targetNode;
                                } else {
                                    const targetComp = targetNode.getComponent(propertyType);
                                    if (targetComp) {
                                        finalValue = targetComp;
                                    } else {
                                        Editor.warn(
                                            `[scene-script] 在节点 ${targetNode.name} 上找不到组件 ${propertyType.name}`,
                                        );
                                    }
                                }
                            } else if (value && (value as string).length > 20) {
                                // 如果明确是组件/节点类型但找不到，才报错
                                Editor.warn(`[scene-script] 无法解析 ${key} 的目标节点/组件: ${value}`);
                            }
                        } else {
                            // 3. 通用启发式 (找不到类型时的 fallback)
                            if (typeof value === "string" && value.length > 20) {
                                const targetNode = findNode(value);
                                if (targetNode) {
                                    finalValue = targetNode;
                                } else {
                                    // 找不到节点且是 UUID -> 视为资源
                                    const compIndex = node._components.indexOf(component);
                                    if (compIndex !== -1) {
                                        Editor.Ipc.sendToPanel("scene", "scene:set-property", {
                                            id: node.uuid,
                                            path: `_components.${compIndex}.${key}`,
                                            type: "Object",
                                            value: { uuid: value },
                                            isSubProp: false,
                                        });
                                    }
                                    continue;
                                }
                            }
                        }
                    } catch (e) {
                        Editor.warn(`[scene-script] 解析属性 ${key} 失败: ${e.message}`);
                    }

                    component[key] = finalValue;
                }
            }
        };

        if (!node) {
            if (event.reply) event.reply(new Error("找不到节点"));
            return;
        }

        switch (action) {
            case "add":
                if (!componentType) {
                    if (event.reply) event.reply(new Error("必须提供组件类型"));
                    return;
                }

                // 容错：自动纠正 AI 可能混淆的 3.x 等组件名称
                const COMPONENT_ALIAS_MAP: Record<string, string> = {
                    "cc.BoxCollider2D": "cc.BoxCollider",
                    "cc.Collider2D": "cc.Collider",
                    "cc.TiledAtlas": "cc.TiledMap",
                    "cc.UITransform": "cc.Widget",
                    "cc.SpriteBox": "cc.Sprite",
                };

                if (COMPONENT_ALIAS_MAP[componentType]) {
                    componentType = COMPONENT_ALIAS_MAP[componentType];
                }

                // 【防呆设计】拦截 AI 错误地将 cc.Node 作为组件添加
                if (componentType === "cc.Node" || componentType === "Node") {
                    if (event.reply) {
                        event.reply(
                            new Error(
                                "【纠错提示】cc.Node 是节点而不是组件，无法被当做组件添加！\n" +
                                "- 如果你想创建带有名字的子节点，请不要使用 manage_components，而是使用 create-node (或相应的创建节点工具)。\n" +
                                "- 如果你想修改现有节点的 name 属性，请使用修改节点的 set-property 工具。",
                            ),
                        );
                    }
                    return;
                }

                try {
                    // 解析组件类型
                    let compClass = null;
                    if (componentType.startsWith("cc.")) {
                        const className = componentType.replace("cc.", "");
                        compClass = cc[className];
                    } else {
                        // 尝试获取自定义组件
                        compClass = cc.js.getClassByName(componentType);
                        if (!compClass && cc[componentType]) {
                            compClass = cc[componentType];
                        }
                    }

                    if (!compClass) {
                        if (event.reply) event.reply(new Error(`找不到组件类型: ${componentType}`));
                        return;
                    }

                    // 【防呆设计】确保获取到的类是一个组件
                    if (!cc.js.isChildClassOf(compClass, cc.Component)) {
                        if (event.reply) {
                            event.reply(
                                new Error(
                                    `【错误】'${componentType}' 不是一个合法的组件类型（必须继承自 cc.Component）。请确认你的意图。`,
                                ),
                            );
                        }
                        return;
                    }

                    // 添加组件
                    let component = node.addComponent(compClass);

                    if (!component) {
                        // 引擎底层 (如 _checkMultipleComp) 可能拦截了唯一组件，导致返回 null
                        component = node.getComponent(compClass);
                        if (!component) {
                            if (event.reply) event.reply(new Error(`添加组件失败，引擎返回 null 且未找到已有同类组件: ${componentType}`));
                            return;
                        }
                    }

                    if (component instanceof cc.Button) {
                        applyDefaultButtonPolicy(component);
                    }

                    // 设置属性
                    if (properties) {
                        applyProperties(component, properties);
                    }

                    Editor.Ipc.sendToMain("scene:dirty");
                    Editor.Ipc.sendToAll("scene:node-changed", { uuid: nodeId });

                    if (event.reply) event.reply(null, `组件 ${componentType} 已添加`);
                } catch (err) {
                    if (event.reply) event.reply(new Error(`添加组件失败: ${err.message}`));
                }
                break;

            case "remove":
                if (!componentId && !componentType) {
                    if (event.reply) event.reply(new Error("必须提供组件 ID 或组件类型(componentType)"));
                    return;
                }

                try {
                    // 查找并移除组件
                    let component = null;
                    if (componentId) {
                        if (node._components) {
                            for (let i = 0; i < node._components.length; i++) {
                                if (node._components[i].uuid === componentId) {
                                    component = node._components[i];
                                    break;
                                }
                            }
                        }
                    } else if (componentType) {
                        let compClass = null;
                        if (componentType.startsWith("cc.")) {
                            const className = componentType.replace("cc.", "");
                            compClass = cc[className];
                        } else {
                            compClass = cc.js.getClassByName(componentType);
                            if (!compClass && cc[componentType]) {
                                compClass = cc[componentType];
                            }
                        }
                        if (compClass) {
                            component = node.getComponent(compClass);
                        }
                    }

                    if (component) {
                        node.removeComponent(component);
                        Editor.Ipc.sendToMain("scene:dirty");
                        Editor.Ipc.sendToAll("scene:node-changed", { uuid: nodeId });
                        if (event.reply) event.reply(null, "组件已移除");
                    } else {
                        if (event.reply) event.reply(new Error("找不到组件"));
                    }
                } catch (err) {
                    if (event.reply) event.reply(new Error(`移除组件失败: ${err.message}`));
                }
                break;

            case "update":
                // 更新现有组件属性
                if (!componentType && !componentId) {
                    if (event.reply) event.reply(new Error("必须提供组件 ID 或组件类型"));
                    return;
                }

                try {
                    let targetComp = null;

                    // 1. 尝试通过 componentId 查找
                    if (componentId) {
                        if (node._components) {
                            for (let i = 0; i < node._components.length; i++) {
                                if (node._components[i].uuid === componentId) {
                                    targetComp = node._components[i];
                                    break;
                                }
                            }
                        }
                    }

                    // 2. 尝试通过 type 查找
                    if (!targetComp && componentType) {
                        let compClass = null;
                        if (componentType.startsWith("cc.")) {
                            const className = componentType.replace("cc.", "");
                            compClass = cc[className];
                        } else {
                            compClass = cc.js.getClassByName(componentType);
                            if (!compClass && cc[componentType]) {
                                compClass = cc[componentType];
                            }
                        }
                        if (compClass) {
                            targetComp = node.getComponent(compClass);
                        }
                    }

                    if (targetComp) {
                        if (properties) {
                            applyProperties(targetComp, properties);

                            Editor.Ipc.sendToMain("scene:dirty");
                            Editor.Ipc.sendToAll("scene:node-changed", { uuid: nodeId });
                            if (event.reply) event.reply(null, "组件属性已更新");
                        } else {
                            if (event.reply) event.reply(null, "没有需要更新的属性");
                        }
                    } else {
                        if (event.reply)
                            event.reply(new Error(`找不到组件 (类型: ${componentType}, ID: ${componentId})`));
                    }
                } catch (err) {
                    if (event.reply) event.reply(new Error(`更新组件失败: ${err.message}`));
                }
                break;

            case "get":
                try {
                    const components = node._components.map((c) => {
                        // 获取组件属性
                        const properties = {};
                        for (const key in c) {
                            if (typeof c[key] !== "function" && !key.startsWith("_") && c[key] !== undefined) {
                                try {
                                    // 安全序列化检查
                                    const val = c[key];
                                    if (val === null || val === undefined) {
                                        properties[key] = val;
                                        continue;
                                    }

                                    // 基础类型是安全的
                                    if (typeof val !== "object") {
                                        // 【优化】对于超长字符串进行截断
                                        if (typeof val === "string" && val.length > 200) {
                                            properties[key] =
                                                val.substring(0, 50) + `...[Truncated, total length: ${val.length}]`;
                                        } else {
                                            properties[key] = val;
                                        }
                                        continue;
                                    }

                                    // 特殊 Cocos 类型
                                    if (val instanceof cc.ValueType) {
                                        properties[key] = val.toString();
                                    } else if (val instanceof cc.Asset) {
                                        properties[key] = `资源(${val.name})`;
                                    } else if (val instanceof cc.Node) {
                                        properties[key] = `节点(${val.name})`;
                                    } else if (val instanceof cc.Component) {
                                        properties[key] = `组件(${val.name}<${val.__typename}>)`;
                                    } else {
                                        // 数组和普通对象
                                        // 【优化】对于超长数组直接截断并提示，防止返回巨大的坐标或点集
                                        if (Array.isArray(val) && val.length > 10) {
                                            properties[key] = `[Array(${val.length})]`;
                                            continue;
                                        }

                                        // 尝试转换为纯 JSON 数据以避免 IPC 错误（如包含原生对象/循环引用）
                                        try {
                                            const jsonStr = JSON.stringify(val);
                                            if (jsonStr && jsonStr.length > 500) {
                                                properties[key] = `[Large JSON Object, length: ${jsonStr.length}]`;
                                            } else {
                                                // 确保不传递原始对象引用
                                                properties[key] = JSON.parse(jsonStr);
                                            }
                                        } catch (e) {
                                            // 如果 JSON 失败（例如循环引用），格式化为字符串
                                            properties[key] =
                                                `[复杂对象: ${val.constructor ? val.constructor.name : typeof val}]`;
                                        }
                                    }
                                } catch (e) {
                                    properties[key] = "[Serialization Error]";
                                }
                            }
                        }
                        return {
                            type: cc.js.getClassName(c) || c.constructor.name || "Unknown",
                            uuid: c.uuid,
                            properties: properties,
                        };
                    });
                    if (event.reply) event.reply(null, components);
                } catch (err) {
                    if (event.reply) event.reply(new Error(`获取组件失败: ${err.message}`));
                }
                break;

            default:
                if (event.reply) event.reply(new Error(`未知的组件操作类型: ${action}`));
                break;
        }
    },

    "get-component-properties": function (component) {
        const properties = {};

        // 遍历组件属性
        for (const key in component) {
            if (typeof component[key] !== "function" && !key.startsWith("_") && component[key] !== undefined) {
                try {
                    properties[key] = component[key];
                } catch (e) {
                    // 忽略无法序列化的属性
                }
            }
        }

        return properties;
    },

    "instantiate-prefab": function (event, args) {
        const { prefabUuid, parentId } = args;
        const scene = cc.director.getScene();

        if (!scene) {
            if (event.reply) event.reply(new Error("场景尚未准备好或正在加载。"));
            return;
        }

        if (!prefabUuid) {
            if (event.reply) event.reply(new Error("必须提供预制体 UUID。"));
            return;
        }

        // 使用 cc.assetManager.loadAny 通过 UUID 加载 (Cocos 2.4+)
        // 如果是旧版，可能需要 cc.loader.load({uuid: ...})，但在 2.4 环境下 assetManager 更推荐
        cc.assetManager.loadAny(prefabUuid, (err, prefab) => {
            if (err) {
                if (event.reply) event.reply(new Error(`加载预制体失败: ${err.message}`));
                return;
            }

            // 实例化预制体
            const instance = cc.instantiate(prefab);
            if (!instance) {
                if (event.reply) event.reply(new Error("实例化预制体失败"));
                return;
            }

            // 设置父节点
            let parent = parentId ? findNode(parentId) : scene;
            if (parent) {
                instance.parent = parent;

                // 通知场景变脏
                Editor.Ipc.sendToMain("scene:dirty");

                // 通知 UI 刷新
                setTimeout(() => {
                    Editor.Ipc.sendToAll("scene:node-created", {
                        uuid: instance.uuid,
                        parentUuid: parent.uuid,
                    });
                }, 10);

                if (event.reply) event.reply(null, `预制体实例化成功，UUID: ${instance.uuid}`);
            } else {
                if (event.reply) event.reply(new Error("找不到父节点"));
            }
        });
    },

    /**
     * 根据特定条件在场景中搜索节点
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (conditions, recursive)
     */
    "find-gameobjects": function (event, args) {
        const { conditions, recursive = true } = args;
        const result = [];
        const scene = cc.director.getScene();

        function searchNode(node) {
            if (
                !node ||
                !node.name ||
                (typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot"))
            ) {
                return;
            }

            // 检查节点是否满足条件
            let match = true;

            if (conditions.name && !node.name.includes(conditions.name)) {
                match = false;
            }

            if (conditions.component) {
                let hasComponent = false;
                try {
                    if (conditions.component.startsWith("cc.")) {
                        const className = conditions.component.replace("cc.", "");
                        hasComponent = node.getComponent(cc[className]) !== null;
                    } else {
                        hasComponent = node.getComponent(conditions.component) !== null;
                    }
                } catch (e) {
                    hasComponent = false;
                }
                if (!hasComponent) {
                    match = false;
                }
            }

            if (conditions.active !== undefined && node.active !== conditions.active) {
                match = false;
            }

            if (match) {
                const comps = node._components || [];
                result.push({
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    components: comps.map((c) => {
                        const parts = (cc.js.getClassName(c) || "").split(".");
                        return parts[parts.length - 1]; // 简化的组件名
                    }),
                    childrenCount: node.childrenCount,
                });
            }

            // 递归搜索子节点
            if (recursive) {
                for (let i = 0; i < node.childrenCount; i++) {
                    searchNode(node.children[i]);
                }
            }
        }

        // 从场景根节点开始搜索
        if (scene) {
            searchNode(scene);
        }

        if (event.reply) {
            event.reply(null, result);
        }
    },

    /**
     * 查找场景中引用了指定节点或资源的所有位置
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (targetId, targetType)
     */
    "find-references": function (event, args) {
        const { targetId, targetType = "auto", additionalIds } = args;
        if (!targetId) {
            if (event.reply) event.reply(new Error("必须提供 targetId 参数"));
            return;
        }

        const scene = cc.director.getScene();
        if (!scene) {
            if (event.reply) event.reply(new Error("场景尚未准备好"));
            return;
        }

        // 判断目标类型：尝试先当节点查找
        let detectedType = targetType;
        if (targetType === "auto") {
            const targetNode = findNode(targetId);
            detectedType = targetNode ? "node" : "asset";
        }

        const results = [];

        // 规范化 UUID: 同时生成压缩(22位)和解压(36位)格式，确保资源匹配
        const targetVariants = [targetId];
        try {
            if (typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
                const compressed = Editor.Utils.UuidUtils.compressUuid(targetId);
                const decompressed = Editor.Utils.UuidUtils.decompressUuid(targetId);
                if (compressed && compressed !== targetId) targetVariants.push(compressed);
                if (decompressed && decompressed !== targetId) targetVariants.push(decompressed);
            }
        } catch (e) {
            /* 忽略 UUID 转换错误 */
        }
        // 合并 main.js 预解析的子资源 UUID (如 Texture2D 对应的 SpriteFrame)
        if (Array.isArray(additionalIds)) {
            additionalIds.forEach(function (aid) {
                if (targetVariants.indexOf(aid) === -1) targetVariants.push(aid);
                try {
                    if (typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
                        var c = Editor.Utils.UuidUtils.compressUuid(aid);
                        var d = Editor.Utils.UuidUtils.decompressUuid(aid);
                        if (c && targetVariants.indexOf(c) === -1) targetVariants.push(c);
                        if (d && targetVariants.indexOf(d) === -1) targetVariants.push(d);
                    }
                } catch (e) {
                    /* 忽略 */
                }
            });
        }

        /**
         * 检查一个属性值是否引用了目标
         * @returns {string|null} 匹配时返回可读描述，否则返回 null
         */
        function checkValue(val) {
            if (!val || typeof val !== "object") return null;

            if (detectedType === "node") {
                // 检查节点引用
                if (val instanceof cc.Node && val.uuid === targetId) {
                    return `节点(${val.name})`;
                }
            } else {
                // 检查资源引用 (cc.Asset 的 _uuid 属性)
                if (val instanceof cc.Asset) {
                    var assetUuid = val._uuid || "";
                    for (var vi = 0; vi < targetVariants.length; vi++) {
                        if (assetUuid === targetVariants[vi]) {
                            return `资源(${val.name || assetUuid})`;
                        }
                    }
                }
            }
            return null;
        }

        /**
         * 递归扫描节点及其子节点
         */
        function scanNode(node) {
            if (!node || !node.name) return;
            if (typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot")) {
                return;
            }

            // 跳过目标节点自身
            if (detectedType === "node" && node.uuid === targetId) {
                // 不跳过，仍然扫描子节点，但不扫描自身的组件
            } else {
                // 遍历该节点的所有组件
                const comps = node._components || [];
                for (let ci = 0; ci < comps.length; ci++) {
                    const comp = comps[ci];
                    const compTypeName = cc.js.getClassName(comp) || comp.constructor.name || "Unknown";

                    for (const key in comp) {
                        if (typeof comp[key] === "function" || key.startsWith("_")) continue;
                        if (key === "node" || key === "uuid" || key === "name") continue;

                        try {
                            const val = comp[key];
                            if (val === null || val === undefined) continue;

                            // 直接值检查
                            const directMatch = checkValue(val);
                            if (directMatch) {
                                results.push({
                                    nodeId: node.uuid,
                                    nodeName: node.name,
                                    componentType: compTypeName,
                                    componentIndex: ci,
                                    propertyName: key,
                                    propertyValue: directMatch,
                                });
                                continue;
                            }

                            // 数组检查 (如 EventHandler 数组、materials 等)
                            if (Array.isArray(val)) {
                                for (let ai = 0; ai < val.length; ai++) {
                                    const item = val[ai];
                                    const arrMatch = checkValue(item);
                                    if (arrMatch) {
                                        results.push({
                                            nodeId: node.uuid,
                                            nodeName: node.name,
                                            componentType: compTypeName,
                                            componentIndex: ci,
                                            propertyName: `${key}[${ai}]`,
                                            propertyValue: arrMatch,
                                        });
                                    }
                                    // EventHandler 的 target 属性
                                    if (item && item instanceof cc.Component.EventHandler && item.target) {
                                        const ehMatch = checkValue(item.target);
                                        if (ehMatch) {
                                            results.push({
                                                nodeId: node.uuid,
                                                nodeName: node.name,
                                                componentType: compTypeName,
                                                componentIndex: ci,
                                                propertyName: `${key}[${ai}].target`,
                                                propertyValue: ehMatch,
                                            });
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            // 跳过无法访问的属性
                        }
                    }
                }
            }

            // 递归子节点
            for (let i = 0; i < node.childrenCount; i++) {
                scanNode(node.children[i]);
            }
        }

        scanNode(scene);

        if (event.reply) {
            event.reply(null, {
                targetId: targetId,
                targetType: detectedType,
                referenceCount: results.length,
                references: results,
            });
        }
    },

    /**
     * 删除指定的场景节点
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (uuid)
     */
    "delete-node": function (event, args) {
        const { uuid } = args;
        const node = findNode(uuid);
        if (node) {
            const parent = node.parent;
            node.destroy();
            Editor.Ipc.sendToMain("scene:dirty");
            // 延迟通知以确保节点已被移除
            setTimeout(() => {
                if (parent) {
                    Editor.Ipc.sendToAll("scene:node-changed", { uuid: parent.uuid });
                }
                // 广播节点删除事件
                Editor.Ipc.sendToAll("scene:node-deleted", { uuid: uuid });
            }, 10);

            if (event.reply) event.reply(null, `节点 ${uuid} 已删除`);
        } else {
            if (event.reply) event.reply(new Error(`找不到节点: ${uuid}`));
        }
    },

    /**
     * 管理高效的全场景特效 (粒子系统)
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (action, nodeId, properties, name, parentId)
     */
    "manage-vfx": function (event, args) {
        const { action, nodeId, properties, name, parentId } = args;
        const scene = cc.director.getScene();

        const applyParticleProperties = (particleSystem, props) => {
            if (!props) return;

            if (props.duration !== undefined) particleSystem.duration = props.duration;
            if (props.emissionRate !== undefined) particleSystem.emissionRate = props.emissionRate;
            if (props.life !== undefined) particleSystem.life = props.life;
            if (props.lifeVar !== undefined) particleSystem.lifeVar = props.lifeVar;

            // 【关键修复】启用自定义属性，否则属性修改可能不生效
            particleSystem.custom = true;

            if (props.startColor) particleSystem.startColor = new cc.Color().fromHEX(props.startColor);
            if (props.endColor) particleSystem.endColor = new cc.Color().fromHEX(props.endColor);

            if (props.startSize !== undefined) particleSystem.startSize = props.startSize;
            if (props.endSize !== undefined) particleSystem.endSize = props.endSize;

            if (props.speed !== undefined) particleSystem.speed = props.speed;
            if (props.angle !== undefined) particleSystem.angle = props.angle;

            if (props.gravity) {
                if (props.gravity.x !== undefined) particleSystem.gravity.x = props.gravity.x;
                if (props.gravity.y !== undefined) particleSystem.gravity.y = props.gravity.y;
            }

            // 处理文件/纹理加载
            if (props.file) {
                // main.js 已经将 db:// 路径转换为 UUID
                // 如果用户直接传递 URL (http/https) 或其他格式，cc.assetManager.loadAny 也能处理
                const uuid = props.file;
                cc.assetManager.loadAny(uuid, (err, asset) => {
                    if (!err) {
                        if (asset instanceof cc.ParticleAsset) {
                            particleSystem.file = asset;
                        } else if (asset instanceof cc.Texture2D || asset instanceof cc.SpriteFrame) {
                            particleSystem.texture = asset;
                        }
                        Editor.Ipc.sendToMain("scene:dirty");
                    }
                });
            } else if (!particleSystem.texture && !particleSystem.file && args.defaultSpriteUuid) {
                // 【关键修复】如果没有纹理，加载默认纹理 (UUID 由 main.js 传入)
                Editor.log(`[mcp-bridge] Loading default texture with UUID: ${args.defaultSpriteUuid}`);
                cc.assetManager.loadAny(args.defaultSpriteUuid, (err, asset) => {
                    if (err) {
                        Editor.error(`[mcp-bridge] Failed to load default texture: ${err.message}`);
                    } else if (asset instanceof cc.Texture2D || asset instanceof cc.SpriteFrame) {
                        Editor.log(`[mcp-bridge] Default texture loaded successfully.`);
                        particleSystem.texture = asset;
                        Editor.Ipc.sendToMain("scene:dirty");
                    } else {
                        Editor.warn(`[mcp-bridge] Loaded asset is not a texture: ${asset}`);
                    }
                });
            }
        };

        if (action === "create") {
            let newNode = new cc.Node(name || "New Particle");
            let particleSystem = newNode.addComponent(cc.ParticleSystem);

            // 设置默认值
            particleSystem.resetSystem();
            particleSystem.custom = true; // 确保新创建的也是 custom 模式

            applyParticleProperties(particleSystem, properties);

            let parent = parentId ? cc.engine.getInstanceById(parentId) : scene;
            if (parent) {
                newNode.parent = parent;
                Editor.Ipc.sendToMain("scene:dirty");
                setTimeout(() => {
                    Editor.Ipc.sendToAll("scene:node-created", {
                        uuid: newNode.uuid,
                        parentUuid: parent.uuid,
                    });
                }, 10);
                if (event.reply) event.reply(null, newNode.uuid);
            } else {
                if (event.reply) event.reply(new Error("找不到父节点"));
            }
        } else if (action === "update") {
            let node = findNode(nodeId);
            if (node) {
                let particleSystem = node.getComponent(cc.ParticleSystem);
                if (!particleSystem) {
                    // 如果没有组件，自动添加
                    particleSystem = node.addComponent(cc.ParticleSystem);
                }

                applyParticleProperties(particleSystem, properties);

                Editor.Ipc.sendToMain("scene:dirty");
                Editor.Ipc.sendToAll("scene:node-changed", { uuid: nodeId });
                if (event.reply) event.reply(null, "特效已更新");
            } else {
                if (event.reply) event.reply(new Error("找不到节点"));
            }
        } else if (action === "get_info") {
            let node = findNode(nodeId);
            if (node) {
                let ps = node.getComponent(cc.ParticleSystem);
                if (ps) {
                    const info = {
                        duration: ps.duration,
                        emissionRate: ps.emissionRate,
                        life: ps.life,
                        lifeVar: ps.lifeVar,
                        startColor: ps.startColor.toHEX("#RRGGBB"),
                        endColor: ps.endColor.toHEX("#RRGGBB"),
                        startSize: ps.startSize,
                        endSize: ps.endSize,
                        speed: ps.speed,
                        angle: ps.angle,
                        gravity: { x: ps.gravity.x, y: ps.gravity.y },
                        file: ps.file ? ps.file.name : null,
                    };
                    if (event.reply) event.reply(null, info);
                } else {
                    if (event.reply) event.reply(null, { hasParticleSystem: false });
                }
            } else {
                if (event.reply) event.reply(new Error("找不到节点"));
            }
        } else {
            if (event.reply) event.reply(new Error(`未知的特效操作类型: ${action}`));
        }
    },

    /**
     * 控制节点的动画组件 (播放、暂停、停止等)
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (action, nodeId, clipName)
     */
    "manage-animation": function (event, args) {
        const { action, nodeId, clipName } = args;
        const node = findNode(nodeId);

        if (!node) {
            if (event.reply) event.reply(new Error(`找不到节点: ${nodeId}`));
            return;
        }

        const anim = node.getComponent(cc.Animation);
        if (!anim) {
            if (event.reply) event.reply(new Error(`在节点 ${nodeId} 上找不到 Animation 组件`));
            return;
        }

        switch (action) {
            case "get_list":
                const clips = anim.getClips();
                const clipList = clips.map((c) => ({
                    name: c.name,
                    duration: c.duration,
                    sample: c.sample,
                    speed: c.speed,
                    wrapMode: c.wrapMode,
                }));
                if (event.reply) event.reply(null, clipList);
                break;

            case "get_info":
                const currentClip = anim.currentClip;
                let isPlaying = false;
                // [安全修复] 只有在有当前 Clip 时才获取状态，避免 Animation 组件无 Clip 时的崩溃
                if (currentClip) {
                    const state = anim.getAnimationState(currentClip.name);
                    if (state) {
                        isPlaying = state.isPlaying;
                    }
                }
                const info = {
                    currentClip: currentClip ? currentClip.name : null,
                    clips: anim.getClips().map((c) => c.name),
                    playOnLoad: anim.playOnLoad,
                    isPlaying: isPlaying,
                };
                if (event.reply) event.reply(null, info);
                break;

            case "play":
                if (!clipName) {
                    anim.play();
                    if (event.reply) event.reply(null, "正在播放默认动画剪辑");
                } else {
                    anim.play(clipName);
                    if (event.reply) event.reply(null, `正在播放动画剪辑: ${clipName}`);
                }
                break;

            case "stop":
                anim.stop();
                if (event.reply) event.reply(null, "动画已停止");
                break;

            case "pause":
                anim.pause();
                if (event.reply) event.reply(null, "动画已暂停");
                break;

            case "resume":
                anim.resume();
                if (event.reply) event.reply(null, "动画已恢复播放");
                break;

            default:
                if (event.reply) event.reply(new Error(`未知的动画操作类型: ${action}`));
                break;
        }
    },

    /**
     * 自定义预制体创建：在场景进程中序列化节点树，并转换为正确的预制体格式
     * 【修复】Editor.serialize() 输出的是场景格式（含 cc.Scene、无 cc.Prefab 和 cc.PrefabInfo），
     *        需要后处理为 Cocos Creator 标准预制体格式
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (nodeId)
     */
    "create-prefab": function (event, args) {
        const { nodeId } = args;

        const node = findNode(nodeId);
        if (!node) {
            if (event.reply) event.reply(new Error(`找不到节点: ${nodeId}`));
            return;
        }

        try {
            const result = serializeNodeToPrefabJson(node, args);
            if (event.reply) event.reply(null, result);
        } catch (e) {
            if (event.reply) event.reply(new Error(`序列化节点失败: ${e.message}`));
        }
    },

    "scaffold-repeatable-ui": function (event, args) {
        const scene = cc.director.getScene();
        if (!scene) {
            if (event.reply) event.reply(new Error("场景尚未准备好，无法创建重复块脚手架"));
            return;
        }

        const tempRoot = new cc.Node("__MCP_REPEATABLE_UI_TEMP__");
        tempRoot.parent = scene;

        try {
            const itemNode = createRepeatableItemNode(args.spec);
            const containerNode = createRepeatableContainerNode(args.spec);
            tempRoot.addChild(itemNode);
            tempRoot.addChild(containerNode);

            const itemPrefabContent = serializeNodeToPrefabJson(itemNode, {
                uiPolicy: args.uiPolicy,
            });
            const containerPrefabContent = serializeNodeToPrefabJson(containerNode, {
                uiPolicy: args.uiPolicy,
                rootPreset: args.spec.rootPreset,
            });

            if (event.reply) {
                event.reply(null, {
                    itemPrefabContent,
                    containerPrefabContent,
                    itemFieldBindings: (args.spec.fields || []).map((field) => ({
                        name: field.name,
                        nodeName: field.nodeName,
                        type: field.type,
                    })),
                    contentNodeName: "Content",
                });
            }
        } catch (e) {
            if (event.reply) event.reply(new Error(`创建重复块脚手架失败: ${e.message}`));
        } finally {
            tempRoot.destroy();
        }
    },

    "import-design-layout": function (event, args) {
        const scene = cc.director.getScene();
        if (!scene) {
            if (event.reply) event.reply(new Error("场景尚未准备好，无法导入设计布局"));
            return;
        }

        const tempRoot = new cc.Node("__MCP_DESIGN_IMPORT_TEMP__");
        tempRoot.parent = scene;

        try {
            const pendingLoads = [];
            const importDiagnostics = [];
            const rootNode = createImportedDesignNode(
                args.layout,
                pendingLoads,
                args.uiPolicy,
                importDiagnostics,
                [],
            );
            tempRoot.addChild(rootNode);

            runPendingDesignLoads(pendingLoads, () => {
                try {
                    reconcileImportedDesignNodeSize(rootNode, args.layout, importDiagnostics, []);
                    const prefabContent = serializeNodeToPrefabJson(rootNode, {
                        uiPolicy: args.uiPolicy,
                        rootPreset: args.spec && args.spec.rootPreset,
                    });
                    if (event.reply) {
                        event.reply(null, {
                            prefabContent,
                            nodeCount: countImportedDesignNodes(args.layout),
                            diagnostics: importDiagnostics,
                        });
                    }
                } catch (e) {
                    if (event.reply) {
                        event.reply(new Error(`导入设计布局失败: ${e.message}`));
                    }
                } finally {
                    tempRoot.destroy();
                }
            });
        } catch (e) {
            tempRoot.destroy();
            if (event.reply) event.reply(new Error(`导入设计布局失败: ${e.message}`));
        }
    },

    "save-prefab": function (event, args) {
        try {
            const editMode = Editor.require("scene://edit-mode");
            if (editMode && editMode.curMode().name === "prefab") {
                editMode.save((err) => {
                    if (err) {
                        if (event.reply) event.reply(new Error(err.message || err));
                    } else {
                        if (event.reply) event.reply(null, "预制体保存成功");
                    }
                });
            } else {
                if (event.reply) event.reply(new Error("当前不在预制体编辑模式中"));
            }
        } catch (e) {
            if (event.reply) event.reply(new Error("保存预制体发生异常: " + e.message));
        }
    },

    "close-prefab": function (event, args) {
        try {
            const editMode = Editor.require("scene://edit-mode");
            if (editMode && editMode.curMode().name === "prefab") {
                editMode.pop();
                if (event.reply) event.reply(null, "已触发退出预制体编辑模式");
            } else {
                if (event.reply) event.reply(new Error("当前不在预制体编辑模式中"));
            }
        } catch (e) {
            if (event.reply) event.reply(new Error("退出预制体模式发生异常: " + e.message));
        }
    },
    "collect-current-sprite-assets": function (event, args) {
        try {
            if (event.reply) event.reply(null, collectCurrentSpriteAssetUuids());
        } catch (e) {
            if (event.reply) event.reply(new Error("收集当前 Sprite 资源失败: " + e.message));
        }
    },
};
