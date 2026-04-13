export interface PrefabScriptNodeSnapshot {
	name: string;
	components?: string[];
	binding?: {
		propertyName?: string;
		dataKey?: string;
		group?: string;
		handlerName?: string;
	};
	children?: PrefabScriptNodeSnapshot[];
}

export interface PrefabScriptBindingSpec {
	propertyName: string;
	componentType: string;
	nodeName: string;
	nodePath: string;
	pathIndices: number[];
	dataKey?: string;
	handlerName?: string;
	group?: string;
}

export interface PrefabScriptScaffoldSpec {
	className: string;
	scriptPath: string;
	dataInterfaceName?: string;
	bindings: PrefabScriptBindingSpec[];
}

export interface PrefabScriptScaffoldOptions {
	dataInterfaceName?: string;
}

interface ComponentConfig {
	name: string;
	componentType: string;
	suffix: string;
	dataDriven?: boolean;
	interactive?: boolean;
	skipWhen?: string;
}

const COMPONENT_CONFIGS: ComponentConfig[] = [
	{
		name: "Button",
		componentType: "cc.Button",
		suffix: "Button",
		interactive: true,
	},
	{
		name: "ScrollView",
		componentType: "cc.ScrollView",
		suffix: "ScrollView",
		interactive: true,
	},
	{
		name: "EditBox",
		componentType: "cc.EditBox",
		suffix: "EditBox",
		interactive: true,
	},
	{
		name: "Toggle",
		componentType: "cc.Toggle",
		suffix: "Toggle",
		interactive: true,
	},
	{
		name: "Label",
		componentType: "cc.Label",
		suffix: "Label",
		dataDriven: true,
	},
	{
		name: "RichText",
		componentType: "cc.RichText",
		suffix: "RichText",
		dataDriven: true,
	},
	{
		name: "Sprite",
		componentType: "cc.Sprite",
		suffix: "Sprite",
		dataDriven: true,
		skipWhen: "Button",
	},
] as const;

function normalizeComponentName(componentName: string): string {
	return String(componentName || "").replace(/^cc\./, "").trim();
}

function toPascalCase(input: string): string {
	return String(input || "")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

function toCamelCase(input: string): string {
	const pascal = toPascalCase(input);
	return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "";
}

function ensureIdentifierStart(input: string, prefix: string): string {
	const normalized = String(input || "").trim();
	if (!normalized) {
		return prefix;
	}
	if (/^[A-Za-z_$]/.test(normalized)) {
		return normalized;
	}
	return `${prefix}${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function trimPropertySuffix(stem: string, suffix: string): string {
	const lowerStem = stem.toLowerCase();
	const lowerSuffix = suffix.toLowerCase();
	if (lowerStem.endsWith(lowerSuffix) && stem.length > suffix.length) {
		return stem.slice(0, stem.length - suffix.length);
	}
	return stem;
}

function makePropertyName(nodeName: string, suffix: string): string {
	const rawStem = toCamelCase(nodeName) || "node";
	const stem = trimPropertySuffix(rawStem, suffix);
	return ensureIdentifierStart(`${stem}${suffix}`, "node");
}

function makeDataKey(propertyName: string, suffix: string): string {
	const key = trimPropertySuffix(propertyName, suffix).replace(/^[A-Z]/, (value) => value.toLowerCase());
	return ensureIdentifierStart(key, "node");
}

function makeButtonHandlerName(propertyName: string): string {
	const base = propertyName.endsWith("Button") ? propertyName : `${propertyName}Button`;
	return `on${base.charAt(0).toUpperCase()}${base.slice(1)}Click`;
}

function makeNodePath(pathNames: string[]): string {
	return pathNames.join("/");
}

function groupBindings<T>(
	bindings: PrefabScriptBindingSpec[],
	renderItem: (binding: PrefabScriptBindingSpec) => T,
	joiner: string,
): string {
	const lines: string[] = [];
	let currentGroup = "";
	bindings.forEach((binding, index) => {
		const nextGroup = String(binding.group || "");
		if (nextGroup && nextGroup !== currentGroup) {
			if (index > 0) {
				lines.push("");
			}
			lines.push(`    // ${nextGroup}`);
			currentGroup = nextGroup;
		}
		lines.push(String(renderItem(binding)));
	});
	return lines.join(joiner);
}

function makeViewDataType(binding: PrefabScriptBindingSpec): string {
	if (binding.componentType === "cc.Sprite") {
		return "cc.SpriteFrame | null";
	}
	return "string | number";
}

export function derivePrefabScriptPath(prefabPath: string): string {
	const normalized = String(prefabPath || "").replace(/\\/g, "/");
	if (!normalized.endsWith(".prefab")) {
		return normalized;
	}

	const withoutExt = normalized.replace(/\.prefab$/i, "");
	if (withoutExt.includes("/prefabs/")) {
		return `${withoutExt.replace("/prefabs/", "/scripts/")}.ts`;
	}

	const parts = withoutExt.split("/");
	const fileName = parts.pop() || "NewPrefab";
	return `${parts.join("/")}/scripts/${fileName}.ts`;
}

