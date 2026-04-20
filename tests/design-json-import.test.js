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
    assert.ok(tool.inputSchema.properties.logic);
    assert.ok(analyzeTool.inputSchema.properties.logic);
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

test("normalizeDesignImportArgs preserves logic-first import hints", () => {
    const spec = designJson.normalizeDesignImportArgs({
        jsonPath: "hall_info/Ludo Tour选场-Tab-Prize.json",
        prefabName: "PrizePanel",
        logic: {
            rootName: "PrizeDialog",
            dataInterfaceName: "PrizeDialogState",
            rules: [
                {
                    matchName: "btn",
                    name: "joinButton",
                    path: "actions",
                    propertyName: "joinButton",
                    handlerName: "onJoinTap",
                    group: "actions",
                },
            ],
        },
    });

    assert.deepEqual(spec.logic, {
        rootName: "PrizeDialog",
        dataInterfaceName: "PrizeDialogState",
        rules: [
            {
                matchId: undefined,
                matchName: "btn",
                name: "joinButton",
                path: "actions",
                propertyName: "joinButton",
                dataKey: undefined,
                handlerName: "onJoinTap",
                group: "actions",
            },
        ],
    });
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
    const labelNode = buttonNode.children.find((child) => child.name === "Join ₹0.10");

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

test("normalizeDesignLayoutDocument nests button labels under the button node", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(sampleDoc, {
        assetOutputDir: "db://assets/textures/design/hall/PrizePanel",
        imageAssetPaths: [
            "db://assets/art/hall/prize/btn.png",
            "db://assets/art/hall/prize/title.png",
        ],
    });

    const actionGroup = normalized.root.children
        .flatMap((child) => child.children || [])
        .find((child) => child.name === "开始");
    const buttonNode = actionGroup.children.find((child) => child.name === "btn");
    const nestedLabel = buttonNode.children.find((child) => child.text && child.text.content === "Join ₹0.10");

    assert.ok(buttonNode, "expected a button-like image node");
    assert.ok(nestedLabel, "expected the button label to be re-parented under the button node");
    assert.equal(
        actionGroup.children.some((child) => child.text && child.text.content === "Join ₹0.10"),
        false,
    );
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

test("normalizeDesignLayoutDocument treats mapped 点9 assets as sliced custom sprites", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "Invite Data",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "card",
                        name: "衬底 672X302",
                        type: "image",
                        frame: { x: 24, y: 120, width: 672, height: 302 },
                        style: {},
                        children: [],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
            imageAssetMap: {
                "衬底 672X302": "db://assets/hall/textures/agent/衬底（共用）（点9）.png",
            },
        },
    );

    const cardNode = normalized.root.children[0];

    assert.equal(cardNode.visual.assetPath, "db://assets/hall/textures/agent/衬底（共用）（点9）.png");
    assert.equal(cardNode.visual.useSliced, true);
    assert.equal(cardNode.visual.preferredSizeMode, "CUSTOM");
});

test("normalizeDesignLayoutDocument matches agent asset names across 点9 hints and common prefixes", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "Invite Reward",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "tableBg",
                        name: "表格衬底 622X56",
                        type: "image",
                        frame: { x: 24, y: 120, width: 622, height: 56 },
                        style: {},
                        children: [],
                    },
                    {
                        id: "tabSlot",
                        name: "tab-底槽 466X62",
                        type: "image",
                        frame: { x: 24, y: 200, width: 466, height: 62 },
                        style: {},
                        children: [],
                    },
                    {
                        id: "moneyBag",
                        name: "钱袋",
                        type: "image",
                        frame: { x: 24, y: 320, width: 64, height: 64 },
                        style: {},
                        children: [],
                    },
                    {
                        id: "copyBtn",
                        name: "复制",
                        type: "image",
                        frame: { x: 120, y: 320, width: 120, height: 52 },
                        style: {},
                        children: [],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteReward",
            imageAssetPaths: [
                "db://assets/hall/textures/agent/表格衬底（点9）.png",
                "db://assets/hall/textures/agent/tab-底槽（共用）（点9）.png",
                "db://assets/hall/textures/agent/图标-钱袋.png",
                "db://assets/hall/textures/agent/按钮-复制.png",
            ],
        },
    );

    const byName = Object.fromEntries(normalized.root.children.map((child) => [child.name, child]));

    assert.equal(byName["表格衬底 622X56"].visual.assetPath, "db://assets/hall/textures/agent/表格衬底（点9）.png");
    assert.equal(byName["表格衬底 622X56"].visual.preferredSizeMode, "CUSTOM");
    assert.equal(byName["表格衬底 622X56"].visual.useSliced, true);

    assert.equal(byName["tab-底槽 466X62"].visual.assetPath, "db://assets/hall/textures/agent/tab-底槽（共用）（点9）.png");
    assert.equal(byName["tab-底槽 466X62"].visual.preferredSizeMode, "CUSTOM");
    assert.equal(byName["tab-底槽 466X62"].visual.useSliced, true);

    assert.equal(byName["钱袋"].visual.assetPath, "db://assets/hall/textures/agent/图标-钱袋.png");
    assert.equal(byName["钱袋"].visual.preferredSizeMode, "RAW");
    assert.equal(byName["钱袋"].visual.useSliced, false);

    assert.equal(byName["复制"].visual.assetPath, "db://assets/hall/textures/agent/按钮-复制.png");
    assert.equal(byName["复制"].visual.preferredSizeMode, "RAW");
    assert.equal(byName["复制"].visual.useSliced, false);
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
    const resolvedButton = analysis.resolvedImageNodes.find((node) => node.name === "btn");
    assert.equal(resolvedButton.preferredSizeMode, "RAW");
    assert.equal(analysis.missingImageNodes.length > 0, true);
});

