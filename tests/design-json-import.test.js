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
    const tool = tools.find((item) => item.name === "import_design_layout");

    assert.ok(tool, "expected import_design_layout to be registered");
    assert.match(tool.description, /设计 JSON|设计稿/);
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

    assert.equal(normalized.assetTasks.length > 0, true);
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
