const test = require("node:test");
const assert = require("node:assert/strict");

let toolRegistry = {};

try {
    toolRegistry = require("../dist/tools/ToolRegistry.js");
} catch (_error) {}

test("tool registry exposes auto border mode entry point for manage_texture", () => {
    assert.equal(typeof toolRegistry.getToolsList, "function");

    const tools = toolRegistry.getToolsList();
    const tool = tools.find((item) => item.name === "manage_texture");

    assert.ok(tool, "expected manage_texture to be registered");
    assert.ok(tool.inputSchema.properties.properties);
    assert.match(tool.description, /纹理/);
});

test("manage_texture schema includes borderMode auto", () => {
    const tools = toolRegistry.getToolsList();
    const tool = tools.find((item) => item.name === "manage_texture");

    assert.ok(tool);
    assert.ok(tool.inputSchema.properties.properties.properties.borderMode);
    assert.deepEqual(
        tool.inputSchema.properties.properties.properties.borderMode.enum,
        ["auto"],
    );
});
