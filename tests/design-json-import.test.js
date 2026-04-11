const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

let designJson = {};
let toolRegistry = {};

try {
    designJson = require("../dist/utils/DesignJson.js");
} catch (_error) {}

try {
    toolRegistry = require("../dist/tools/ToolRegistry.js");
} catch (_error) {}

const sampleJsonPath = path.resolve(
    __dirname,
    "../../../hall_info/Ludo Tour选场-Tab-Prize.json",
);
const sampleDoc = JSON.parse(fs.readFileSync(sampleJsonPath, "utf8"));

test("tool registry exposes import_design_layout", () => {
    assert.equal(typeof toolRegistry.getToolsList, "function");

    const tools = toolRegistry.getToolsList();
    const analyzeTool = tools.find((item) => item.name === "analyze_design_layout");
    const tool = tools.find((item) => item.name === "import_design_layout");

    assert.ok(analyzeTool, "expected analyze_design_layout to be registered");
    assert.ok(tool, "expected import_design_layout to be registered");
    assert.match(tool.description, /设计 JSON|设计稿/);
    assert.ok(tool.inputSchema.properties.strictImageAssets);
    assert.equal("importGeneratedShapes" in tool.inputSchema.properties, false);
    assert.equal("importGeneratedShapes" in analyzeTool.inputSchema.properties, false);
});

test("normalizeDesignImportArgs builds asset output paths", () => {
    assert.equal(typeof designJson.normalizeDesignImportArgs, "function");

    const spec = designJson.normalizeDesignImportArgs({
        jsonPath: "hall_info/Ludo Tour选场-Tab-Prize.json",
        prefabName: "PrizePanel",
        prefabDir: "db://assets/prefabs/hall",
        assetOutputDir: "db://assets/textures/design/hall",
        imageAssetDir: "db://assets/art/hall/prize",
    });

    assert.equal(spec.prefabName, "PrizePanel");
    assert.equal(spec.prefabPath, "db://assets/prefabs/hall/PrizePanel.prefab");
    assert.equal(spec.assetOutputDir, "db://assets/textures/design/hall/PrizePanel");
    assert.deepEqual(spec.imageAssetDirs, ["db://assets/art/hall/prize"]);
    assert.equal(spec.importGeneratedShapes, false);
    assert.equal(spec.strictImageAssets, true);
});

test("normalizeDesignLayoutDocument prefers provided image assets over embedded base64", () => {
    assert.equal(typeof designJson.normalizeDesignLayoutDocument, "function");

    const normalized = designJson.normalizeDesignLayoutDocument(sampleDoc, {
        assetOutputDir: "db://assets/textures/design/hall/PrizePanel",
        imageAssetPaths: [
            "db://assets/art/hall/prize/btn.png",
            "db://assets/art/hall/prize/title.png",
        ],
    });

    assert.equal(normalized.root.name, "Ludo Tour选场2");
    assert.equal(normalized.root.size.width, 720);
    assert.equal(normalized.root.size.height, 1600);

    const actionGroup = normalized.root.children
        .flatMap((child) => child.children || [])
        .find((child) => child.name === "开始");

    assert.ok(actionGroup, "expected zero-sized action group to remain in hierarchy");
    assert.equal(actionGroup.size.width, 246);
    assert.equal(actionGroup.size.height, 79);

    const buttonNode = actionGroup.children.find((child) => child.name === "btn");
    const labelNode = actionGroup.children.find((child) => child.name === "Join ₹0.10");

    assert.ok(buttonNode);
    assert.ok(labelNode);
    assert.equal(buttonNode.position.x, 0);
    assert.equal(buttonNode.position.y, 0);
    assert.equal(buttonNode.visual.assetPath, "db://assets/art/hall/prize/btn.png");
    assert.equal(labelNode.text.horizontalAlign, "CENTER");
    assert.equal(labelNode.text.fontSize, 32);
    assert.equal(labelNode.text.lineHeight, 32);

    assert.equal(normalized.assetTasks.length, 0);
    const embeddedButtonAsset = normalized.assetTasks.find((task) => task.nodeId === "layer_144");
    assert.equal(embeddedButtonAsset, undefined);
    assert.equal(normalized.assetTasks.some((task) => task.kind === "embedded-image"), false);
});

test("normalizeDesignLayoutDocument never exports embedded base64 images", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(sampleDoc, {
        assetOutputDir: "db://assets/textures/design/hall/PrizePanel",
    });

    const embeddedButtonAsset = normalized.assetTasks.find((task) => task.nodeId === "layer_144");
    assert.equal(embeddedButtonAsset, undefined);
    assert.equal(normalized.assetTasks.some((task) => task.kind === "embedded-image"), false);
});

test("normalizeDesignLayoutDocument never generates shape assets from visual fills", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "Root",
                type: "container",
                frame: { x: 0, y: 0, width: 300, height: 200 },
                style: {},
                children: [
                    {
                        id: "card",
                        name: "Card",
                        type: "container",
                        frame: { x: 10, y: 20, width: 120, height: 60 },
                        style: {
                            backgroundColor: { r: 255, g: 0, b: 0, a: 1 },
                            borderRadius: 12,
                        },
                        children: [],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/StrictPanel",
            importGeneratedShapes: true,
        },
    );

    assert.deepEqual(normalized.assetTasks, []);
    assert.equal(normalized.root.children[0].visual, null);
});

test("normalizeDesignLayoutDocument prefers explicit imageAssetMap over generated shapes", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(sampleDoc, {
        assetOutputDir: "db://assets/textures/design/hall/PrizePanel",
        imageAssetMap: {
            btn: "db://assets/hall/textures/hall/ludo-按钮黄.png",
            "返回": "db://assets/hall/textures/hall/返回（共用）.png",
        },
    });

    const actionGroup = normalized.root.children
        .flatMap((child) => child.children || [])
        .find((child) => child.name === "开始");
    const buttonNode = actionGroup.children.find((child) => child.name === "btn");

    assert.equal(buttonNode.visual.assetPath, "db://assets/hall/textures/hall/ludo-按钮黄.png");
    assert.equal(
        normalized.assetTasks.some((task) => task.path.includes("layer_144")),
        false,
    );
});

test("normalizeDesignImportArgs always enforces resource-only image mode", () => {
    const spec = designJson.normalizeDesignImportArgs({
        jsonPath: "hall_info/Ludo Tour选场-Tab-Prize.json",
        strictImageAssets: false,
        importGeneratedShapes: true,
    });

    assert.equal(spec.strictImageAssets, true);
    assert.equal(spec.importGeneratedShapes, false);
});

test("analyzeNormalizedDesignLayout reports unresolved images for AI-side planning", () => {
    assert.equal(typeof designJson.analyzeNormalizedDesignLayout, "function");

    const normalized = designJson.normalizeDesignLayoutDocument(sampleDoc, {
        assetOutputDir: "db://assets/textures/design/hall/PrizePanel",
        imageAssetMap: {
            btn: "db://assets/hall/textures/hall/ludo-按钮黄.png",
        },
    });
    const analysis = designJson.analyzeNormalizedDesignLayout(normalized);

    assert.equal(analysis.summary.totalNodes > 0, true);
    assert.equal(analysis.summary.imageNodes > 0, true);
    assert.equal(Array.isArray(analysis.missingImageNodes), true);
    assert.equal(Array.isArray(analysis.resolvedImageNodes), true);
    assert.equal(analysis.resolvedImageNodes.some((node) => node.name === "btn"), true);
    assert.equal(analysis.missingImageNodes.length > 0, true);
});
