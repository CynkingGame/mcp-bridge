const test = require("node:test");
const assert = require("node:assert/strict");

const { disableSpriteFrameTrim } = require("../dist/utils/TextureMeta.js");

test("disableSpriteFrameTrim forces sprite-frame trimType to none", () => {
    const meta = {
        importer: "texture",
        type: "sprite",
        subMetas: {
            button: {
                importer: "sprite-frame",
                trimType: "auto",
                trimThreshold: 1,
                rawTextureUuid: "texture-uuid",
            },
        },
    };

    const changed = disableSpriteFrameTrim(meta);

    assert.equal(changed, true);
    assert.equal(meta.subMetas.button.trimType, "none");
});

test("disableSpriteFrameTrim leaves meta unchanged when trim is already none", () => {
    const meta = {
        importer: "texture",
        type: "sprite",
        subMetas: {
            loading: {
                importer: "sprite-frame",
                trimType: "none",
                trimThreshold: 1,
                rawTextureUuid: "texture-uuid",
            },
        },
    };

    const changed = disableSpriteFrameTrim(meta);

    assert.equal(changed, false);
    assert.equal(meta.subMetas.loading.trimType, "none");
});
