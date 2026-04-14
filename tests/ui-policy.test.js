const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
    getDefaultUiPolicy,
    mergeUiPolicy,
    resolveNamedUiPreset,
    resolveCreateNodePolicy,
    resolvePrefabRootPolicy,
} = require("../dist/utils/UiPolicy.js");
const { validateUiTree } = require("../dist/utils/UiPolicyValidation.js");
const { buildUiPolicyWorkflowGuide } = require("../dist/utils/UiPolicyPrompt.js");
const { loadProjectUiWorkflow } = require("../dist/utils/UiPolicyLoader.js");
const { McpWrappers } = require("../dist/core/McpWrappers.js");

test("buttons default to center anchor through the button preset", () => {
    const policy = getDefaultUiPolicy();

    const resolved = resolveCreateNodePolicy(policy, {
        type: "button",
    });

    assert.equal(resolved.presetName, "button");
    assert.deepEqual(resolved.anchor, { x: 0.5, y: 0.5 });
});

test("explicit ui preset overrides the node type default", () => {
    const policy = getDefaultUiPolicy();

    const resolved = resolveCreateNodePolicy(policy, {
        type: "button",
        uiPreset: "screen-root",
    });

    assert.equal(resolved.presetName, "screen-root");
    assert.equal(resolved.layout, "full");
});

test("screen-sized prefab roots automatically receive the screen-root preset", () => {
    const policy = getDefaultUiPolicy();

    const resolved = resolvePrefabRootPolicy(policy, {
        nodeSize: { width: 720, height: 1280 },
        canvasDesignResolution: { width: 720, height: 1280 },
    });

    assert.equal(resolved.shouldApply, true);
    assert.equal(resolved.presetName, "screen-root");
    assert.deepEqual(resolved.anchor, { x: 0.5, y: 0.5 });
    assert.equal(resolved.layout, "full");
});

test("policy overrides can change the default prefab root preset", () => {
    const policy = mergeUiPolicy(getDefaultUiPolicy(), {
        prefabRoot: {
            autoDetectScreenRoot: {
                preset: "safe-area-root",
            },
        },
    });

    const resolved = resolvePrefabRootPolicy(policy, {
        nodeSize: { width: 720, height: 1280 },
        canvasDesignResolution: { width: 720, height: 1280 },
    });

    assert.equal(resolved.presetName, "safe-area-root");
    assert.equal(resolved.safeArea, true);
});

test("named presets can be resolved for existing nodes", () => {
    const policy = getDefaultUiPolicy();

    const resolved = resolveNamedUiPreset(policy, "safe-area-root");

    assert.deepEqual(resolved.anchor, { x: 0.5, y: 0.5 });
    assert.equal(resolved.layout, "full");
    assert.equal(resolved.safeArea, true);
});

test("validateUiTree reports root layout and button anchor violations", () => {
    const policy = getDefaultUiPolicy();

    const result = validateUiTree(policy, {
        name: "LobbyLayer",
        uuid: "root",
        anchor: { x: 0, y: 0.5 },
        size: { width: 960, height: 640 },
        hasSafeArea: false,
        widget: null,
        children: [
            {
                name: "PlayButton",
                uuid: "button-1",
                anchor: { x: 0, y: 0 },
                components: ["cc.Button"],
                children: [],
            },
        ],
    });

    assert.equal(result.ok, false);
    assert.equal(result.rootPreset, "screen-root");
    assert.deepEqual(
        result.findings.map((finding) => finding.code).sort(),
        ["button-anchor-mismatch", "root-anchor-mismatch", "root-layout-mismatch"],
    );
});

