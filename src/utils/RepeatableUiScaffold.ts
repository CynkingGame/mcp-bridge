export interface RepeatableUiFieldInput {
	name: string;
	type: "label" | "sprite";
	placeholder?: string;
	width?: number;
	height?: number;
}

export interface RepeatableUiFieldSpec extends RepeatableUiFieldInput {
	nodeName: string;
	propertyName: string;
	componentGetter: "cc.Label" | "cc.Sprite";
}

export interface RepeatableUiScaffoldInput {
	itemName: string;
	containerName: string;
	prefabDir: string;
	scriptDir: string;
	fields: RepeatableUiFieldInput[];
	listDirection?: "vertical" | "horizontal" | "grid";
	useScrollView?: boolean;
	overwrite?: boolean;
	rootPreset?: string | null;
	itemWidth?: number;
	itemHeight?: number;
	containerWidth?: number;
	containerHeight?: number;
}

export interface RepeatableUiScaffoldSpec {
	itemName: string;
	containerName: string;
	prefabDir: string;
	scriptDir: string;
	itemPrefabPath: string;
	containerPrefabPath: string;
	itemScriptPath: string;
	controllerScriptPath: string;
	itemScriptClassName: string;
	controllerScriptClassName: string;
	fields: RepeatableUiFieldSpec[];
	listDirection: "vertical" | "horizontal" | "grid";
	useScrollView: boolean;
	overwrite: boolean;
	rootPreset: string | null;
	itemWidth: number;
	itemHeight: number;
	containerWidth: number;
	containerHeight: number;
}

export interface RepeatableUiBindingPlan {
	itemComponentType: string;
	controllerComponentType: string;
	controllerPrefabProperty: string;
	itemPrefabPath: string;
	containerPrefabPath: string;
}

function trimSlashes(input: string): string {
	return input.replace(/[\\/]+$/, "");
}

function ensureDbPath(input: string): string {
	return trimSlashes(input || "db://assets");
}

