const test = require("node:test");
const assert = require("node:assert/strict");

const {
    deriveAutoNineSliceBorder,
    getDefaultAutoNineSlicePolicy,
    normalizeAutoNineSlicePolicy,
    resolveManageTextureBorder,
    resolveAutoNineSliceRule,
    resolvePreferredSpriteSizeMode,
    selectTextureMetaCandidateForAutoBorder,
    resolveTextureSizeForNineSlice,
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

test("resolveTextureSizeForNineSlice prefers raw dimensions from subMeta", () => {
    const size = resolveTextureSizeForNineSlice(
        { width: 100, height: 200 },
        { rawWidth: 48, rawHeight: 60, width: 30, height: 40 },
    );

    assert.deepEqual(size, { width: 48, height: 60 });
});

test("resolveTextureSizeForNineSlice falls back to meta dimensions", () => {
    const size = resolveTextureSizeForNineSlice(
        { width: 31, height: 41 },
        {},
    );

    assert.deepEqual(size, { width: 31, height: 41 });
});

test("deriveAutoNineSliceBorder floors odd texture sizes", () => {
    const border = deriveAutoNineSliceBorder({ width: 31, height: 41 });

    assert.deepEqual(border, [15, 15, 15, 15]);
});

test("resolveManageTextureBorder prefers explicit border over auto mode", () => {
    const border = resolveManageTextureBorder(
        { border: [9, 9, 9, 9], borderMode: "auto" },
        { width: 48, height: 60 },
        { rawWidth: 48, rawHeight: 60 },
    );

    assert.deepEqual(border, [9, 9, 9, 9]);
});

test("resolveManageTextureBorder derives border from meta when borderMode is auto", () => {
    const border = resolveManageTextureBorder(
        { borderMode: "auto" },
        { width: 48, height: 60 },
        { rawWidth: 48, rawHeight: 60 },
    );

    assert.deepEqual(border, [24, 24, 24, 24]);
});

test("resolveManageTextureBorder returns null when auto mode has no usable size", () => {
    const border = resolveManageTextureBorder(
        { borderMode: "auto" },
        {},
        {},
    );

    assert.equal(border, null);
});

test("selectTextureMetaCandidateForAutoBorder prefers fallback meta with usable size", () => {
    const candidate = selectTextureMetaCandidateForAutoBorder([
        {
            meta: { type: "sprite" },
            subMeta: { importer: "sprite-frame" },
        },
        {
            meta: { width: 48, height: 60, type: "sprite" },
            subMeta: { rawWidth: 48, rawHeight: 60, importer: "sprite-frame" },
        },
    ]);

    assert.ok(candidate);
    assert.deepEqual(candidate.meta, { width: 48, height: 60, type: "sprite" });
    assert.deepEqual(candidate.subMeta, { rawWidth: 48, rawHeight: 60, importer: "sprite-frame" });
});

test("selectTextureMetaCandidateForAutoBorder falls back to first candidate with subMeta when no size exists", () => {
    const candidate = selectTextureMetaCandidateForAutoBorder([
        {
            meta: { type: "sprite" },
            subMeta: { importer: "sprite-frame" },
        },
        {
            meta: { type: "sprite", subMetas: {} },
            subMeta: null,
        },
    ]);

    assert.ok(candidate);
    assert.deepEqual(candidate.meta, { type: "sprite" });
    assert.deepEqual(candidate.subMeta, { importer: "sprite-frame" });
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
