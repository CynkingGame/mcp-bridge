export interface JsonRpcRequest {
	jsonrpc?: string;
	id?: string | number | null;
	method?: string;
	params?: Record<string, any>;
}

export interface McpProtocolDeps {
	listTools: () => Promise<any[]> | any[];
	callTool: (name: string, args: Record<string, any>) => Promise<any> | any;
	listResources: () => Promise<any[]> | any[];
	readResource: (uri: string) => Promise<any> | any;
}

function successResponse(id: string | number | null | undefined, result: any) {
	return {
		jsonrpc: "2.0",
		id,
		result,
	};
}

function errorResponse(id: string | number | null | undefined, code: number, message: string) {
	return {
		jsonrpc: "2.0",
		id: id === undefined ? null : id,
		error: {
			code,
			message,
		},
	};
}

export async function handleJsonRpcRequest(
	request: JsonRpcRequest,
	deps: McpProtocolDeps,
): Promise<Record<string, any> | null> {
	const id = request && request.id;
	const method = request && request.method;
	const params = (request && request.params) || {};

	if (!method) {
		return errorResponse(id, -32600, "Invalid Request");
	}

	if (method === "notifications/initialized") {
		return null;
	}

	if (method === "initialize") {
		return successResponse(id, {
			protocolVersion: "2024-11-05",
			capabilities: {
				tools: {},
				resources: {},
			},
			serverInfo: {
				name: "mcp-bridge",
				version: "1.2.0",
			},
		});
	}

	if (method === "ping") {
		return successResponse(id, {});
	}

	if (method === "tools/list") {
		return successResponse(id, {
			tools: await deps.listTools(),
		});
	}

	if (method === "tools/call") {
		return successResponse(id, await deps.callTool(params.name, params.arguments || {}));
	}

	if (method === "resources/list") {
		return successResponse(id, {
			resources: await deps.listResources(),
		});
	}

	if (method === "resources/read") {
		return successResponse(id, await deps.readResource(params.uri));
	}

	if (method === "resources/templates/list") {
		return successResponse(id, {
			resourceTemplates: [],
		});
	}

	if (method === "prompts/list") {
		return successResponse(id, {
			prompts: [],
		});
	}

	return errorResponse(id, -32601, `Method not found: ${method}`);
}
