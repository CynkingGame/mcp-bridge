const test = require("node:test");
const assert = require("node:assert/strict");

let prefabSerialization = {};

try {
    prefabSerialization = require("../dist/utils/PrefabSerialization.js");
} catch (_error) {}

test("resolveSerializedPrefabSubtree falls back to full scene data when node serialization has dangling child refs", () => {
    assert.equal(typeof prefabSerialization.resolveSerializedPrefabSubtree, "function");

    const partialNodeData = [
        {
            __type__: "cc.Node",
            _name: "__MCP_SERIALIZE_ROOT__TEST__",
            _children: [{ __id__: 2 }, { __id__: 3 }],
            _components: [],
        },
    ];

    const fullSceneData = [
        {
            __type__: "cc.Scene",
            _children: [{ __id__: 1 }],
        },
        {
            __type__: "cc.Node",
            _name: "__MCP_SERIALIZE_ROOT__TEST__",
            _children: [{ __id__: 2 }, { __id__: 3 }],
            _components: [],
        },
        {
            __type__: "cc.Node",
            _name: "ChildA",
            _children: [],
            _components: [],
        },
        {
            __type__: "cc.Node",
            _name: "ChildB",
            _children: [],
            _components: [],
        },
    ];

    const result = prefabSerialization.resolveSerializedPrefabSubtree(
        partialNodeData,
        fullSceneData,
        "__MCP_SERIALIZE_ROOT__TEST__",
    );

    assert.equal(result.usedFallback, true);
    assert.deepEqual(
        result.objects.map((item) => item._name),
        ["__MCP_SERIALIZE_ROOT__TEST__", "ChildA", "ChildB"],
    );
}
);