export function buildPrefabScriptScaffoldSpec(
	prefabPath: string,
	rootNode: PrefabScriptNodeSnapshot,
	options?: PrefabScriptScaffoldOptions,
): PrefabScriptScaffoldSpec {
	const className = ensureIdentifierStart(toPascalCase(rootNode && rootNode.name) || "NewPrefab", "Node");
	const scriptPath = derivePrefabScriptPath(prefabPath);
	const bindings: PrefabScriptBindingSpec[] = [];
	const usedPropertyNames = new Set<string>();

	const allocatePropertyName = (candidate: string) => {
		let nextName = candidate;
		let index = 2;
		while (usedPropertyNames.has(nextName)) {
			nextName = `${candidate}${index}`;
			index++;
		}
		usedPropertyNames.add(nextName);
		return nextName;
	};

	const walk = (node: PrefabScriptNodeSnapshot, pathNames: string[], pathIndices: number[]) => {
		const componentNames = new Set((node.components || []).map(normalizeComponentName));
		const bindingHints = node.binding || {};
		COMPONENT_CONFIGS.forEach((config) => {
			if (!componentNames.has(config.name)) {
				return;
			}
			if (config.skipWhen && componentNames.has(config.skipWhen)) {
				return;
			}
			const defaultPropertyName = makePropertyName(node.name, config.suffix);
			const propertyName = allocatePropertyName(
				ensureIdentifierStart(String(bindingHints.propertyName || defaultPropertyName).trim(), "node"),
			);
			bindings.push({
				propertyName,
				componentType: config.componentType,
				nodeName: node.name,
				nodePath: makeNodePath(pathNames),
				pathIndices: pathIndices.slice(),
				dataKey: config.dataDriven
					? String(bindingHints.dataKey || makeDataKey(propertyName, config.suffix)).trim()
					: undefined,
				handlerName:
					config.interactive && config.name === "Button"
						? String(bindingHints.handlerName || makeButtonHandlerName(propertyName)).trim()
						: undefined,
				group: String(bindingHints.group || "").trim() || undefined,
			});
		});

		(node.children || []).forEach((child, index) => {
			walk(child, [...pathNames, child.name], [...pathIndices, index]);
		});
	};

	walk(rootNode, [], []);

	return {
		className,
		scriptPath,
		dataInterfaceName: String(options && options.dataInterfaceName ? options.dataInterfaceName : "").trim() || undefined,
		bindings,
	};
}

function buildPropertyDeclarations(spec: PrefabScriptScaffoldSpec): string {
	return groupBindings(
		spec.bindings,
		(binding) =>
			`    @property(${binding.componentType})\n    private ${binding.propertyName}: ${binding.componentType} = null;`,
		"\n\n",
	);
}

function buildDataInterface(spec: PrefabScriptScaffoldSpec): string {
	if (!spec.dataInterfaceName) {
		return "";
	}
	const seenKeys = new Set<string>();
	const lines = spec.bindings
		.filter((binding) => binding.dataKey)
		.filter((binding) => {
			if (!binding.dataKey || seenKeys.has(binding.dataKey)) {
				return false;
			}
			seenKeys.add(binding.dataKey);
			return true;
		})
		.map((binding) => `    ${binding.dataKey}?: ${makeViewDataType(binding)};`);
	return `export interface ${spec.dataInterfaceName} {\n${lines.join("\n")}\n}\n\n`;
}

function getBindingGroups(
	spec: PrefabScriptScaffoldSpec,
): Array<{ groupName: string; methodSuffix: string; bindings: PrefabScriptBindingSpec[] }> {
	const groups: Array<{ groupName: string; methodSuffix: string; bindings: PrefabScriptBindingSpec[] }> = [];
	const lookup = new Map<string, { groupName: string; methodSuffix: string; bindings: PrefabScriptBindingSpec[] }>();

	spec.bindings.forEach((binding) => {
		const groupName = String(binding.group || "").trim() || "content";
		if (!lookup.has(groupName)) {
			const groupSpec = {
				groupName,
				methodSuffix: toPascalCase(groupName) || "Content",
				bindings: [],
			};
			lookup.set(groupName, groupSpec);
			groups.push(groupSpec);
		}
		lookup.get(groupName)!.bindings.push(binding);
	});

	return groups;
}

function buildBindingAssignment(binding: PrefabScriptBindingSpec): string {
	if (binding.componentType === "cc.Sprite") {
		return [
			`        if (data.${binding.dataKey} !== undefined && this.${binding.propertyName}) {`,
			`            this.${binding.propertyName}.spriteFrame = data.${binding.dataKey};`,
			"        }",
		].join("\n");
	}
	return [
		`        if (data.${binding.dataKey} !== undefined && this.${binding.propertyName}) {`,
		`            this.${binding.propertyName}.string = String(data.${binding.dataKey});`,
		"        }",
	].join("\n");
}

