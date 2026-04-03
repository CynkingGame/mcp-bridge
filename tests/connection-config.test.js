"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildConnectionConfigs } = require("../src/connection-config");

test("builds direct HTTP config using the selected port", () => {
	const result = buildConnectionConfigs({
		port: 4567,
		proxyScriptPath: "D:/Game/packages/mcp-bridge/src/mcp-proxy.js",
	});

	assert.equal(result.http.url, "http://127.0.0.1:4567");
	assert.match(result.http.snippet, /"url": "http:\/\/127\.0\.0\.1:4567"/);
});

test("builds stdio proxy config using the proxy script path", () => {
	const result = buildConnectionConfigs({
		port: 3456,
		proxyScriptPath: "D:/Game/packages/mcp-bridge/src/mcp-proxy.js",
	});

	assert.equal(result.stdio.command, "node");
	assert.deepEqual(result.stdio.args, ["D:/Game/packages/mcp-bridge/src/mcp-proxy.js"]);
	assert.match(result.stdio.snippet, /"command": "node"/);
	assert.match(result.stdio.snippet, /mcp-proxy\.js/);
});

test("uses the server name in both generated snippets", () => {
	const result = buildConnectionConfigs({
		port: 9000,
		serverName: "bigwin-cocos",
		proxyScriptPath: "D:/Game/packages/mcp-bridge/src/mcp-proxy.js",
	});

	assert.match(result.http.snippet, /"bigwin-cocos"/);
	assert.match(result.stdio.snippet, /"bigwin-cocos"/);
});
