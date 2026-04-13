const test = require("node:test");
const assert = require("node:assert/strict");

let importedDesignSprite = {};

try {
    importedDesignSprite = require("../dist/utils/ImportedDesignSprite.js");
} catch (_error) {}

test("preserveImportedSpriteNodeSize keeps JSON size for CUSTOM sprites", () => {
    assert.equal(typeof importedDesignSprite.preserveImportedSpriteNodeSize, "function");

    const node = {
        width: 48,
        height: 48,
        setContentSize(width, height) {
            this.width = width;
            this.height = height;
        },
    };

    importedDesignSprite.preserveImportedSpriteNodeSize(
        node,
        { preferredSizeMode: "CUSTOM" },
        { width: 672, height: 302 },
    );

    assert.equal(node.width, 672);
    assert.equal(node.height, 302);
});

test("preserveImportedSpriteNodeSize leaves RAW sprites unchanged", () => {
    assert.equal(typeof importedDesignSprite.preserveImportedSpriteNodeSize, "function");

    const node = {
        width: 48,
        height: 48,
        setContentSize(width, height) {
            this.width = width;
            this.height = height;
        },
    };

    importedDesignSprite.preserveImportedSpriteNodeSize(
        node,
        { preferredSizeMode: "RAW" },
        { width: 672, height: 302 },
    );

    assert.equal(node.width, 48);
    assert.equal(node.height, 48);
});

test("resolveImportedSpritePreferredMode keeps design CUSTOM mode when asset probe says RAW", () => {
    assert.equal(typeof importedDesignSprite.resolveImportedSpritePreferredMode, "function");

    const preferredMode = importedDesignSprite.resolveImportedSpritePreferredMode(
        { preferredSizeMode: "CUSTOM" },
        "RAW",
    );

    assert.equal(preferredMode, "CUSTOM");
});

test("resolveImportedSpritePreferredMode upgrades RAW design mode when asset probe detects CUSTOM", () => {
    assert.equal(typeof importedDesignSprite.resolveImportedSpritePreferredMode, "function");

    const preferredMode = importedDesignSprite.resolveImportedSpritePreferredMode(
        { preferredSizeMode: "RAW" },
        "CUSTOM",
    );

    assert.equal(preferredMode, "CUSTOM");
});

test("preserveImportedSpriteNodeSize keeps JSON size when detected mode upgrades RAW to CUSTOM", () => {
    assert.equal(typeof importedDesignSprite.preserveImportedSpriteNodeSize, "function");

    const node = {
        width: 48,
        height: 48,
        setContentSize(width, height) {
            this.width = width;
            this.height = height;
        },
    };

    importedDesignSprite.preserveImportedSpriteNodeSize(
        node,
        { preferredSizeMode: "RAW" },
        { width: 672, height: 302 },
        "CUSTOM",
    );

    assert.equal(node.width, 672);
    assert.equal(node.height, 302);
});
