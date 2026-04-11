import { Logger } from "./Logger";
import { CommandQueue } from "./CommandQueue";
import { getToolsList } from "../tools/ToolRegistry";
import { ToolDispatcher } from "../tools/ToolDispatcher";
import { McpWrappers } from "./McpWrappers";
import { handleJsonRpcRequest } from "./McpProtocol";

export class McpRouter {
	public static handleRequest(req: any, res: any) {
		const url = req.url;
		const body = req.bodyString; // 附加在请求上的 body 字符串
		const method = req.method || "GET";

		if (url === "/" && method === "GET") {
			res.writeHead(200);
			return res.end(
				JSON.stringify({
					name: "mcp-bridge",
					transport: "http-jsonrpc",
					message: "POST JSON-RPC MCP requests to /",
				}),
			);
		}

		if ((url === "/" || url === "/mcp") && method === "POST") {
			return McpRouter.handleStandardMcpRequest(body, res);
		}

		if (url === "/list-tools") {
			const tools = getToolsList();
			Logger.info(`AI Client requested tool list`);
			res.writeHead(200);
			return res.end(JSON.stringify({ tools: tools }));
		}

		if (url === "/list-resources") {
			const resources = McpWrappers.getResourcesList();
			Logger.info(`AI Client requested resource list`);
			res.writeHead(200);
			return res.end(JSON.stringify({ resources: resources }));
		}

		if (url === "/list-prompts") {
			const prompts = McpWrappers.getPromptsList();
			Logger.info(`AI Client requested prompt list`);
			res.writeHead(200);
			return res.end(JSON.stringify({ prompts }));
		}

		if (url === "/read-resource") {
			try {
				const { uri } = JSON.parse(body || "{}");
				Logger.mcp(`READ -> [${uri}]`);
				McpWrappers.handleReadResource(uri, (err: any, content: any) => {
					if (err) {
						Logger.error(`读取失败: ${err}`);
						res.writeHead(500);
						return res.end(JSON.stringify({ error: err }));
					}
					const resourceMap = McpWrappers.getResourceMap();
					const resourceMeta = resourceMap[uri];
					Logger.success(`读取成功: ${uri}`);
					res.writeHead(200);
					res.end(
						JSON.stringify({
							contents: [
								{
									uri: uri,
									mimeType: resourceMeta?.mimeType || "text/plain",
									text: typeof content === "string" ? content : JSON.stringify(content),
								},
							],
						}),
					);
				});
			} catch (e: any) {
				res.writeHead(500);
				res.end(JSON.stringify({ error: e.message }));
			}
			return;
		}

		if (url === "/get-prompt") {
			try {
				const { name, arguments: args } = JSON.parse(body || "{}");
				Logger.mcp(`PROMPT -> [${name}]`);
				McpWrappers.handleGetPrompt(name, args, (err: any, prompt: any) => {
					if (err) {
						Logger.error(`读取 prompt 失败: ${err}`);
						res.writeHead(500);
						return res.end(JSON.stringify({ error: err }));
					}
					Logger.success(`读取 prompt 成功: ${name}`);
					res.writeHead(200);
					res.end(JSON.stringify(prompt));
				});
			} catch (e: any) {
				res.writeHead(500);
				res.end(JSON.stringify({ error: e.message }));
			}
			return;
		}

		if (url === "/call-tool") {
			try {
				const { name, arguments: args } = JSON.parse(body || "{}");
				let argsPreview = "";
				if (args) {
					try {
						argsPreview = typeof args === "object" ? JSON.stringify(args) : String(args);
					} catch (e) {
						argsPreview = "[无法序列化的参数]";
					}
				}
				Logger.mcp(`REQ -> [${name}] (队列长度: ${CommandQueue.getLength()}) 参数: ${argsPreview}`);

				CommandQueue.enqueue((done) => {
					ToolDispatcher.handleMcpCall(name, args, (err: any, result: any) => {
						const response = {
							content: [
								{
									type: "text",
									text: err
										? `Error: ${err}`
										: typeof result === "object"
											? JSON.stringify(result)
											: result,
								},
							],
						};
						if (err) {
							Logger.error(`RES <- [${name}] 失败: ${err}`);
						} else {
							let preview = "";
							if (typeof result === "string") {
								preview = result;
							} else if (typeof result === "object") {
								try {
									preview = JSON.stringify(result);
								} catch (e) {
									preview = "Object (Circular/Unserializable)";
								}
							}
							Logger.success(`RES <- [${name}] 成功 : ${preview}`);
						}
						res.writeHead(200);
						res.end(JSON.stringify(response));
						done();
					});
				}).catch((rejectReason: any) => {
					res.writeHead(429);
					res.end(JSON.stringify({ error: String(rejectReason) }));
				});
			} catch (e: any) {
				if (e instanceof SyntaxError) {
					Logger.error(`JSON Parse Error: ${e.message}`);
					res.writeHead(400);
					res.end(JSON.stringify({ error: "Invalid JSON" }));
				} else {
					Logger.error(`Internal Server Error: ${e.message}`);
					res.writeHead(500);
					res.end(JSON.stringify({ error: e.message }));
				}
			}
			return;
		}

		res.writeHead(404);
		res.end(JSON.stringify({ error: "Not Found", url: url }));
	}

