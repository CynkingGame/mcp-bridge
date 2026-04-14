const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

let psdStudioImport = {};
let toolRegistry = {};

try {
    psdStudioImport = require("../dist/utils/PsdStudioImport.js");
} catch (_error) {}

try {
    toolRegistry = require("../dist/tools/ToolRegistry.js");
} catch (_error) {}

const sampleJsonPath = path.resolve(
    __dirname,
    "../../../agent/邀请数据/邀请数据-layer_0.json",
);
const sampleDoc = JSON.parse(fs.readFileSync(sampleJsonPath, "utf8"));

test("tool registry exposes generate_ui_from_psd", () => {
    assert.equal(typeof toolRegistry.getToolsList, "function");

    const tools = toolRegistry.getToolsList();
    const tool = tools.find((item) => item.name === "generate_ui_from_psd");

    assert.ok(tool, "expected generate_ui_from_psd to be registered");
    assert.match(tool.description, /PSD|psd2code|设计稿/i);
    assert.ok(tool.inputSchema.properties.psdPath);
    assert.ok(tool.inputSchema.properties.prefabDir);
    assert.ok(tool.inputSchema.properties.imageAssetDir);
    assert.ok(tool.inputSchema.properties.imageAssetDirs);
    assert.ok(tool.inputSchema.properties.exportScreenshots);
    assert.ok(tool.inputSchema.properties.includeImageData);
});

test("normalizePsdStudioImportArgs expands defaults and db asset dirs", () => {
    assert.equal(typeof psdStudioImport.normalizePsdStudioImportArgs, "function");

    const spec = psdStudioImport.normalizePsdStudioImportArgs(
        {
            psdPath: "agent",
            prefabDir: "db://assets/hall/prefabs/agent",
            imageAssetDir: "db://assets/hall/textures/agent",
        },
        {
            projectRoot: "D:/GitHub/BigWinGame",
        },
    );

    assert.equal(spec.psdPath, path.resolve("D:/GitHub/BigWinGame", "agent"));
    assert.equal(spec.prefabDir, "db://assets/hall/prefabs/agent");
    assert.deepEqual(spec.imageAssetDirs, ["db://assets/hall/textures/agent"]);
    assert.equal(spec.exportScreenshots, true);
    assert.equal(spec.includeImageData, false);
    assert.equal(spec.overwrite, false);
});

