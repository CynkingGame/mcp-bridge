const test = require("node:test");
const assert = require("node:assert/strict");

const {
    getNodeNamingPolicy,
    isNodeNameAllowed,
    sanitizeNodeName,
} = require("../dist/utils/NodeNaming.js");

test("node naming policy defaults to disabled english-only validation", () => {
    const policy = getNodeNamingPolicy({});

    assert.equal(policy.englishOnly, false);
    assert.equal(typeof policy.allowedPattern, "string");
});

test("english-only node naming rejects chinese characters", () => {
    const allowed = isNodeNameAllowed(
        {
            nodeNaming: {
                englishOnly: true,
            },
        },
        "邀请界面",
    );

    assert.equal(allowed, false);
});

test("sanitizeNodeName keeps ascii tokens and falls back to type plus id", () => {
    const usedNames = new Set();

    const mixedName = sanitizeNodeName("Ludo Tour选场2", {
        fallbackPrefix: "Container",
        fallbackSuffix: "root",
        usedNames,
    });
    const chineseName = sanitizeNodeName("开始", {
        fallbackPrefix: "Button",
        fallbackSuffix: "layer_144",
        usedNames,
    });

    assert.equal(mixedName, "Ludo_Tour_2");
    assert.equal(chineseName, "Button_layer_144");
});
