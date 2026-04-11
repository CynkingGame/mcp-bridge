const test = require("node:test");
const assert = require("node:assert/strict");

const {
    normalizeRepeatableUiScaffoldArgs,
    buildRepeatableItemScript,
    buildRepeatableControllerScript,
    buildRepeatableUiBindingPlan,
} = require("../dist/utils/RepeatableUiScaffold.js");

test("normalizeRepeatableUiScaffoldArgs builds default asset paths and field bindings", () => {
    const normalized = normalizeRepeatableUiScaffoldArgs({
        itemName: "RankItem",
        containerName: "RankList",
        prefabDir: "db://assets/prefabs/rank",
        scriptDir: "db://assets/scripts/ui/rank",
        fields: [
            { name: "rank", type: "label" },
            { name: "avatar", type: "sprite" },
        ],
    });

    assert.equal(normalized.itemPrefabPath, "db://assets/prefabs/rank/RankItem.prefab");
    assert.equal(normalized.containerPrefabPath, "db://assets/prefabs/rank/RankList.prefab");
    assert.equal(normalized.itemScriptPath, "db://assets/scripts/ui/rank/RankItem.ts");
    assert.equal(normalized.controllerScriptPath, "db://assets/scripts/ui/rank/RankList.ts");
    assert.equal(normalized.fields[0].componentGetter, "cc.Label");
    assert.equal(normalized.fields[1].componentGetter, "cc.Sprite");
});

test("buildRepeatableItemScript includes setData and auto node lookup", () => {
    const normalized = normalizeRepeatableUiScaffoldArgs({
        itemName: "RewardItem",
        containerName: "RewardList",
        prefabDir: "db://assets/prefabs/reward",
        scriptDir: "db://assets/scripts/ui/reward",
        fields: [
            { name: "title", type: "label" },
            { name: "icon", type: "sprite" },
        ],
    });

    const script = buildRepeatableItemScript(normalized);

    assert.match(script, /export default class RewardItem extends cc\.Component/);
    assert.match(script, /setData\(data: any\)/);
    assert.match(script, /this\.titleLabel = this\.findComponent/);
    assert.match(script, /this\.iconSprite = this\.findComponent/);
});

test("buildRepeatableControllerScript includes render list flow", () => {
    const normalized = normalizeRepeatableUiScaffoldArgs({
        itemName: "RewardItem",
        containerName: "RewardList",
        prefabDir: "db://assets/prefabs/reward",
        scriptDir: "db://assets/scripts/ui/reward",
        fields: [{ name: "title", type: "label" }],
        useScrollView: true,
    });

    const script = buildRepeatableControllerScript(normalized);

    assert.match(script, /@property\(cc\.Prefab\)/);
    assert.match(script, /render\(list: any\[\]\)/);
    assert.match(script, /cc\.instantiate\(this\.itemPrefab\)/);
    assert.match(script, /getChildByName\("Content"\)/);
});

test("buildRepeatableUiBindingPlan exposes component names and prefab property binding", () => {
    const normalized = normalizeRepeatableUiScaffoldArgs({
        itemName: "RewardItem",
        containerName: "RewardList",
        prefabDir: "db://assets/prefabs/reward",
        scriptDir: "db://assets/scripts/ui/reward",
        fields: [{ name: "title", type: "label" }],
    });

    const plan = buildRepeatableUiBindingPlan(normalized);

    assert.equal(plan.itemComponentType, "RewardItem");
    assert.equal(plan.controllerComponentType, "RewardList");
    assert.equal(plan.controllerPrefabProperty, "itemPrefab");
    assert.equal(plan.itemPrefabPath, "db://assets/prefabs/reward/RewardItem.prefab");
});
