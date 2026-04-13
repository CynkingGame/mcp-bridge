const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildProjectFontAssetIndex,
    resolveProjectFontAssetUrl,
    resolveProjectFontAssetUuid,
} = require("../dist/utils/FontAssetResolver.js");

test("buildProjectFontAssetIndex exposes normalized aliases for font assets", () => {
    const index = buildProjectFontAssetIndex([
        "db://assets/hall/fonts/Roboto-Regular.ttf",
        "db://assets/hall/fonts/Roboto-Bold.ttf",
        "db://assets/hall/fonts/SF-UI-Medium.ttf",
    ]);

    assert.equal(index.get("robotoregular"), "db://assets/hall/fonts/Roboto-Regular.ttf");
    assert.equal(index.get("roboto"), "db://assets/hall/fonts/Roboto-Regular.ttf");
    assert.equal(index.get("robotobold"), "db://assets/hall/fonts/Roboto-Bold.ttf");
    assert.equal(index.get("sfuimedium"), "db://assets/hall/fonts/SF-UI-Medium.ttf");
});

test("resolveProjectFontAssetUrl matches exact project fonts instead of system family names", () => {
    const assetUrls = [
        "db://assets/hall/fonts/Roboto-Regular.ttf",
        "db://assets/hall/fonts/Roboto-Medium.ttf",
        "db://assets/hall/fonts/Roboto-Bold.ttf",
    ];

    assert.equal(resolveProjectFontAssetUrl("Roboto-Regular", assetUrls), "db://assets/hall/fonts/Roboto-Regular.ttf");
    assert.equal(resolveProjectFontAssetUrl("Roboto Medium", assetUrls), "db://assets/hall/fonts/Roboto-Medium.ttf");
    assert.equal(resolveProjectFontAssetUrl("Roboto-Bold", assetUrls), "db://assets/hall/fonts/Roboto-Bold.ttf");
    assert.equal(resolveProjectFontAssetUrl("Roboto", assetUrls), "db://assets/hall/fonts/Roboto-Regular.ttf");
    assert.equal(resolveProjectFontAssetUrl("Arial", assetUrls), null);
});

test("resolveProjectFontAssetUuid converts matched font assets into uuids", () => {
    const assetUrls = [
        "db://assets/hall/fonts/Roboto-Regular.ttf",
        "db://assets/hall/fonts/Roboto-Medium.ttf",
    ];
    const uuidByUrl = new Map([
        ["db://assets/hall/fonts/Roboto-Regular.ttf", "uuid-regular"],
        ["db://assets/hall/fonts/Roboto-Medium.ttf", "uuid-medium"],
    ]);

    assert.equal(
        resolveProjectFontAssetUuid("Roboto-Regular", assetUrls, (assetUrl) => uuidByUrl.get(assetUrl)),
        "uuid-regular",
    );
    assert.equal(
        resolveProjectFontAssetUuid("Roboto Medium", assetUrls, (assetUrl) => uuidByUrl.get(assetUrl)),
        "uuid-medium",
    );
    assert.equal(resolveProjectFontAssetUuid("Arial", assetUrls, (assetUrl) => uuidByUrl.get(assetUrl)), null);
});