function toPascalCase(input: string): string {
	return String(input || "")
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

function toCamelCase(input: string): string {
	const pascal = toPascalCase(input);
	return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "";
}

function normalizeField(field: RepeatableUiFieldInput): RepeatableUiFieldSpec {
	const nodeName = toPascalCase(field.name);
	const propertyStem = toCamelCase(field.name);
	const isLabel = field.type === "label";
	return {
		...field,
		nodeName,
		propertyName: `${propertyStem}${isLabel ? "Label" : "Sprite"}`,
		componentGetter: isLabel ? "cc.Label" : "cc.Sprite",
	};
}

export function normalizeRepeatableUiScaffoldArgs(
	input: RepeatableUiScaffoldInput,
): RepeatableUiScaffoldSpec {
	const itemName = toPascalCase(input.itemName);
	const containerName = toPascalCase(input.containerName);
	const prefabDir = ensureDbPath(input.prefabDir);
	const scriptDir = ensureDbPath(input.scriptDir);
	const fields = (input.fields || []).map(normalizeField);

	return {
		itemName,
		containerName,
		prefabDir,
		scriptDir,
		itemPrefabPath: `${prefabDir}/${itemName}.prefab`,
		containerPrefabPath: `${prefabDir}/${containerName}.prefab`,
		itemScriptPath: `${scriptDir}/${itemName}.ts`,
		controllerScriptPath: `${scriptDir}/${containerName}.ts`,
		itemScriptClassName: itemName,
		controllerScriptClassName: containerName,
		fields,
		listDirection: input.listDirection || "vertical",
		useScrollView: input.useScrollView !== false,
		overwrite: !!input.overwrite,
		rootPreset: input.rootPreset || null,
		itemWidth: typeof input.itemWidth === "number" ? input.itemWidth : 600,
		itemHeight: typeof input.itemHeight === "number" ? input.itemHeight : 96,
		containerWidth: typeof input.containerWidth === "number" ? input.containerWidth : 720,
		containerHeight: typeof input.containerHeight === "number" ? input.containerHeight : 960,
	};
}

function buildFindAssignments(spec: RepeatableUiScaffoldSpec): string {
	return spec.fields
		.map(
			(field) =>
				`        this.${field.propertyName} = this.findComponent("${field.nodeName}", ${field.componentGetter});`,
		)
		.join("\n");
}

function buildFieldDeclarations(spec: RepeatableUiScaffoldSpec): string {
	return spec.fields.map((field) => `    private ${field.propertyName}: ${field.componentGetter} = null;`).join("\n");
}

function buildSetDataBody(spec: RepeatableUiScaffoldSpec): string {
	return spec.fields
		.map((field) => {
			if (field.type === "label") {
				return [
					`        if (data.${field.name} !== undefined && this.${field.propertyName}) {`,
					`            this.${field.propertyName}.string = String(data.${field.name});`,
					"        }",
				].join("\n");
			}
			return [
				`        if (data.${field.name} && this.${field.propertyName}) {`,
				`            this.${field.propertyName}.spriteFrame = data.${field.name};`,
				"        }",
			].join("\n");
		})
		.join("\n");
}

export function buildRepeatableItemScript(specInput: RepeatableUiScaffoldInput | RepeatableUiScaffoldSpec): string {
	const spec =
		(specInput as RepeatableUiScaffoldSpec).itemPrefabPath
			? (specInput as RepeatableUiScaffoldSpec)
			: normalizeRepeatableUiScaffoldArgs(specInput as RepeatableUiScaffoldInput);

	return `const { ccclass } = cc._decorator;

@ccclass
export default class ${spec.itemScriptClassName} extends cc.Component {
${buildFieldDeclarations(spec)}

    onLoad() {
${buildFindAssignments(spec)}
    }

    private findComponent(nodeName: string, componentType: any) {
        const target = this.node.getChildByName(nodeName);
        return target ? target.getComponent(componentType) : null;
    }

    setData(data: any) {
        if (!data) {
            return;
        }
${buildSetDataBody(spec)}
    }
}
`;
}

export function buildRepeatableControllerScript(
	specInput: RepeatableUiScaffoldInput | RepeatableUiScaffoldSpec,
): string {
	const spec =
		(specInput as RepeatableUiScaffoldSpec).itemPrefabPath
			? (specInput as RepeatableUiScaffoldSpec)
			: normalizeRepeatableUiScaffoldArgs(specInput as RepeatableUiScaffoldInput);

	return `const { ccclass, property } = cc._decorator;

@ccclass
export default class ${spec.controllerScriptClassName} extends cc.Component {
    @property(cc.Prefab)
    itemPrefab: cc.Prefab = null;

    private getContentNode(): cc.Node {
        const namedContent = this.node.getChildByName("Content");
        return namedContent || this.node;
    }

    render(list: any[]) {
        const content = this.getContentNode();
        if (!content || !this.itemPrefab) {
            return;
        }

        content.removeAllChildren();
        (list || []).forEach((data) => {
            const itemNode = cc.instantiate(this.itemPrefab);
            itemNode.parent = content;
            const itemComp = itemNode.getComponent("${spec.itemScriptClassName}") as any;
            if (itemComp && itemComp.setData) {
                itemComp.setData(data);
            }
        });
    }
}
`;
}

export function buildRepeatableUiBindingPlan(
	specInput: RepeatableUiScaffoldInput | RepeatableUiScaffoldSpec,
): RepeatableUiBindingPlan {
	const spec =
		(specInput as RepeatableUiScaffoldSpec).itemPrefabPath
			? (specInput as RepeatableUiScaffoldSpec)
			: normalizeRepeatableUiScaffoldArgs(specInput as RepeatableUiScaffoldInput);

	return {
		itemComponentType: spec.itemScriptClassName,
		controllerComponentType: spec.controllerScriptClassName,
		controllerPrefabProperty: "itemPrefab",
		itemPrefabPath: spec.itemPrefabPath,
		containerPrefabPath: spec.containerPrefabPath,
	};
}
