interface SerializedSubtreeResult {
	objects: any[];
	orderedIndices: number[];
	rootIndex: number;
	missingIndices: number[];
}

function collectReferencedIds(value: any, ignoreKeys: Record<string, boolean> | null, collected: Set<number>) {
	if (!value || typeof value !== "object") {
		return;
	}
	if (!Array.isArray(value) && typeof value.__id__ === "number") {
		collected.add(value.__id__);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item) => collectReferencedIds(item, ignoreKeys, collected));
		return;
	}
	Object.keys(value).forEach((key) => {
		if (ignoreKeys && ignoreKeys[key]) {
			return;
		}
		const current = value[key];
		if (
			current &&
			typeof current === "object" &&
			!Array.isArray(current) &&
			typeof current.__id__ === "number"
		) {
			collected.add(current.__id__);
			return;
		}
		collectReferencedIds(current, ignoreKeys, collected);
	});
}

function extractSerializedSubtree(
	serializedObjects: any[],
	rootMarkerName: string,
): SerializedSubtreeResult {
	if (!Array.isArray(serializedObjects) || serializedObjects.length === 0) {
		throw new Error("序列化数据格式异常");
	}

	const rootIndex = serializedObjects.findIndex((item) => {
		return item && item.__type__ === "cc.Node" && item._name === rootMarkerName;
	});
	if (rootIndex < 0) {
		throw new Error("无法在序列化结果中定位目标根节点");
	}

	const visited = new Set<number>();
	const missingIndices = new Set<number>();
	const queue = [rootIndex];

	while (queue.length > 0) {
		const currentIndex = queue.shift();
		if (typeof currentIndex !== "number" || currentIndex < 0 || visited.has(currentIndex)) {
			continue;
		}
		const currentObject = serializedObjects[currentIndex];
		if (!currentObject) {
			missingIndices.add(currentIndex);
			continue;
		}
		visited.add(currentIndex);

		const referencedIds = new Set<number>();
		collectReferencedIds(currentObject, { _parent: true, _prefab: true }, referencedIds);
		referencedIds.forEach((nextIndex) => {
			if (!visited.has(nextIndex)) {
				queue.push(nextIndex);
			}
		});
	}

	const orderedIndices = [rootIndex, ...Array.from(visited).filter((index) => index !== rootIndex).sort((a, b) => a - b)];
	return {
		objects: orderedIndices.map((index) => serializedObjects[index]),
		orderedIndices,
		rootIndex,
		missingIndices: Array.from(missingIndices).sort((a, b) => a - b),
	};
}

export function resolveSerializedPrefabSubtree(
	primarySerializedObjects: any[],
	fallbackSerializedObjects: any[] | null | undefined,
	rootMarkerName: string,
) {
	const primaryResult = extractSerializedSubtree(primarySerializedObjects, rootMarkerName);
	if (primaryResult.missingIndices.length === 0) {
		return {
			objects: primaryResult.objects,
			orderedIndices: primaryResult.orderedIndices,
			rootIndex: primaryResult.rootIndex,
			usedFallback: false,
		};
	}

	if (!fallbackSerializedObjects) {
		throw new Error(
			`序列化结果缺少子节点定义，无法构建预制体: ${primaryResult.missingIndices.join(", ")}`,
		);
	}

	const fallbackResult = extractSerializedSubtree(fallbackSerializedObjects, rootMarkerName);
	return {
		objects: fallbackResult.objects,
		orderedIndices: fallbackResult.orderedIndices,
		rootIndex: fallbackResult.rootIndex,
		usedFallback: true,
	};
}
