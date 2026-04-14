const test = require("node:test");
const assert = require("node:assert/strict");

const { ToolDispatcher } = require("../dist/tools/ToolDispatcher.js");

function callManageEditor(args) {
    return new Promise((resolve) => {
        ToolDispatcher.manageEditor(args, (err, result) => {
            resolve({ err, result });
        });
    });
}

async function withEditor(editor, fn) {
    const previousEditor = global.Editor;
    global.Editor = editor;
    try {
        return await fn();
    } finally {
        global.Editor = previousEditor;
    }
}

test("manage_editor.reload_package returns error when Package API is unavailable", async () => {
    const response = await withEditor({}, () =>
        callManageEditor({
            action: "reload_package",
            properties: { name: "mcp-bridge" },
        }),
    );

    assert.equal(response.err, "当前编辑器不支持包重载");
    assert.equal(response.result, undefined);
});

test("manage_editor.reload_package returns error when package path cannot be resolved", async () => {
    const response = await withEditor(
        {
            Package: {
                reload: () => {},
                packagePath: () => "",
                find: () => "",
            },
        },
        () =>
            callManageEditor({
                action: "reload_package",
                properties: { name: "mcp-bridge" },
            }),
    );

    assert.equal(response.err, "找不到包: mcp-bridge");
    assert.equal(response.result, undefined);
});

test("manage_editor.reload_package resolves default package name and calls Editor.Package.reload", async () => {
    let capturedPackageName = null;
    let capturedReloadPath = null;

    const response = await withEditor(
        {
            Package: {
                packagePath: (name) => {
                    capturedPackageName = name;
                    return "packages://mcp-bridge";
                },
                reload: (packagePath, callback) => {
                    capturedReloadPath = packagePath;
                    callback(null);
                },
            },
        },
        () =>
            callManageEditor({
                action: "reload_package",
                properties: {},
            }),
    );

    assert.equal(capturedPackageName, "mcp-bridge");
    assert.equal(capturedReloadPath, "packages://mcp-bridge");
    assert.equal(response.err, null);
    assert.equal(response.result, "编辑器已重载包: mcp-bridge");
});

test("manage_editor.reload_package propagates Editor.Package.reload failures", async () => {
    const response = await withEditor(
        {
            Package: {
                packagePath: () => "packages://mcp-bridge",
                reload: (_packagePath, callback) => {
                    callback("reload failed");
                },
            },
        },
        () =>
            callManageEditor({
                action: "reload_package",
                properties: { name: "mcp-bridge" },
            }),
    );

    assert.equal(response.err, "reload failed");
    assert.equal(response.result, undefined);
});