test("validateUiTree passes for a screen-root with centered buttons", () => {
    const policy = getDefaultUiPolicy();

    const result = validateUiTree(policy, {
        name: "LobbyLayer",
        uuid: "root",
        anchor: { x: 0.5, y: 0.5 },
        size: { width: 960, height: 640 },
        hasSafeArea: false,
        widget: {
            isAlignTop: true,
            isAlignBottom: true,
            isAlignLeft: true,
            isAlignRight: true,
        },
        children: [
            {
                name: "PlayButton",
                uuid: "button-1",
                anchor: { x: 0.5, y: 0.5 },
                components: ["Button"],
                children: [],
            },
        ],
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.findings, []);
});

test("validateUiTree reports non-english node names when the policy requires english only", () => {
    const policy = mergeUiPolicy(getDefaultUiPolicy(), {
        nodeNaming: {
            englishOnly: true,
        },
    });

    const result = validateUiTree(policy, {
        name: "邀请界面",
        uuid: "root",
        anchor: { x: 0.5, y: 0.5 },
        size: { width: 960, height: 640 },
        hasSafeArea: false,
        widget: {
            isAlignTop: true,
            isAlignBottom: true,
            isAlignLeft: true,
            isAlignRight: true,
        },
        children: [
            {
                name: "PlayButton",
                uuid: "button-1",
                anchor: { x: 0.5, y: 0.5 },
                components: ["Button"],
                children: [
                    {
                        name: "标题",
                        uuid: "label-1",
                        components: ["Label"],
                        children: [],
                    },
                ],
            },
        ],
    });

    assert.equal(result.ok, false);
    assert.equal(result.findings.some((finding) => finding.code === "node-name-non-english"), true);
    assert.equal(result.findings.filter((finding) => finding.code === "node-name-non-english").length, 2);
});

test("validateUiTree reports text-copy-derived node names when the policy requires english only", () => {
    const policy = mergeUiPolicy(getDefaultUiPolicy(), {
        nodeNaming: {
            englishOnly: true,
        },
    });

    const result = validateUiTree(policy, {
        name: "InviteBonusPage",
        uuid: "root",
        anchor: { x: 0.5, y: 0.5 },
        size: { width: 720, height: 1280 },
        hasSafeArea: false,
        widget: {
            isAlignTop: true,
            isAlignBottom: true,
            isAlignLeft: true,
            isAlignRight: true,
        },
        children: [
            {
                name: "grpRules",
                uuid: "group-1",
                components: [],
                children: [
                    {
                        name: "1_Users_who_register_via_your_invite_link_will_be_bound_to_you",
                        uuid: "label-1",
                        anchor: { x: 0.5, y: 0.5 },
                        components: ["cc.Label"],
                        labelText: "1. Users who register via your invite link will be bound to you.\n2. Invite bonus is granted only for valid invites.",
                        children: [],
                    },
                ],
            },
        ],
    });

    assert.equal(result.ok, false);
    assert.equal(result.findings.some((finding) => finding.code === "node-name-copy-derived"), true);
    assert.equal(result.findings.filter((finding) => finding.code === "node-name-copy-derived").length, 1);
});

test("workflow guide mentions the recommended UI prefab toolchain", () => {
    const policy = getDefaultUiPolicy();

    const guide = buildUiPolicyWorkflowGuide(policy);

    assert.match(guide, /create_node/);
    assert.match(guide, /apply_ui_policy/);
    assert.match(guide, /validate_ui_prefab/);
    assert.match(guide, /screen-root/);
    assert.match(guide, /import_design_layout/);
    assert.match(guide, /analyze_design_layout/);
    assert.match(guide, /imageAssetDir/);
    assert.match(guide, /strictImageAssets/);
    assert.match(guide, /base64/);
    assert.match(guide, /overflow/);
    assert.match(guide, /@property/);
});

test("resource list exposes ui policy and workflow resources", () => {
    const resources = McpWrappers.getResourcesList();
    const uris = resources.map((resource) => resource.uri);

    assert.ok(uris.includes("cocos://ui/policy"));
    assert.ok(uris.includes("cocos://ui/workflow"));
});

test("prompt list exposes workflow guardrails and design planner prompts", () => {
    const prompts = McpWrappers.getPromptsList();
    const names = prompts.map((prompt) => prompt.name);

    assert.ok(names.includes("ui-workflow-guardrails"));
    assert.ok(names.includes("design-import-planner"));
});

test("project workflow file overrides the package default workflow", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ui-workflow-"));
    const projectRoot = path.join(tempRoot, "project");
    const packageRoot = path.join(projectRoot, "packages", "mcp-bridge");
    const settingsDir = path.join(projectRoot, "settings");
    const docsDir = path.join(projectRoot, "docs");

    fs.mkdirSync(packageRoot, { recursive: true });
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.mkdirSync(docsDir, { recursive: true });

    fs.writeFileSync(path.join(packageRoot, "project-ui-policy.json"), JSON.stringify(getDefaultUiPolicy()), "utf8");
    fs.writeFileSync(path.join(packageRoot, "project-ui-workflow.md"), "# package fallback", "utf8");
    fs.writeFileSync(path.join(docsDir, "ai-ui-workflow.md"), "# project workflow", "utf8");

    const workflow = loadProjectUiWorkflow(projectRoot, packageRoot);

    assert.match(workflow, /project workflow/);
});
