const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getDefaultAutoNineSlicePolicy,
    normalizeAutoNineSlicePolicy,
    resolveAutoNineSliceRule,
    resolvePreferredSpriteSizeMode,
    readConfiguredNineSliceBorder,
    hasProcessedAutoNineSliceMarker,
    markAutoNineSliceProcessed,
} = require("../dist/utils/AutoNineSlice.js");

test("matches a contains rule for 点9 textures", () => {
    const policy = normalizeAutoNineSlicePolicy({
        enabled: true,
        rules: [
            {
                pattern: "点9",
                border: [20, 20, 20, 20],
            },
        ],
    });

    const resolved = resolveAutoNineSliceRule(policy, "比赛-奖励底（点9）.png");

    assert.ok(resolved);
    assert.equal(resolved.pattern, "点9");
    assert.deepEqual(resolved.border, [20, 20, 20, 20]);
});

test("auto derives border for 点9 textures from the smaller texture side", () => {
    const policy = normalizeAutoNineSlicePolicy({
        enabled: true,
        rules: [],
    });

    const resolved = resolveAutoNineSliceRule(policy, "说明tips组件1-bg（点9）.png", {
        width: 48,
        height: 60,
    });

    assert.ok(resolved);
    assert.equal(resolved.pattern, "点9");
    assert.deepEqual(resolved.border, [24, 24, 24, 24]);
});

test("点9 textures prefer auto-derived border over configured rule borders", () => {
    const policy = normalizeAutoNineSlicePolicy({
        enabled: true,
        rules: [
            {
                pattern: "点9",
                border: [20, 20, 20, 20],
            },
        ],
    });

    const resolved = resolveAutoNineSliceRule(policy, "说明tips组件1-bg（点9）.png", {
        width: 48,
        height: 60,
    });

    assert.ok(resolved);
    assert.equal(resolved.pattern, "点9");
    assert.deepEqual(resolved.border, [24, 24, 24, 24]);
});

test("treats zero border as not configured", () => {
    const border = readConfiguredNineSliceBorder({
        borderTop: 0,
        borderBottom: 0,
        borderLeft: 0,
        borderRight: 0,
    });

    assert.equal(border, null);
});

test("reads configured border from independent border fields", () => {
    const border = readConfiguredNineSliceBorder({
        borderTop: 7,
        borderBottom: 8,
        borderLeft: 9,
        borderRight: 10,
    });

    assert.deepEqual(border, [7, 8, 9, 10]);
});

test("processed markers skip repeated triggers for the same rule", () => {
    const policy = getDefaultAutoNineSlicePolicy();
    const marked = markAutoNineSliceProcessed(policy.state, "db://assets/a.png", {
        pattern: "点9",
        border: [20, 20, 30, 30],
    });

    assert.equal(
        hasProcessedAutoNineSliceMarker(marked, "db://assets/a.png", {
            pattern: "点9",
            border: [20, 20, 30, 30],
        }),
        true,
    );
    assert.equal(
        hasProcessedAutoNineSliceMarker(marked, "db://assets/a.png", {
            pattern: "点9",
            border: [10, 10, 10, 10],
        }),
        false,
    );
});

test("preferred sprite size mode is CUSTOM for configured nine-slice borders", () => {
    const sizeMode = resolvePreferredSpriteSizeMode(null, "普通图片.png", {
        borderTop: 12,
        borderBottom: 12,
        borderLeft: 12,
        borderRight: 12,
    });

    assert.equal(sizeMode, "CUSTOM");
});

test("preferred sprite size mode is CUSTOM for 点9 rule matches", () => {
    const policy = normalizeAutoNineSlicePolicy({
        enabled: true,
        rules: [
            {
                pattern: "点9",
                border: [20, 20, 20, 20],
            },
        ],
    });

    const sizeMode = resolvePreferredSpriteSizeMode(policy, "按钮点9.png", null);

    assert.equal(sizeMode, "CUSTOM");
});

test("preferred sprite size mode is CUSTOM for 点9 textures without explicit rules", () => {
    const policy = normalizeAutoNineSlicePolicy({
        enabled: true,
        rules: [],
    });

    const sizeMode = resolvePreferredSpriteSizeMode(policy, "按钮背景（点9）.png", null);

    assert.equal(sizeMode, "CUSTOM");
});

test("preferred sprite size mode is RAW for non-nine-slice images", () => {
    const policy = normalizeAutoNineSlicePolicy({
        enabled: true,
        rules: [
            {
                pattern: "点9",
                border: [20, 20, 20, 20],
            },
        ],
    });

    const sizeMode = resolvePreferredSpriteSizeMode(policy, "普通按钮.png", null);

    assert.equal(sizeMode, "RAW");
});
