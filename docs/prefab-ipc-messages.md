# Prefab 相关的 IPC 消息总结

本文档总结了 Cocos Creator 编辑器中所有与 Prefab 相关的 `Editor.Ipc.sendTo*` 开头的 IPC 消息。

## 消息列表

| 序号 | IPC 消息调用                                                                                        | 消息名称                       | 参数                                                               | 所在文件                                                   | 说明                           |
| ---- | --------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------ |
| 1    | `Editor.Ipc.sendToAll("scene:enter-prefab-edit-mode", e)`                                           | scene:enter-prefab-edit-mode   | `e` (prefab uuid)                                                  | `editor/builtin/assets/panel/component/node.js:277`        | 进入 prefab 编辑模式           |
| 2    | `Editor.Ipc.sendToPanel("scene", "scene:create-prefab", d, u)`                                      | scene:create-prefab            | `d` (uuid), `u` (path)                                             | `editor/builtin/assets/panel/component/nodes.js:197`       | 创建 prefab                    |
| 3    | `Editor.Ipc.sendToPanel("scene", "scene:revert-prefab", this._vm.target.uuid)`                      | scene:revert-prefab            | `this._vm.target.uuid` (node uuid)                                 | `editor/builtin/inspector/panel/index.js:137`              | 还原 prefab                    |
| 4    | `Editor.Ipc.sendToPanel("scene", "scene:apply-prefab", this._vm.target.uuid)`                       | scene:apply-prefab             | `this._vm.target.uuid` (node uuid)                                 | `editor/builtin/inspector/panel/index.js:140`              | 应用 prefab                    |
| 5    | `Editor.Ipc.sendToPanel("scene", "scene:set-prefab-sync", this._vm.target.uuid)`                    | scene:set-prefab-sync          | `this._vm.target.uuid` (node uuid)                                 | `editor/builtin/inspector/panel/index.js:143`              | 设置 prefab 同步               |
| 6    | `Editor.Ipc.sendToPanel("node-library", "node-library:delete-prefab", e)`                           | node-library:delete-prefab     | `e` (prefab info object)                                           | `editor/builtin/node-library/core/menu.js:7`               | 删除 prefab                    |
| 7    | `Editor.Ipc.sendToPanel("node-library", "node-library:rename-prefab", e)`                           | node-library:rename-prefab     | `e` (prefab info object)                                           | `editor/builtin/node-library/core/menu.js:14`              | 重命名 prefab                  |
| 8    | `Editor.Ipc.sendToPanel("node-library", "node-library:set-prefab-icon", e)`                         | node-library:set-prefab-icon   | `e` (prefab info object)                                           | `editor/builtin/node-library/core/menu.js:21`              | 设置 prefab 图标               |
| 9    | `Editor.Ipc.sendToMain("node-library:popup-prefab-menu", e.x, e.y, { id: this.prefab.uuid })`       | node-library:popup-prefab-menu | `e.x`, `e.y`, `{ id: this.prefab.uuid }`                           | `editor/builtin/node-library/panel/component/prefab.js:30` | 弹出 prefab 菜单               |
| 10   | `Editor.Ipc.sendToPanel("scene", "scene:create-node-by-prefab", e, Editor.assetdb.urlToUuid(r), o)` | scene:create-node-by-prefab    | `e` (name), `Editor.assetdb.urlToUuid(r)` (uuid), `o` (parentNode) | `editor/core/main-menu.js:6`                               | 通过 prefab 创建节点           |
| 11   | `Editor.Ipc.sendToMain("scene:create-prefab", s, a, (e, t) => {...})`                               | scene:create-prefab            | `s` (path), `a` (serialized data), callback                        | `editor/page/scene-utils/index.js:211`                     | 创建 prefab（带回调）          |
| 12   | `Editor.Ipc.sendToMain("scene:apply-prefab", i, n)`                                                 | scene:apply-prefab             | `i` (uuid), `n` (serialized data)                                  | `editor/page/scene-utils/index.js:225`                     | 应用 prefab 到资源             |
| 13   | `Editor.Ipc.sendToAll("scene:enter-prefab-edit-mode", l.uuid)`                                      | scene:enter-prefab-edit-mode   | `l.uuid` (prefab uuid)                                             | `editor/builtin/open-recent-items/main.js:28`              | 从最近项目进入 prefab 编辑模式 |

## 按功能分类

### Prefab 编辑模式管理

- **scene:enter-prefab-edit-mode** - 进入 prefab 编辑模式

### Prefab 创建与保存

- **scene:create-prefab** - 创建 prefab 资源
- **scene:apply-prefab** - 应用 prefab 修改到资源

### Prefab 实例操作

- **scene:revert-prefab** - 还原 prefab 实例
- **scene:set-prefab-sync** - 设置 prefab 同步状态

### Node Library Prefab 管理

