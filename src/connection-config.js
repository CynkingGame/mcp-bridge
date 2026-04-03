"use strict";

function normalizePort(port) {
	const parsedPort = parseInt(port, 10);
	return Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3456;
}

function normalizeServerName(serverName) {
	return serverName || "cocos-creator";
}

function normalizeProxyScriptPath(proxyScriptPath) {
	return (proxyScriptPath || "").replace(/\\/g, "/");
}

function buildConnectionConfigs(options) {
	const port = normalizePort(options && options.port);
	const serverName = normalizeServerName(options && options.serverName);
	const proxyScriptPath = normalizeProxyScriptPath(options && options.proxyScriptPath);
	const url = `http://127.0.0.1:${port}`;

	const httpSnippet = JSON.stringify(
		{
			mcpServers: {
				[serverName]: {
					url,
				},
			},
		},
		null,
		4,
	);

	const stdioSnippet = JSON.stringify(
		{
			mcpServers: {
				[serverName]: {
					command: "node",
					args: [proxyScriptPath],
				},
			},
		},
		null,
		4,
	);

	return {
		http: {
			url,
			snippet: httpSnippet,
		},
		stdio: {
			command: "node",
			args: [proxyScriptPath],
			snippet: stdioSnippet,
		},
	};
}

module.exports = {
	buildConnectionConfigs,
};
