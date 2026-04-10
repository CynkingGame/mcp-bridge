const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getDefaultUiPolicy,
    mergeUiPolicy,
    resolveNamedUiPreset,
    resolveCreateNodePolicy,
    resolvePrefabRootPolicy,
} = require("../dist/utils/UiPolicy.js");
const { validateUiTree } = require("../dist/utils/UiPolicyValidation.js");
const { buildUiPolicyWorkflowGuide } = require("../dist/utils/UiPolicyPrompt.js");
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

test("workflow guide mentions the recommended UI prefab toolchain", () => {
    const policy = getDefaultUiPolicy();

    const guide = buildUiPolicyWorkflowGuide(policy);

    assert.match(guide, /create_node/);
    assert.match(guide, /apply_ui_policy/);
    assert.match(guide, /validate_ui_prefab/);
    assert.match(guide, /screen-root/);
});

test("resource list exposes ui policy and workflow resources", () => {
    const resources = McpWrappers.getResourcesList();
    const uris = resources.map((resource) => resource.uri);

    assert.ok(uris.includes("cocos://ui/policy"));
    assert.ok(uris.includes("cocos://ui/workflow"));
});
