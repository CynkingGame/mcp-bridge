const test = require("node:test");
const assert = require("node:assert/strict");

const {
    derivePrefabScriptPath,
    buildPrefabScriptScaffoldSpec,
    buildPrefabComponentScript,
    buildPrefabComponentBindings,
} = require("../dist/utils/PrefabScriptScaffold.js");

test("derivePrefabScriptPath mirrors prefab folders into scripts folders", () => {
    assert.equal(
        derivePrefabScriptPath("db://assets/hall/prefabs/agent/InviteView.prefab"),
        "db://assets/hall/scripts/agent/InviteView.ts",
    );
});

test("buildPrefabScriptScaffoldSpec collects data and interaction bindings", () => {
    const spec = buildPrefabScriptScaffoldSpec("db://assets/hall/prefabs/agent/InviteView.prefab", {
        name: "InviteView",
        components: [],
        children: [
            {
                name: "TitleLabel",
                components: ["cc.Label"],
                children: [],
            },
            {
                name: "Avatar",
                components: ["cc.Sprite"],
                children: [],
            },
            {
                name: "InviteButton",
                components: ["cc.Sprite", "cc.Button"],
                children: [],
            },
        ],
    });

    assert.equal(spec.className, "InviteView");
    assert.equal(spec.scriptPath, "db://assets/hall/scripts/agent/InviteView.ts");
    assert.deepEqual(
        spec.bindings.map((binding) => binding.propertyName),
        ["titleLabel", "avatarSprite", "inviteButton"],
    );
    assert.equal(spec.bindings[0].dataKey, "title");
    assert.equal(spec.bindings[2].handlerName, "onInviteButtonClick");
});

test("buildPrefabComponentScript emits properties, refreshView and click handlers", () => {
    const spec = buildPrefabScriptScaffoldSpec("db://assets/hall/prefabs/agent/InviteView.prefab", {
        name: "InviteView",
        components: [],
        children: [
            {
                name: "TitleLabel",
                components: ["Label"],
                children: [],
            },
            {
                name: "InviteButton",
                components: ["Button"],
                children: [],
            },
        ],
    });

    const script = buildPrefabComponentScript(spec);

    assert.match(script, /@property\(cc\.Label\)/);
    assert.match(script, /private titleLabel: cc\.Label = null;/);
    assert.match(script, /refreshView\(data: any\)/);
    assert.match(script, /this\.titleLabel\.string = String\(data\.title\)/);
    assert.match(script, /onInviteButtonClick/);
    assert.doesNotMatch(script, /bindReferences/);
    assert.doesNotMatch(script, /findComponent/);
});

test("buildPrefabComponentBindings resolves node uuids for properties and button events", () => {
    const spec = buildPrefabScriptScaffoldSpec("db://assets/hall/prefabs/agent/InviteView.prefab", {
        name: "InviteView",
        components: [],
        children: [
            {
                name: "TitleLabel",
                components: ["Label"],
                children: [],
            },
            {
                name: "InviteButton",
                components: ["Button"],
                children: [],
            },
        ],
    });

    const bindings = buildPrefabComponentBindings(spec, {
        uuid: "root-uuid",
        name: "InviteView",
        children: [
            {
                uuid: "label-uuid",
                name: "TitleLabel",
                children: [],
            },
            {
                uuid: "button-uuid",
                name: "InviteButton",
                children: [],
            },
        ],
    });

    assert.equal(bindings.properties.titleLabel, "label-uuid");
    assert.equal(bindings.properties.inviteButton, "button-uuid");
    assert.deepEqual(bindings.buttonEvents, [
        {
            nodeId: "button-uuid",
            handlerName: "onInviteButtonClick",
        },
    ]);
});

test("buildPrefabScriptScaffoldSpec sanitizes bindings that start with digits", () => {
    const spec = buildPrefabScriptScaffoldSpec("db://assets/hall/prefabs/agent/InviteView.prefab", {
        name: "InviteView",
        components: [],
        children: [
            {
                name: "672X302",
                components: ["cc.Sprite"],
                children: [],
            },
            {
                name: "1",
                components: ["cc.Button"],
                children: [],
            },
        ],
    });

    assert.deepEqual(
        spec.bindings.map((binding) => binding.propertyName),
        ["node672X302Sprite", "node1Button"],
    );
    assert.deepEqual(
        spec.bindings.map((binding) => binding.dataKey),
        ["node672X302", undefined],
    );

    const script = buildPrefabComponentScript(spec);
    assert.match(script, /private node672X302Sprite: cc\.Sprite = null;/);
    assert.match(script, /private node1Button: cc\.Button = null;/);
    assert.match(script, /data\.node672X302/);
    assert.match(script, /onNode1ButtonClick/);
});