- **node-library:delete-prefab** - 删除用户 prefab
- **node-library:rename-prefab** - 重命名用户 prefab
- **node-library:set-prefab-icon** - 设置 prefab 图标
- **node-library:popup-prefab-menu** - 弹出 prefab 右键菜单

### 节点创建

- **scene:create-node-by-prefab** - 从 prefab 创建节点

## 详细说明

### 1. Prefab 编辑模式管理

#### scene:enter-prefab-edit-mode

- **用途**: 打开 prefab 进行编辑
- **参数**: prefab 资源的 uuid
- **发送方式**: sendToAll
- **处理**: 加载 prefab 资源并推入 prefab 编辑模式栈

> **重要提示**: `scene:save-prefab` 和 `scene:close-prefab` 以及 `scene:prefab-mode-changed` 等并不能用于主动保存或退出预制体模式。如果要在代码中真正模拟点击“保存”或“退出”预制体编辑模式，必须在运行于 `scene` 面板的脚本中获取内部的 `scene://edit-mode` 模块：
>
> ```javascript
> const editMode = Editor.require("scene://edit-mode");
> if (editMode && editMode.curMode().name === "prefab") {
>     editMode.save(); // 保存预制体
>     editMode.pop(); // 退出预制体编辑模式
> }
> ```

### 2. Prefab 创建与保存

#### scene:create-prefab

- **用途**: 将场景中的节点保存为 prefab 资源
- **参数**:
    - path: prefab 保存路径
    - serializedData: 序列化后的 prefab 数据
    - callback: 回调函数 (error, uuid)
- **发送方式**: sendToMain 或 sendToPanel
- **处理**: 在 asset-db 中创建 prefab 文件

#### scene:apply-prefab

- **用途**: 将 prefab 实例的修改应用到 prefab 资源
- **参数**:
    - uuid: prefab 资源 uuid
    - serializedData: 序列化后的 prefab 数据
- **发送方式**: sendToMain 或 sendToPanel
- **处理**: 保存 prefab 资源文件

### 3. Prefab 实例操作

#### scene:revert-prefab

- **用途**: 将 prefab 实例还原到 prefab 资源的状态
- **参数**: 节点 uuid
- **发送方式**: sendToPanel
- **处理**: 重新实例化 prefab 资源并替换当前节点

#### scene:set-prefab-sync

- **用途**: 设置 prefab 实例的自动同步状态
- **参数**: 节点 uuid
- **发送方式**: sendToPanel
- **处理**: 切换 prefab sync 属性

### 4. Node Library Prefab 管理

#### node-library:delete-prefab

- **用途**: 从 node library 删除用户 prefab
- **参数**: prefab 信息对象 {id}
- **发送方式**: sendToPanel
- **处理**: 删除 prefab 文件和图标

#### node-library:rename-prefab

- **用途**: 重命名 node library 中的 prefab
- **参数**: prefab 信息对象 {id}
- **发送方式**: sendToPanel
- **处理**: 触发重命名 UI 交互

#### node-library:set-prefab-icon

- **用途**: 设置 prefab 的自定义图标
- **参数**: prefab 信息对象 {id}
- **发送方式**: sendToPanel
- **处理**: 打开文件选择对话框并保存图标

#### node-library:popup-prefab-menu

- **用途**: 在 prefab 上右键弹出上下文菜单
- **参数**: x 坐标，y 坐标，prefab 信息对象 {id}
- **发送方式**: sendToMain
- **处理**: 显示右键菜单

### 5. 节点创建

#### scene:create-node-by-prefab

- **用途**: 从 prefab 资源创建节点实例
- **参数**:
    - name: 节点名称
    - uuid: prefab 资源 uuid
    - parentNode: 父节点
- **发送方式**: sendToPanel
- **处理**: 实例化 prefab 并添加到场景中

## 使用示例

### 进入 Prefab 编辑模式

```javascript
Editor.Ipc.sendToAll("scene:enter-prefab-edit-mode", prefabUuid);
```

### 创建 Prefab

```javascript
Editor.Ipc.sendToMain("scene:create-prefab", path, serializedData, (error, uuid) => {
    if (error) {
        Editor.error(error);
        return;
    }
    // prefab 创建成功，uuid 为新创建的 prefab uuid
});
```

### 应用 Prefab 修改

```javascript
Editor.Ipc.sendToPanel("scene", "scene:apply-prefab", rootNodeUuid);
```

### 还原 Prefab

```javascript
Editor.Ipc.sendToPanel("scene", "scene:revert-prefab", nodeUuid);
```

### 从代码创建 Prefab 节点

```javascript
let parentNode = Editor.Selection.contexts("node")[0] || Editor.Selection.curActivate("node");
Editor.Ipc.sendToPanel("scene", "scene:create-node-by-prefab", nodeName, prefabUuid, parentNode);
```