test("analyzeNormalizedDesignLayout exposes CUSTOM mode for auto-matched 点9 assets", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "Invite Reward",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "tableBg",
                        name: "表格衬底 622X56",
                        type: "image",
                        frame: { x: 24, y: 120, width: 622, height: 56 },
                        style: {},
                        children: [],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteReward",
            imageAssetPaths: ["db://assets/hall/textures/agent/表格衬底（点9）.png"],
        },
    );

    const analysis = designJson.analyzeNormalizedDesignLayout(normalized);
    const tableBg = analysis.resolvedImageNodes.find((node) => node.name === "表格衬底 622X56");

    assert.ok(tableBg);
    assert.equal(tableBg.preferredSizeMode, "CUSTOM");
    assert.equal(tableBg.useSliced, true);
});

test("analyzeDesignLayoutLogicReadiness requires explicit logic for design-layer naming", () => {
    assert.equal(typeof designJson.analyzeDesignLayoutLogicReadiness, "function");

    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "邀请数据",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "section",
                        name: "今日数据",
                        type: "container",
                        frame: { x: 24, y: 120, width: 672, height: 492 },
                        style: {},
                        children: [
                            {
                                id: "card",
                                name: "衬底 672X302",
                                type: "image",
                                frame: { x: 0, y: 0, width: 672, height: 302 },
                                style: {},
                                children: [],
                            },
                        ],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const readiness = designJson.analyzeDesignLayoutLogicReadiness(normalized);

    assert.equal(readiness.requiresExplicitLogic, true);
    assert.deepEqual(
        readiness.issues.map((issue) => issue.reason),
        ["non-ascii-name", "non-ascii-name", "non-ascii-name"],
    );
});

test("analyzeDesignLayoutLogicReadiness passes after logic rewrites semantic names", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "页面",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "today",
                        name: "今日数据",
                        type: "container",
                        frame: { x: 24, y: 120, width: 672, height: 492 },
                        style: {},
                        children: [],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const logical = designJson.applyDesignLayoutLogic(normalized, {
        rootName: "InviteView",
        rules: [
            {
                matchId: "today",
                name: "todaySection",
                path: "content",
                group: "content",
            },
        ],
    });

    const readiness = designJson.analyzeDesignLayoutLogicReadiness(logical);

    assert.equal(readiness.requiresExplicitLogic, false);
    assert.deepEqual(readiness.issues, []);
});

test("analyzeDesignLayoutLogicReadiness rejects generic placeholder names", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "InviteView",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "group",
                        name: "ctn001",
                        type: "container",
                        frame: { x: 24, y: 120, width: 672, height: 492 },
                        style: {},
                        children: [
                            {
                                id: "title",
                                name: "txt001",
                                type: "text",
                                frame: { x: 40, y: 48, width: 220, height: 40 },
                                style: {},
                                text: {
                                    content: "Invite Bonus",
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
                            {
                                id: "claim",
                                name: "img001",
                                type: "image",
                                frame: { x: 40, y: 120, width: 180, height: 60 },
                                style: {},
                                children: [],
                            },
                        ],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const readiness = designJson.analyzeDesignLayoutLogicReadiness(normalized);

    assert.equal(readiness.requiresExplicitLogic, true);
    assert.deepEqual(
        readiness.issues.map((issue) => issue.reason),
        ["placeholder-generic-name", "placeholder-generic-name", "placeholder-generic-name"],
    );
});

test("analyzeDesignLayoutLogicReadiness rejects full component placeholder names", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
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
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const readiness = designJson.analyzeDesignLayoutLogicReadiness(normalized);

    assert.equal(readiness.requiresExplicitLogic, true);
    assert.deepEqual(
        readiness.issues.map((issue) => issue.name),
        ["group3", "sprite48", "label69"],
    );
    assert.deepEqual(
        readiness.issues.map((issue) => issue.reason),
        ["placeholder-generic-name", "placeholder-generic-name", "placeholder-generic-name"],
    );
});