test("derivePsdExportDir and collectGeneratedJsonFiles follow psd2code output convention", () => {
    assert.equal(typeof psdStudioImport.derivePsdExportDir, "function");
    assert.equal(typeof psdStudioImport.collectGeneratedJsonFiles, "function");

    const tempRoot = fs.mkdtempSync(path.join(__dirname, "tmp-psd-studio-"));
    const psdFile = path.join(tempRoot, "InviteData.psd");
    const exportDir = path.join(tempRoot, "InviteData");
    fs.writeFileSync(psdFile, "stub");
    fs.mkdirSync(exportDir);
    fs.writeFileSync(path.join(exportDir, "InviteData-layer_0.json"), "{}");
    fs.writeFileSync(path.join(exportDir, "InviteData-layer_1.json"), "{}");
    fs.writeFileSync(path.join(exportDir, "InviteData.jpg"), "jpg");
    fs.writeFileSync(path.join(exportDir, "notes.txt"), "ignore");

    assert.equal(psdStudioImport.derivePsdExportDir(psdFile), exportDir);
    assert.deepEqual(
        psdStudioImport.collectGeneratedJsonFiles(exportDir),
        [
            path.join(exportDir, "InviteData-layer_0.json"),
            path.join(exportDir, "InviteData-layer_1.json"),
        ],
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("buildAutoDesignLogic creates import-ready names for problematic design nodes", () => {
    assert.equal(typeof psdStudioImport.buildAutoDesignLogic, "function");

    const logic = psdStudioImport.buildAutoDesignLogic(sampleDoc, {
        prefabName: "InviteDataContent",
    });

    assert.equal(typeof logic.rootName, "string");
    assert.match(logic.rootName, /^[A-Za-z][A-Za-z0-9_-]*$/);
    assert.ok(Array.isArray(logic.rules));
    assert.ok(logic.rules.length > 0, "expected auto-generated rules for problematic nodes");

    const rootRule = logic.rules.find((rule) => rule.matchId === "layer_2");
    assert.ok(rootRule, "expected a rule for design image nodes");
    assert.match(rootRule.name, /^(img|grp|btn|lab)[A-Za-z0-9_-]+$/);
    assert.equal(typeof rootRule.propertyName, "string");
    assert.ok(rootRule.propertyName.length > 0);
    assert.ok(rootRule.name.length <= 14, "node names should obey workflow length limit");

    const hasPlaceholderNames = logic.rules.some((rule) => /^(img|txt|ctn|grp|spr|lab|lbl|btn|node|icon)[_-]?\d+$/i.test(rule.name));
    assert.equal(hasPlaceholderNames, false);
});

test("buildAutoDesignLogic reuses ascii text content for text nodes when possible", () => {
    const logic = psdStudioImport.buildAutoDesignLogic(
        {
            node: {
                id: "root",
                name: "Root",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "text_1",
                        name: "Join ₹0.10",
                        type: "text",
                        frame: { x: 10, y: 20, width: 100, height: 20 },
                        style: {},
                        text: {
                            content: "Join ₹0.10",
                            font: {
                                family: "Arial",
                                size: 24,
                                lineHeight: 24,
                                align: "center",
                                color: { r: 255, g: 255, b: 255, a: 1 },
                            },
                        },
                        children: [],
                    },
                ],
            },
        },
        {
            prefabName: "JoinPanel",
        },
    );

    const textRule = logic.rules.find((rule) => rule.matchId === "text_1");

    assert.ok(textRule);
    assert.match(textRule.name, /^labJoin/i);
});

test("buildAutoDesignLogic rewrites full component placeholder names", () => {
    const logic = psdStudioImport.buildAutoDesignLogic(
        {
            node: {
                id: "root",
                name: "InviteView",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "group3",
                        name: "group3",
                        type: "container",
                        frame: { x: 24, y: 120, width: 672, height: 492 },
                        style: {},
                        children: [
                            {
                                id: "sprite48",
                                name: "sprite48",
                                type: "image",
                                frame: { x: 40, y: 120, width: 180, height: 60 },
                                style: {},
                                children: [],
                            },
                            {
                                id: "label69",
                                name: "label69",
                                type: "text",
                                frame: { x: 40, y: 48, width: 220, height: 40 },
                                style: {},
                                text: {
                                    content: "Invite Link",
                                    font: {
                                        family: "Arial",
                                        size: 28,
                                        lineHeight: 28,
                                        align: "left",
                                        color: { r: 255, g: 255, b: 255, a: 1 },
                                    },
                                },
                                children: [],
                            },
                        ],
                    },
                ],
            },
        },
        {
            prefabName: "InviteBonusPage",
        },
    );

    const groupRule = logic.rules.find((rule) => rule.matchId === "group3");
    const spriteRule = logic.rules.find((rule) => rule.matchId === "sprite48");
    const labelRule = logic.rules.find((rule) => rule.matchId === "label69");

    assert.ok(groupRule, "expected a generated rule for group3");
    assert.ok(spriteRule, "expected a generated rule for sprite48");
    assert.ok(labelRule, "expected a generated rule for label69");
    assert.match(groupRule.name, /^grp[A-Za-z0-9_-]+$/);
    assert.match(spriteRule.name, /^img[A-Za-z0-9_-]+$/);
    assert.match(labelRule.name, /^lab[A-Za-z0-9_-]+$/);
    assert.notEqual(groupRule.name, "group3");
    assert.notEqual(spriteRule.name, "sprite48");
    assert.notEqual(labelRule.name, "label69");
    assert.equal(typeof groupRule.propertyName, "string");
    assert.equal(typeof spriteRule.propertyName, "string");
    assert.equal(typeof labelRule.propertyName, "string");
    assert.equal(typeof labelRule.dataKey, "string");
});