function buildSetDataMethods(spec: PrefabScriptScaffoldSpec, viewDataType: string): string {
	return getBindingGroups(spec)
		.map((group) => {
			const dataBindings = group.bindings.filter((binding) => binding.dataKey);
			const body =
				dataBindings.length > 0
					? dataBindings.map((binding) => buildBindingAssignment(binding)).join("\n")
					: "        // No direct data bindings for this module.";
			return `    private setData${group.methodSuffix}(data: ${viewDataType}) {\n${body}\n    }`;
		})
		.join("\n\n");
}

function buildRenderMethods(spec: PrefabScriptScaffoldSpec): string {
	return getBindingGroups(spec)
		.map(
			(group) =>
				`    private render${group.methodSuffix}() {\n        // TODO: update ${group.groupName} presentation/state.\n    }`,
		)
		.join("\n\n");
}

function buildSetDataBody(spec: PrefabScriptScaffoldSpec): string {
	const groups = getBindingGroups(spec);
	if (groups.length === 0) {
		return ["        if (!data) {", "            return;", "        }", "        this.viewData = data;", "        this.render();"].join(
			"\n",
		);
	}
	return [
		"        if (!data) {",
		"            return;",
		"        }",
		"        this.viewData = data;",
		...groups.map((group) => `        this.setData${group.methodSuffix}(data);`),
		"        this.render();",
	].join("\n");
}

function buildRenderBody(spec: PrefabScriptScaffoldSpec): string {
	const groups = getBindingGroups(spec);
	return groups.length > 0
		? groups.map((group) => `        this.render${group.methodSuffix}();`).join("\n")
		: "        // TODO: add render modules when this prefab needs them.";
}

function buildButtonHandlers(spec: PrefabScriptScaffoldSpec): string {
	return spec.bindings
		.filter((binding) => binding.handlerName)
		.map(
			(binding) =>
				`    ${binding.handlerName}(event?: cc.Event.EventTouch, customData?: string) {\n        // TODO: handle ${binding.nodeName} click.\n    }`,
		)
		.join("\n\n");
}

export function buildPrefabComponentScript(specInput: PrefabScriptScaffoldSpec): string {
	const dataInterfaceBlock = buildDataInterface(specInput);
	const propertyBlock = buildPropertyDeclarations(specInput);
	const setDataBody = buildSetDataBody(specInput);
	const renderBody = buildRenderBody(specInput);
	const setDataMethods = buildSetDataMethods(specInput, specInput.dataInterfaceName || "any");
	const renderMethods = buildRenderMethods(specInput);
	const buttonHandlers = buildButtonHandlers(specInput);
	const refreshDataType = specInput.dataInterfaceName || "any";

	return `const { ccclass, property } = cc._decorator;

${dataInterfaceBlock}@ccclass
export default class ${specInput.className} extends cc.Component {
${propertyBlock}

    private viewData: ${refreshDataType} | null = null;

    setData(data: ${refreshDataType}) {
${setDataBody}
    }

    refreshView(data: ${refreshDataType}) {
        this.setData(data);
    }

    render() {
${renderBody}
    }

${setDataMethods || "    private setDataContent(data: any) {\n        void data;\n    }\n"}

${renderMethods || "    private renderContent() {\n        // TODO: update content presentation/state.\n    }\n"}

${buttonHandlers || "    // TODO: add interaction handlers when this prefab needs them.\n"}
}
`;
}

function resolveNodeByPathIndices(
	rootNode: PrefabScriptNodeSnapshot | null | undefined,
	pathIndices: number[],
): PrefabScriptNodeSnapshot | null {
	let current = rootNode || null;
	for (const index of pathIndices || []) {
		if (!current || !Array.isArray(current.children) || !current.children[index]) {
			return null;
		}
		current = current.children[index];
	}
	return current;
}

export function buildPrefabComponentBindings(
	spec: PrefabScriptScaffoldSpec,
	rootNode: PrefabScriptNodeSnapshot,
): {
	properties: Record<string, string>;
	buttonEvents: Array<{ nodeId: string; handlerName: string }>;
} {
	const properties: Record<string, string> = {};
	const buttonEvents: Array<{ nodeId: string; handlerName: string }> = [];

	spec.bindings.forEach((binding) => {
		const targetNode = resolveNodeByPathIndices(rootNode, binding.pathIndices);
		if (!targetNode || !(targetNode as any).uuid) {
			return;
		}
		properties[binding.propertyName] = (targetNode as any).uuid;
		if (binding.handlerName && binding.componentType === "cc.Button") {
			buttonEvents.push({
				nodeId: (targetNode as any).uuid,
				handlerName: binding.handlerName,
			});
		}
	});

	return {
		properties,
		buttonEvents,
	};
}
