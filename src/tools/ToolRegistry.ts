// @ts-nocheck
import { getUiPolicySummary, loadProjectUiPolicyForCurrentEditor } from "../utils/UiPolicyLoader";

export const getToolsList = () => {
	const uiPolicy = loadProjectUiPolicyForCurrentEditor();
	const uiPolicySummary = getUiPolicySummary(uiPolicy);
	const globalPrecautions =
		"【AI 安全守则】: 1. 执行任何写操作前必须先通过 get_scene_hierarchy 或 manage_components(get) 验证主体存在。 2. 严禁基于假设盲目猜测属性名。 3. 资源属性（如 cc.Prefab）必须通过 UUID 进行赋值。 4. 严禁频繁刷新全局资源 (refresh_editor)，必须通过 properties.path 指定具体修改的文件或目录以防止编辑器长期卡死。";
	return [
		{
			name: "get_selected_node",
			description: `获取当前编辑器中选中的节点 ID。建议获取后立即调用 get_scene_hierarchy 确认该节点是否仍存在于当前场景中。`,
			inputSchema: { type: "object", properties: {} },
		},
		{
			name: "set_node_name",
			description: `${globalPrecautions} 修改指定节点的名称`,
			inputSchema: {
				type: "object",
				properties: {
					id: { type: "string", description: "节点的 UUID" },
					newName: { type: "string", description: "新的节点名称" },
				},
				required: ["id", "newName"],
			},
		},
		{
			name: "save_scene",
			description: `保存当前场景的修改`,
			inputSchema: { type: "object", properties: {} },
		},
		{
			name: "save_prefab",
			description: `保存当前正在编辑的预制体的修改（仅在 open_prefab 进入预制体编辑模式后使用）`,
			inputSchema: { type: "object", properties: {} },
		},
		{
			name: "close_prefab",
			description: `退出预制体编辑模式，返回普通场景编辑状态`,
			inputSchema: { type: "object", properties: {} },
		},
		{
			name: "get_scene_hierarchy",
			description: `获取当前场景的节点树结构（包含 UUID、名称、子节点数）。若要查询节点组件详情等，请使用 manage_components。`,
			inputSchema: {
				type: "object",
				properties: {
					nodeId: { type: "string", description: "指定的根节点 UUID。如果不传则获取整个场景的根。" },
					depth: {
						type: "number",
						description: "遍历的深度限制，默认为 2。用来防止过大场景导致返回数据超长。",
					},
					includeDetails: { type: "boolean", description: "是否包含坐标、缩放等杂项详情，默认为 false。" },
				},
			},
		},
		{
			name: "update_node_transform",
			description: `${globalPrecautions} 修改节点的坐标、缩放、颜色或显隐状态。执行前必须调用 get_scene_hierarchy 确保 node ID 有效。`,
			inputSchema: {
				type: "object",
				properties: {
					id: { type: "string", description: "节点 UUID" },
					active: { type: "boolean", description: "节点的激活状态 (显隐)" },
					x: { type: "number" },
					y: { type: "number" },
					rotation: { type: "number", description: "旋转角度" },
					width: { type: "number" },
					height: { type: "number" },
					scaleX: { type: "number" },
					scaleY: { type: "number" },
					anchorX: { type: "number", description: "锚点 X (0~1)" },
					anchorY: { type: "number", description: "锚点 Y (0~1)" },
					color: { type: "string", description: "HEX 颜色代码如 #FF0000" },
					opacity: { type: "number", description: "透明度 (0~255)" },
					skewX: { type: "number", description: "倾斜 X" },
					skewY: { type: "number", description: "倾斜 Y" },
				},
				required: ["id"],
			},
		},
		{
			name: "create_scene",
			description: `在 assets 目录下创建一个新的场景文件。创建并通过 open_scene 打开后，请务必初始化基础节点（如 Canvas 和 Camera）。`,
			inputSchema: {
				type: "object",
				properties: {
					sceneName: { type: "string", description: "场景名称" },
				},
				required: ["sceneName"],
			},
		},
		{
			name: "create_prefab",
			description: `${globalPrecautions} 将场景中的某个节点保存为预制体资源。对于全屏 UI 根节点，优先传入 rootPreset（如 screen-root / safe-area-root）或让插件按项目 Canvas 设计分辨率自动识别并补全根节点适配。`,
			inputSchema: {
				type: "object",
				properties: {
					nodeId: { type: "string", description: "节点 UUID" },
					prefabName: { type: "string", description: "预制体名称" },
					rootPreset: {
						type: "string",
						description: `可选的项目 UI 根节点预设名称。当前项目预设：${uiPolicySummary}`,
					},
				},
				required: ["nodeId", "prefabName"],
			},
		},
		{
			name: "open_scene",
			description: `打开场景文件。注意：这是一个异步且耗时的操作，打开后请等待几秒。重要：如果是新创建或空的场景，请务必先创建并初始化基础节点（Canvas/Camera）。`,
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "场景资源路径，如 db://assets/NewScene.fire",
					},
				},
				required: ["url"],
			},
		},
		{
			name: "scaffold_repeatable_ui",
			description: `${globalPrecautions} 为重复块 UI 生成脚手架。会直接创建 Item prefab、容器 prefab、Item 脚本和 Controller 脚本，适用于列表项、奖励格子、排行项等“同结构重复 3 次以上”的界面。`,
			inputSchema: {
				type: "object",
				properties: {
					itemName: { type: "string", description: "重复项预制体名称，如 RankItem" },
					containerName: { type: "string", description: "列表容器预制体名称，如 RankList" },
					prefabDir: { type: "string", description: "预制体目录，如 db://assets/prefabs/rank" },
					scriptDir: { type: "string", description: "脚本目录，如 db://assets/scripts/ui/rank" },
					fields: {
						type: "array",
						description: "重复项字段定义。label 用于文本，sprite 用于图片占位。",
						items: {
							type: "object",
							properties: {
								name: { type: "string", description: "字段名，如 rank / icon / score" },
								type: {
									type: "string",
									enum: ["label", "sprite"],
									description: "字段类型",
								},
								placeholder: { type: "string", description: "可选的占位文本" },
								width: { type: "number", description: "字段节点宽度" },
								height: { type: "number", description: "字段节点高度" },
							},
							required: ["name", "type"],
						},
					},
					listDirection: {
						type: "string",
						enum: ["vertical", "horizontal", "grid"],
						description: "容器中的内容布局方向",
					},
					useScrollView: { type: "boolean", description: "是否创建带 ScrollView 的容器" },
					rootPreset: {
						type: "string",
						description: `容器 prefab 根节点的项目 UI 预设。当前项目预设：${uiPolicySummary}`,
					},
					itemWidth: { type: "number", description: "Item 根节点宽度" },
					itemHeight: { type: "number", description: "Item 根节点高度" },
					containerWidth: { type: "number", description: "容器根节点宽度" },
					containerHeight: { type: "number", description: "容器根节点高度" },
					overwrite: { type: "boolean", description: "若资源已存在，是否覆盖" },
				},
				required: ["itemName", "containerName", "prefabDir", "scriptDir", "fields"],
			},
		},
		{
			name: "import_design_layout",
			description: `${globalPrecautions} 根据设计节点 JSON 直接生成更接近设计稿的 UI prefab。适用于设计师提供了结构化导出 JSON 的场景，会优先还原层级、尺寸、文本样式、内嵌图片和纯色块。`,
			inputSchema: {
				type: "object",
				properties: {
					jsonPath: {
						type: "string",
						description: "设计节点 JSON 路径。支持项目相对路径、绝对路径或 db:// 路径。",
					},
					prefabName: {
						type: "string",
						description: "输出 prefab 名称，如 HallPrizePanel。",
					},
					prefabDir: {
						type: "string",
						description: "输出 prefab 目录，如 db://assets/prefabs/hall。",
					},
					assetOutputDir: {
						type: "string",
						description: "导入过程中生成图片资源的目录，如 db://assets/textures/design/hall。",
					},
					imageAssetDir: {
						type: "string",
						description: "设计师单独提供的图片素材目录，如 db://assets/art/hall/prize。图片节点会优先从这里按名称匹配资源。",
					},
					imageAssetMap: {
						type: "object",
						description: "可选的显式图片映射。key 可填节点名或设计节点 id，value 为目标 Sprite 资源路径。用于自动匹配不稳定时的精确绑定。",
					},
					rootPreset: {
						type: "string",
						description: `根节点 UI 预设。当前项目预设：${uiPolicySummary}`,
					},
					importGeneratedShapes: {
						type: "boolean",
						description: "是否为纯色块/圆角块自动生成贴图资源，默认 true。",
					},
					overwrite: {
						type: "boolean",
						description: "若目标 prefab 或导入资源已存在，是否覆盖。",
					},
				},
				required: ["jsonPath", "prefabName"],
			},
		},
		{
			name: "open_prefab",
			description: `在编辑器中打开预制体文件进入编辑模式。注意：这是一个异步操作，打开后请等待几秒。`,
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "预制体资源路径，如 db://assets/prefabs/Test.prefab",
					},
				},
				required: ["url"],
			},
		},
		{
			name: "create_node",
			description: `${globalPrecautions} 在当前场景中创建一个新节点。重要提示：1. 如果指定 parentId，必须先通过 get_scene_hierarchy 确保该父节点真实存在且未被删除。2. 类型说明：'sprite' (100x100 尺寸 + 默认贴图), 'button' (150x50 尺寸 + 深色底图 + Button组件), 'label' (120x40 尺寸 + Label组件), 'empty' (纯空节点)。3. 当前项目启用了 UI policy，优先使用 uiPreset / layout，而不是手动猜测坐标。项目预设：${uiPolicySummary}`,
			inputSchema: {
				type: "object",
				properties: {
					name: { type: "string", description: "节点名称" },
					parentId: {
						type: "string",
						description: "父节点 UUID (可选，不传则挂在场景根部)",
					},
					type: {
						type: "string",
						enum: ["empty", "sprite", "label", "button"],
						description: "节点预设类型",
					},
					layout: {
						type: "string",
						enum: [
							"center",
							"top",
							"bottom",
							"left",
							"right",
							"top-left",
							"top-right",
							"bottom-left",
							"bottom-right",
							"full",
						],
						description:
							"自动挂载 cc.Widget 并进行快捷排版适配。推荐绝大多数 UI 元素在创建时使用此参数替代手动指定坐标。",
					},
					uiPreset: {
						type: "string",
						description: `可选的项目 UI 预设名称。预设可同时约束锚点、布局和安全区。当前项目预设：${uiPolicySummary}`,
					},
				},
				required: ["name"],
			},
		},
		{
			name: "apply_ui_policy",
			description: `${globalPrecautions} 将项目 UI policy 预设直接应用到现有节点。适用于已经打开的 prefab / scene 中的根节点、按钮或交互容器修正。`,
			inputSchema: {
				type: "object",
				properties: {
					nodeId: { type: "string", description: "目标节点 UUID" },
					preset: {
						type: "string",
						description: `项目 UI 预设名称。当前项目预设：${uiPolicySummary}`,
					},
				},
				required: ["nodeId", "preset"],
			},
		},
		{
			name: "validate_ui_prefab",
			description: `${globalPrecautions} 校验当前 UI 预制体/节点是否符合项目 UI policy。默认检查根节点适配与按钮锚点，可用于 AI 修改 prefab 后的自检。`,
			inputSchema: {
				type: "object",
				properties: {
					nodeId: { type: "string", description: "待校验的根节点 UUID" },
					expectedRootPreset: {
						type: "string",
						description: `可选的预期根节点预设。若不传，插件会按项目 Canvas 和节点尺寸自动推断。当前项目预设：${uiPolicySummary}`,
					},
				},
				required: ["nodeId"],
			},
		},
		{
			name: "manage_components",
			description: `${globalPrecautions} 管理节点组件。重要提示：1. 操作前必须调用 get_scene_hierarchy 确认 nodeId 对应的节点仍然存在。2. 添加前先用 'get' 检查是否已存在。3. 添加 cc.Sprite 后必须设置 spriteFrame 属性，否则节点不显示。4. 创建按钮时，请确保目标节点有足够的 width 和 height 作为点击区域。5. 赋值或更新属性前，必须确保目标属性在组件上真实存在，严禁盲目操作不存在的属性。6. 对于资源类属性（如 cc.Prefab, sp.SkeletonData），传递资源的 UUID。插件会自动进行异步加载并正确序列化，避免 Inspector 出现 Type Error。`,
			inputSchema: {
				type: "object",
				properties: {
					nodeId: { type: "string", description: "节点 UUID" },
					action: {
						type: "string",
						enum: ["add", "remove", "update", "get"],
						description:
							"操作类型 (add: 添加组件, remove: 移除组件, update: 更新组件属性, get: 获取组件列表)",
					},
					componentType: { type: "string", description: "组件类型，如 cc.Sprite (add/update 操作需要)" },
					componentId: { type: "string", description: "组件 ID (remove/update 操作可选)" },
					properties: {
						type: "object",
						description:
							"组件属性 (add/update 操作使用). 支持智能解析: 如果属性类型是组件但提供了节点UUID，会自动查找对应组件。",
					},
				},
				required: ["nodeId", "action"],
			},
		},
		{
			name: "manage_script",
			description: `${globalPrecautions} 管理脚本文件。注意：创建或修改脚本需时间编译。创建后必须调用 refresh_editor (务必指定 path) 生成 meta 文件，否则无法作为组件添加。`,
			inputSchema: {
				type: "object",
				properties: {
					action: { type: "string", enum: ["create", "delete", "read", "write"], description: "操作类型" },
					path: { type: "string", description: "脚本路径，如 db://assets/scripts/NewScript.js" },
					content: { type: "string", description: "脚本内容 (用于 create 和 write 操作)" },
					name: { type: "string", description: "脚本名称 (用于 create 操作)" },
				},
				required: ["action", "path"],
			},
		},
		{
			name: "batch_execute",
			description: `${globalPrecautions} 批处理执行多个操作`,
			inputSchema: {
				type: "object",
				properties: {
					operations: {
						type: "array",
						items: {
							type: "object",
							properties: {
								tool: { type: "string", description: "工具名称" },
								params: { type: "object", description: "工具参数" },
							},
							required: ["tool", "params"],
						},
						description: "操作列表",
					},
				},
				required: ["operations"],
			},
		},
		{
			name: "manage_asset",
			description: `${globalPrecautions} 管理资源`,
			inputSchema: {
				type: "object",
				properties: {
					action: { type: "string", enum: ["create", "delete", "move", "get_info"], description: "操作类型" },
					path: { type: "string", description: "资源路径，如 db://assets/textures" },
					targetPath: { type: "string", description: "目标路径 (用于 move 操作)" },
					content: { type: "string", description: "资源内容 (用于 create 操作)" },
				},
				required: ["action", "path"],
			},
		},
		{
			name: "scene_management",
			description: `${globalPrecautions} 场景管理`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["create", "delete", "duplicate", "get_info"],
						description: "操作类型",
					},
					path: { type: "string", description: "场景路径，如 db://assets/scenes/NewScene.fire" },
					targetPath: { type: "string", description: "目标路径 (用于 duplicate 操作)" },
					name: { type: "string", description: "场景名称 (用于 create 操作)" },
				},
				required: ["action", "path"],
			},
		},
		{
			name: "prefab_management",
			description: `${globalPrecautions} 预制体管理。对于 UI 预制体创建，优先传入 rootPreset 以套用项目根节点适配策略。`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["create", "update", "instantiate", "get_info"],
						description: "操作类型",
					},
					path: { type: "string", description: "预制体路径，如 db://assets/prefabs/NewPrefab.prefab" },
					nodeId: { type: "string", description: "节点 ID (用于 create 操作)" },
					parentId: { type: "string", description: "父节点 ID (用于 instantiate 操作)" },
					rootPreset: {
						type: "string",
						description: `可选的项目 UI 根节点预设名称。当前项目预设：${uiPolicySummary}`,
					},
				},
				required: ["action", "path"],
			},
		},
		{
			name: "manage_editor",
			description: `${globalPrecautions} 管理编辑器`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["get_selection", "set_selection", "refresh_editor"],
						description: "操作类型",
					},
					target: {
						type: "string",
						enum: ["node", "asset"],
						description: "目标类型 (用于 set_selection 操作)",
					},
					properties: {
						type: "object",
						description:
							"操作属性。⚠️极为重要：refresh_editor 必须通过 properties.path 指定精确的刷新路径（如 'db://assets/scripts/MyScript.ts'）。严禁不带 path 参数进行全局刷新 (db://assets)，这在大型项目中会导致编辑器卡死数分钟，严重阻塞工作流。",
					},
				},
				required: ["action"],
			},
		},
		{
			name: "find_gameobjects",
			description: `按条件在场景中搜索游戏对象。返回匹配节点的轻量级结构 (UUID, name, active, components 等)。若要获取完整的详细组件属性，请进一步对目标使用 manage_components。`,
			inputSchema: {
				type: "object",
				properties: {
					conditions: {
						type: "object",
						description:
							"查找条件。支持的属性：name (节点名称，支持模糊匹配), component (包含的组件类名，如 'cc.Sprite'), active (布尔值，节点的激活状态)。",
					},
					recursive: { type: "boolean", default: true, description: "是否递归查找所有子节点" },
				},
				required: ["conditions"],
			},
		},
		{
			name: "manage_material",
			description: `${globalPrecautions} 管理材质。支持创建、获取信息以及更新 Shader、Defines 和 Uniforms 参数。`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["create", "delete", "get_info", "update"],
						description: "操作类型",
					},
					path: { type: "string", description: "材质路径，如 db://assets/materials/NewMaterial.mat" },
					properties: {
						type: "object",
						description: "材质属性 (add/update 操作使用)",
						properties: {
							shaderUuid: { type: "string", description: "关联的 Shader (Effect) UUID" },
							defines: { type: "object", description: "预编译宏定义" },
							uniforms: { type: "object", description: "Uniform 参数列表" },
						},
					},
				},
				required: ["action", "path"],
			},
		},
		{
			name: "manage_texture",
			description: `${globalPrecautions} 管理纹理`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["create", "delete", "get_info", "update"],
						description: "操作类型",
					},
					path: { type: "string", description: "纹理路径，如 db://assets/textures/NewTexture.png" },
					properties: { type: "object", description: "纹理属性" },
				},
				required: ["action", "path"],
			},
		},
		{
			name: "ensure_current_9slice_textures",
			description: `${globalPrecautions} 扫描当前场景或预制体里已经用到的 Sprite/Button 纹理；若文件名命中项目 autoNineSlice 规则且 border 尚未设置，则自动补齐 9-slice，并把处理结果写入项目标记避免重复触发。`,
			inputSchema: {
				type: "object",
				properties: {},
			},
		},
		{
			name: "manage_shader",
			description: `${globalPrecautions} 管理着色器 (Effect)。支持创建、读取、更新、删除和获取信息。`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["create", "delete", "read", "write", "get_info"],
						description: "操作类型",
					},
					path: { type: "string", description: "着色器路径，如 db://assets/effects/NewEffect.effect" },
					content: { type: "string", description: "着色器内容 (create/write)" },
				},
				required: ["action", "path"],
			},
		},
		{
			name: "execute_menu_item",
			description: `${globalPrecautions} 执行菜单项。对于节点删除，请使用 "delete-node:UUID" 格式以确保精确执行。对于保存、撤销等操作，请优先使用专用工具 (save_scene, manage_undo)。`,
			inputSchema: {
				type: "object",
				properties: {
					menuPath: {
						type: "string",
						description: "菜单项路径 (支持 'Project/Build' 或 'delete-node:UUID')",
					},
				},
				required: ["menuPath"],
			},
		},
		{
			name: "apply_text_edits",
			description: `${globalPrecautions} 对文件应用文本编辑。**专用于修改脚本源代码 (.js, .ts) 或文本文件**。如果要修改场景节点属性，请使用 'manage_components'。`,
			inputSchema: {
				type: "object",
				properties: {
					edits: {
						type: "array",
						items: {
							type: "object",
							properties: {
								type: {
									type: "string",
									enum: ["insert", "delete", "replace"],
									description: "操作类型",
								},
								start: { type: "number", description: "起始偏移量 (字符索引)" },
								end: { type: "number", description: "结束偏移量 (delete/replace 用)" },
								position: { type: "number", description: "插入位置 (insert 用)" },
								text: { type: "string", description: "要插入或替换的文本" },
							},
						},
						description: "编辑操作列表。请严格使用偏移量(offset)而非行号。",
					},
					filePath: { type: "string", description: "文件路径 (db://...)" },
				},
				required: ["filePath", "edits"],
			},
		},
		{
			name: "read_console",
			description: `读取控制台`,
			inputSchema: {
				type: "object",
				properties: {
					limit: { type: "number", description: "输出限制" },
					type: {
						type: "string",
						enum: ["info", "warn", "error", "success", "mcp"],
						description: "输出类型 (info, warn, error, success, mcp)",
					},
				},
			},
		},
		{
			name: "validate_script",
			description: `验证脚本`,
			inputSchema: {
				type: "object",
				properties: {
					filePath: { type: "string", description: "脚本路径" },
				},
				required: ["filePath"],
			},
		},
		{
			name: "search_project",
			description: `搜索项目文件。支持三种模式：1. 'content' (默认): 搜索文件内容，支持正则表达式；2. 'file_name': 在指定目录下搜索匹配的文件名；3. 'dir_name': 在指定目录下搜索匹配的文件夹名。`,
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "搜索关键词或正则表达式模式" },
					useRegex: {
						type: "boolean",
						description:
							"是否将 query 视为正则表达式 (仅在 matchType 为 'content', 'file_name' 或 'dir_name' 时生效)",
					},
					path: {
						type: "string",
						description: "搜索起点路径，例如 'db://assets/scripts'。默认为 'db://assets'",
					},
					matchType: {
						type: "string",
						enum: ["content", "file_name", "dir_name"],
						description:
							"匹配模式：'content' (内容关键词/正则), 'file_name' (搜索文件名), 'dir_name' (搜索文件夹名)",
					},
					extensions: {
						type: "array",
						items: { type: "string" },
						description:
							"限定文件后缀 (如 ['.js', '.ts'])。仅在 matchType 为 'content' 或 'file_name' 时有效。",
						default: [".js", ".ts", ".json", ".fire", ".prefab", ".xml", ".txt", ".md"],
					},
					includeSubpackages: { type: "boolean", default: true, description: "是否递归搜索子目录" },
				},
				required: ["query"],
			},
		},
		{
			name: "manage_undo",
			description: `${globalPrecautions} 管理编辑器的撤销和重做历史`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["undo", "redo", "begin_group", "end_group", "cancel_group"],
						description: "操作类型",
					},
					description: { type: "string", description: "撤销组的描述 (用于 begin_group)" },
				},
				required: ["action"],
			},
		},
		{
			name: "manage_vfx",
			description: `${globalPrecautions} 管理全场景特效 (粒子系统)。重要提示：在创建或更新前，必须通过 get_scene_hierarchy 或 manage_components 确认父节点或目标节点的有效性。严禁对不存在的对象进行操作。`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["create", "update", "get_info"],
						description: "操作类型",
					},
					nodeId: { type: "string", description: "节点 UUID (用于 update/get_info)" },
					properties: {
						type: "object",
						description: "粒子系统属性 (用于 create/update)",
						properties: {
							duration: { type: "number", description: "发射时长" },
							emissionRate: { type: "number", description: "发射速率" },
							life: { type: "number", description: "生命周期" },
							lifeVar: { type: "number", description: "生命周期变化" },
							startColor: { type: "string", description: "起始颜色 (Hex)" },
							endColor: { type: "string", description: "结束颜色 (Hex)" },
							startSize: { type: "number", description: "起始大小" },
							endSize: { type: "number", description: "结束大小" },
							speed: { type: "number", description: "速度" },
							angle: { type: "number", description: "角度" },
							gravity: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
							file: { type: "string", description: "粒子文件路径 (plist) 或 texture 路径" },
						},
					},
					name: { type: "string", description: "节点名称 (用于 create)" },
					parentId: { type: "string", description: "父节点 ID (用于 create)" },
				},
				required: ["action"],
			},
		},
		{
			name: "get_sha",
			description: `获取指定文件的 SHA-256 哈希值`,
			inputSchema: {
				type: "object",
				properties: {
					path: { type: "string", description: "文件路径，如 db://assets/scripts/Test.ts" },
				},
				required: ["path"],
			},
		},
		{
			name: "manage_animation",
			description: `${globalPrecautions} 管理节点的动画组件。重要提示：在执行 play/pause 等操作前，必须先确认节点及其 Animation 组件存在。严禁操作空引用。`,
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["get_list", "get_info", "play", "stop", "pause", "resume"],
						description: "操作类型",
					},
					nodeId: { type: "string", description: "节点 UUID" },
					clipName: { type: "string", description: "动画剪辑名称 (用于 play)" },
				},
				required: ["action", "nodeId"],
			},
		},
		{
			name: "capture_editor_screenshot",
			description: `捕获当前编辑器窗口和场景视图的截图。返回 Base64 格式的 WebP 图像字符串。用于在需要对场景情况有视觉掌握时使用。`,
			inputSchema: {
				type: "object",
				properties: {},
			},
		},
		{
			name: "find_references",
			description: `查找当前场景中引用了指定节点或资源的所有位置。返回引用所在节点、组件类型、属性名等详细信息。支持查找节点引用（cc.Node）和资源引用（cc.Prefab, cc.SpriteFrame, sp.SkeletonData 等）。`,
			inputSchema: {
				type: "object",
				properties: {
					targetId: { type: "string", description: "要查找引用的目标 UUID（节点 UUID 或资源 UUID）" },
					targetType: {
						type: "string",
						enum: ["node", "asset", "auto"],
						description: "目标类型。'node' 查找节点引用，'asset' 查找资源引用，'auto' (默认) 自动检测",
					},
				},
				required: ["targetId"],
			},
		},
		{
			name: "build_project",
			description: `${globalPrecautions} 构建并导出 Cocos 项目。通过 Editor.Builder.build 实现。`,
			inputSchema: {
				type: "object",
				properties: {
					platform: { type: "string", description: "构建平台，如 web-mobile" },
					debug: { type: "boolean", description: "是否构建调试版" },
				},
				required: ["platform"],
			},
		},
		{
			name: "get_project_info",
			description: `获取当前项目的宏观信息，例如引擎版本、根目录、当前打开的场景等。`,
			inputSchema: { type: "object", properties: {} },
		},
	];
};