test("analyzeDesignLayoutLogicReadiness rejects weak workflow generic names", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "panInviteView",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "groupWeak",
                        name: "grpNode",
                        type: "container",
                        frame: { x: 24, y: 120, width: 672, height: 492 },
                        style: {},
                        children: [
                            {
                                id: "labelWeak",
                                name: "labValue2000",
                                type: "text",
                                frame: { x: 40, y: 48, width: 220, height: 40 },
                                style: {},
                                text: {
                                    content: "2000",
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
                            {
                                id: "imgWeak",
                                name: "imgLayer300",
                                type: "image",
                                frame: { x: 40, y: 120, width: 180, height: 60 },
                                style: {},
                                children: [],
                            },
                        ],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const readiness = designJson.analyzeDesignLayoutLogicReadiness(normalized);

    assert.equal(readiness.requiresExplicitLogic, true);
    assert.deepEqual(
        readiness.issues.map((issue) => issue.reason),
        ["workflow-generic-name", "workflow-generic-name", "workflow-generic-name"],
    );
});

test("analyzeDesignLayoutLogicReadiness rejects text nodes named after their display copy", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "InviteBonusView",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "rules",
                        name: "grpRules",
                        type: "container",
                        frame: { x: 24, y: 120, width: 672, height: 492 },
                        style: {},
                        children: [
                            {
                                id: "betRule",
                                name: "1_Commission_is_earned_when_valid_invites_place_bets_on_Slots",
                                type: "text",
                                frame: { x: 40, y: 48, width: 580, height: 64 },
                                style: {},
                                text: {
                                    content: "1. Commission is earned when valid invites place bets on Slots",
                                    font: {
                                        family: "Arial",
                                        size: 24,
                                        lineHeight: 30,
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
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const readiness = designJson.analyzeDesignLayoutLogicReadiness(normalized);

    assert.equal(readiness.requiresExplicitLogic, true);
    assert.equal(readiness.issues.length, 1);
    assert.equal(readiness.issues[0].id, "betRule");
    assert.equal(readiness.issues[0].reason, "text-content-name");
});

test("analyzeDesignLayoutLogicReadiness rejects text nodes named after the leading sentence of multiline copy", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "InviteBonusView",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "rules",
                        name: "grpRules",
                        type: "container",
                        frame: { x: 24, y: 120, width: 672, height: 492 },
                        style: {},
                        children: [
                            {
                                id: "inviteRule",
                                name: "1_Users_who_register_via_your_invite_link_will_be_bound_to_you",
                                type: "text",
                                frame: { x: 40, y: 48, width: 580, height: 64 },
                                style: {},
                                text: {
                                    content: "1. Users who register via your invite link will be bound to you.\n2. Invite bonus is granted only for valid invites.\n3. Bets from valid invites are limited to Slot games only.",
                                    font: {
                                        family: "Arial",
                                        size: 24,
                                        lineHeight: 30,
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
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const readiness = designJson.analyzeDesignLayoutLogicReadiness(normalized);

    assert.equal(readiness.requiresExplicitLogic, true);
    assert.equal(readiness.issues.length, 1);
    assert.equal(readiness.issues[0].id, "inviteRule");
    assert.equal(readiness.issues[0].reason, "text-content-name");
});

test("applyDesignLayoutLogic can derive semantic node names from AI binding hints", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "页面",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "summary",
                        name: "模块",
                        type: "container",
                        frame: { x: 24, y: 120, width: 672, height: 240 },
                        style: {},
                        children: [
                            {
                                id: "totalLabel",
                                name: "总下注金额",
                                type: "text",
                                frame: { x: 40, y: 48, width: 260, height: 40 },
                                style: {},
                                text: {
                                    content: "Total Wagered",
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
                            {
                                id: "claim",
                                name: "按钮",
                                type: "image",
                                frame: { x: 40, y: 120, width: 180, height: 60 },
                                style: {},
                                children: [],
                            },
                        ],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const logical = designJson.applyDesignLayoutLogic(normalized, {
        rootName: "InviteView",
        rules: [
            {
                matchId: "summary",
                name: "grpSummary",
                path: "content",
                group: "summary",
            },
            {
                matchId: "totalLabel",
                propertyName: "totalWageredLabel",
                dataKey: "totalWagered",
                group: "summary",
            },
            {
                matchId: "claim",
                propertyName: "claimButton",
                handlerName: "onClaimTap",
                group: "actions",
            },
        ],
    });

    const summaryGroup = logical.root.children.find((child) => child.name === "content");
    const summaryContainer = summaryGroup.children.find((child) => child.name === "grpSummary");
    const totalLabel = summaryContainer.children.find((child) => child.id === "totalLabel");
    const claimButton = summaryContainer.children.find((child) => child.id === "claim");
    const readiness = designJson.analyzeDesignLayoutLogicReadiness(logical);

    assert.equal(totalLabel.name, "labTotalWagered");
    assert.deepEqual(totalLabel.binding, {
        propertyName: "totalWageredLabel",
        dataKey: "totalWagered",
        group: "summary",
    });
    assert.equal(claimButton.name, "btnClaim");
    assert.deepEqual(claimButton.binding, {
        propertyName: "claimButton",
        dataKey: undefined,
        group: "actions",
        handlerName: "onClaimTap",
    });
    assert.equal(readiness.requiresExplicitLogic, false);
});

test("applyDesignLayoutLogic rewrites node names and hierarchy around page logic", () => {
    assert.equal(typeof designJson.applyDesignLayoutLogic, "function");

    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "页面",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "title",
                        name: "标题",
                        type: "text",
                        frame: { x: 40, y: 60, width: 240, height: 40 },
                        style: {},
                        text: {
                            content: "Invite Data",
                            font: {
                                family: "Arial",
                                size: 32,
                                lineHeight: 32,
                                align: "left",
                                color: { r: 1, g: 1, b: 1, a: 1 },
                            },
                        },
                        children: [],
                    },
                    {
                        id: "claim",
                        name: "领取按钮",
                        type: "image",
                        frame: { x: 40, y: 120, width: 160, height: 64 },
                        style: {},
                        children: [],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
        },
    );

    const logical = designJson.applyDesignLayoutLogic(normalized, {
        rootName: "InviteView",
        rules: [
            {
                matchId: "title",
                name: "titleLabel",
                path: "header",
                propertyName: "titleLabel",
                dataKey: "title",
                group: "header",
            },
            {
                matchId: "claim",
                name: "claimButton",
                path: "actions",
                propertyName: "claimButton",
                group: "actions",
            },
        ],
    });

    assert.equal(logical.root.name, "InviteView");
    assert.deepEqual(
        logical.root.children.map((child) => child.name),
        ["header", "actions"],
    );
    assert.equal(logical.root.children[0].children[0].name, "labTitle");
    assert.deepEqual(logical.root.children[0].children[0].binding, {
        propertyName: "titleLabel",
        dataKey: "title",
        group: "header",
    });
    assert.equal(logical.root.children[1].children[0].name, "btnClaim");
});

test("applyDesignLayoutLogic promotes handler-bound image nodes into buttons", () => {
    const normalized = designJson.normalizeDesignLayoutDocument(
        {
            node: {
                id: "root",
                name: "页面",
                type: "container",
                frame: { x: 0, y: 0, width: 720, height: 1280 },
                style: {},
                children: [
                    {
                        id: "cta",
                        name: "底图",
                        type: "image",
                        frame: { x: 40, y: 120, width: 200, height: 72 },
                        style: {},
                        children: [],
                    },
                ],
            },
        },
        {
            assetOutputDir: "db://assets/textures/design/hall/InviteView",
            imageAssetMap: {
                底图: "db://assets/hall/textures/agent/按钮-复制.png",
            },
        },
    );

    const logical = designJson.applyDesignLayoutLogic(normalized, {
        rules: [
            {
                matchId: "cta",
                propertyName: "claimButton",
                handlerName: "onClaimTap",
                group: "actions",
            },
        ],
    });

    assert.equal(logical.root.children[0].isButton, true);
    assert.deepEqual(logical.root.children[0].binding, {
        propertyName: "claimButton",
        dataKey: undefined,
        group: "actions",
        handlerName: "onClaimTap",
    });
});

test("sanitizeNodeName can convert design layer names to english-safe node names", () => {
    const { sanitizeNodeName } = require("../dist/utils/NodeNaming.js");
    const usedNames = new Set();

    const rootName = sanitizeNodeName("邀请数据", {
        fallbackPrefix: "Container",
        fallbackSuffix: "root",
        usedNames,
    });
    const childName = sanitizeNodeName("tab-底槽（共用）（点9）", {
        fallbackPrefix: "Sprite",
        fallbackSuffix: "layer_1",
        usedNames,
    });

    assert.equal(rootName, "Container_root");
    assert.equal(childName, "tab_9");
});