	private static handleStandardMcpRequest(body: string, res: any) {
		let request: any = null;
		try {
			request = JSON.parse(body || "{}");
		} catch (e: any) {
			res.writeHead(400);
			return res.end(
				JSON.stringify({
					jsonrpc: "2.0",
					id: null,
					error: {
						code: -32700,
						message: "Parse error",
					},
				}),
			);
		}

		handleJsonRpcRequest(request, {
			listTools: async () => getToolsList(),
			callTool: (name, args) =>
				new Promise((resolve, reject) => {
					let argsPreview = "";
					if (args) {
						try {
							argsPreview = typeof args === "object" ? JSON.stringify(args) : String(args);
						} catch (_e) {
							argsPreview = "[无法序列化的参数]";
						}
					}
					Logger.mcp(`[HTTP MCP] REQ -> [${name}] (队列长度: ${CommandQueue.getLength()}) 参数: ${argsPreview}`);

					CommandQueue.enqueue((done) => {
						ToolDispatcher.handleMcpCall(name, args, (err: any, result: any) => {
							const response = {
								content: [
									{
										type: "text",
										text: err
											? `Error: ${err}`
											: typeof result === "object"
												? JSON.stringify(result)
												: result,
									},
								],
								isError: !!err,
							};
							if (err) {
								Logger.error(`[HTTP MCP] RES <- [${name}] 失败: ${err}`);
							} else {
								Logger.success(`[HTTP MCP] RES <- [${name}] 成功`);
							}
							done();
							resolve(response);
						});
					}).catch((rejectReason: any) => {
						reject(new Error(String(rejectReason)));
					});
				}),
			listResources: async () => McpWrappers.getResourcesList(),
			readResource: (uri) =>
				new Promise((resolve, reject) => {
					Logger.mcp(`[HTTP MCP] READ -> [${uri}]`);
					McpWrappers.handleReadResource(uri, (err: any, content: any) => {
						if (err) {
							Logger.error(`[HTTP MCP] 读取失败: ${err}`);
							return reject(new Error(String(err)));
						}
						const resourceMap = McpWrappers.getResourceMap();
						const resourceMeta = resourceMap[uri];
						resolve({
							contents: [
								{
									uri,
									mimeType: resourceMeta?.mimeType || "text/plain",
									text: typeof content === "string" ? content : JSON.stringify(content),
								},
							],
						});
					});
				}),
			listPrompts: async () => McpWrappers.getPromptsList(),
			getPrompt: (name, args) =>
				new Promise((resolve, reject) => {
					Logger.mcp(`[HTTP MCP] PROMPT -> [${name}]`);
					McpWrappers.handleGetPrompt(name, args, (err: any, prompt: any) => {
						if (err) {
							Logger.error(`[HTTP MCP] prompt 读取失败: ${err}`);
							return reject(new Error(String(err)));
						}
						resolve(prompt);
					});
				}),
		})
			.then((response) => {
				if (response === null) {
					res.writeHead(202);
					return res.end();
				}
				res.writeHead(200);
				res.end(JSON.stringify(response));
			})
			.catch((e: any) => {
				res.writeHead(200);
				res.end(
					JSON.stringify({
						jsonrpc: "2.0",
						id: request && request.id !== undefined ? request.id : null,
						error: {
							code: -32603,
							message: e.message || String(e),
						},
					}),
				);
			});
	}
}
