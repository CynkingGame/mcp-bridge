const test = require("node:test");
const assert = require("node:assert/strict");

let mcpProtocol = {};
let mcpConfigurator = {};

try {
    mcpProtocol = require("../dist/core/McpProtocol.js");
} catch (_error) {}

try {
    mcpConfigurator = require("../dist/McpConfigurator.js");
} catch (_error) {}

test("handleJsonRpcRequest supports standard MCP initialize and notifications", async () => {
    assert.equal(typeof mcpProtocol.handleJsonRpcRequest, "function");

    const initialize = await mcpProtocol.handleJsonRpcRequest(
        {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {},
        },
        {
            listTools: async () => [],
            callTool: async () => ({}),
            listResources: async () => [],
            readResource: async () => ({ contents: [] }),
        },
    );

    assert.equal(initialize.jsonrpc, "2.0");
    assert.equal(initialize.id, 1);
    assert.equal(initialize.result.protocolVersion, "2024-11-05");
    assert.ok(initialize.result.capabilities.tools);
    assert.ok(initialize.result.capabilities.resources);

    const notification = await mcpProtocol.handleJsonRpcRequest(
        {
            jsonrpc: "2.0",
            method: "notifications/initialized",
            params: {},
        },
        {
            listTools: async () => [],
            callTool: async () => ({}),
            listResources: async () => [],
            readResource: async () => ({ contents: [] }),
        },
    );

    assert.equal(notification, null);
});

test("handleJsonRpcRequest supports tools and resources over standard MCP", async () => {
    const responseList = await mcpProtocol.handleJsonRpcRequest(
        {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: {},
        },
        {
            listTools: async () => [{ name: "import_design_layout" }],
            callTool: async () => ({ content: [{ type: "text", text: "ok" }] }),
            listResources: async () => [{ uri: "cocos://ui/workflow" }],
            readResource: async () => ({
                contents: [{ uri: "cocos://ui/workflow", mimeType: "text/markdown", text: "# workflow" }],
            }),
        },
    );
    assert.deepEqual(responseList.result.tools, [{ name: "import_design_layout" }]);

    const responseCall = await mcpProtocol.handleJsonRpcRequest(
        {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "import_design_layout",
                arguments: { jsonPath: "hall_info/test.json" },
            },
        },
        {
            listTools: async () => [],
            callTool: async (name, args) => ({
                content: [{ type: "text", text: `${name}:${args.jsonPath}` }],
            }),
            listResources: async () => [],
            readResource: async () => ({ contents: [] }),
        },
    );
    assert.equal(responseCall.result.content[0].text, "import_design_layout:hall_info/test.json");

    const responseResources = await mcpProtocol.handleJsonRpcRequest(
        {
            jsonrpc: "2.0",
            id: 4,
            method: "resources/list",
            params: {},
        },
        {
            listTools: async () => [],
            callTool: async () => ({}),
            listResources: async () => [{ uri: "cocos://ui/workflow" }],
            readResource: async () => ({ contents: [] }),
        },
    );
    assert.deepEqual(responseResources.result.resources, [{ uri: "cocos://ui/workflow" }]);
});

test("buildClientMcpServerConfig uses url transport for Codex", () => {
    assert.equal(typeof mcpConfigurator.buildClientMcpServerConfig, "function");
    assert.equal(typeof mcpConfigurator.isConfiguredBridgeEntry, "function");

    const codexConfig = mcpConfigurator.buildClientMcpServerConfig("Codex", 3456);
    const cursorConfig = mcpConfigurator.buildClientMcpServerConfig("Cursor", 3456);

    assert.deepEqual(codexConfig, {
        url: "http://127.0.0.1:3456",
    });
    assert.equal(
        mcpConfigurator.isConfiguredBridgeEntry("Codex", { url: "http://127.0.0.1:3456" }, 3456),
        true,
    );
    assert.equal(cursorConfig.command, "node");
    assert.equal(Array.isArray(cursorConfig.args), true);
});