test("buildPrefabScriptScaffoldSpec can use logic-first bindings and typed view data", () => {
    const spec = buildPrefabScriptScaffoldSpec(
        "db://assets/hall/prefabs/agent/InviteView.prefab",
        {
            name: "InviteView",
            components: [],
            children: [
                {
                    name: "HeaderTitle",
                    components: ["Label"],
                    binding: {
                        propertyName: "titleLabel",
                        dataKey: "title",
                        group: "header",
                    },
                    children: [],
                },
                {
                    name: "ClaimNow",
                    components: ["Button"],
                    binding: {
                        propertyName: "claimButton",
                        group: "actions",
                    },
                    children: [],
                },
            ],
        },
        {
            dataInterfaceName: "InviteViewState",
        },
    );

    assert.equal(spec.dataInterfaceName, "InviteViewState");
    assert.deepEqual(
        spec.bindings.map((binding) => ({
            propertyName: binding.propertyName,
            dataKey: binding.dataKey,
            group: binding.group,
        })),
        [
            {
                propertyName: "titleLabel",
                dataKey: "title",
                group: "header",
            },
            {
                propertyName: "claimButton",
                dataKey: undefined,
                group: "actions",
            },
        ],
    );

    const script = buildPrefabComponentScript(spec);
    assert.match(script, /export interface InviteViewState/);
    assert.match(script, /title\?: string \| number;/);
    assert.match(script, /refreshView\(data: InviteViewState\)/);
    assert.match(script, /\/\/ header/);
    assert.match(script, /\/\/ actions/);
    assert.doesNotMatch(script, /bindReferences/);
    assert.doesNotMatch(script, /findNode/);
});

test("buildPrefabComponentScript splits setData and render into group modules", () => {
    const spec = buildPrefabScriptScaffoldSpec(
        "db://assets/hall/prefabs/agent/InviteView.prefab",
        {
            name: "InviteView",
            components: [],
            children: [
                {
                    name: "SummaryTitle",
                    components: ["Label"],
                    binding: {
                        propertyName: "summaryTitleLabel",
                        dataKey: "summaryTitle",
                        group: "summary",
                    },
                    children: [],
                },
                {
                    name: "SummaryValue",
                    components: ["Label"],
                    binding: {
                        propertyName: "summaryValueLabel",
                        dataKey: "summaryValue",
                        group: "summary",
                    },
                    children: [],
                },
                {
                    name: "ClaimButton",
                    components: ["Button"],
                    binding: {
                        propertyName: "claimButton",
                        group: "actions",
                        handlerName: "onClaimTap",
                    },
                    children: [],
                },
            ],
        },
        {
            dataInterfaceName: "InviteViewState",
        },
    );

    const script = buildPrefabComponentScript(spec);
    const setDataBody = script.match(/setData\(data: InviteViewState\) \{([\s\S]*?)\n    \}/);
    const renderBody = script.match(/render\(\) \{([\s\S]*?)\n    \}/);

    assert.match(script, /private viewData: InviteViewState \| null = null;/);
    assert.match(script, /refreshView\(data: InviteViewState\) \{\n        this\.setData\(data\);\n    \}/);
    assert.ok(setDataBody, "expected a top-level setData body");
    assert.ok(renderBody, "expected a top-level render body");
    assert.match(setDataBody[1], /this\.viewData = data;/);
    assert.match(setDataBody[1], /this\.setDataSummary\(data\);/);
    assert.match(setDataBody[1], /this\.render\(\);/);
    assert.doesNotMatch(setDataBody[1], /\.string =/);
    assert.match(renderBody[1], /this\.renderSummary\(\);/);
    assert.match(renderBody[1], /this\.renderActions\(\);/);
    assert.doesNotMatch(renderBody[1], /\.string =/);
    assert.match(
        script,
        /private setDataSummary\(data: InviteViewState\) \{[\s\S]*this\.summaryTitleLabel\.string = String\(data\.summaryTitle\);[\s\S]*this\.summaryValueLabel\.string = String\(data\.summaryValue\);[\s\S]*\}/,
    );
    assert.match(script, /private renderSummary\(\) \{/);
    assert.match(script, /private renderActions\(\) \{/);
    assert.match(script, /onClaimTap\(event\?: cc\.Event\.EventTouch, customData\?: string\)/);
});
