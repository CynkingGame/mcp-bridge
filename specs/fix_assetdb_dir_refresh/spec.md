# Global Fix for AssetDB Directory Creation and UUID Collisions (V8 Atomic Cascade Import)

## Problem Description

在 Cocos Creator (2.4.x) 中，当 MCP Bridge 尝试创建带有深层嵌套路径的各类资源（如脚本、材质、场景、预制体）时，频繁出现 `[db-task][sync-changes] uuid collision` 和 `path collision` 报错，导致资源导入报错或层级显示错乱，甚至会强行在根目录 `db://assets/` 抛下孤儿节点，必须手动重启或刷新编辑器。

这经历了长达 8 个版本的迭代。早期尝试 (V6 前) 试图用 Node.js 的物理 `fs.mkdirSync` 配合手动 `Editor.assetdb.refresh` 来规避原生 `Editor.assetdb.create` 无法建立跨级目录且含有内部 `sub-assets` (如 Texture) 不兼容的 Bug。但这引发了更严重的后果：**物理空间的文件变化与引擎后置的 DB Watcher 监视器发生了微秒级别的时序竞态 (Race Condition)**，导致双方同时尝试为刚出生的深层文件分配 UUID，最终撞库并瘫痪内部层级。

## Functional Requirements

1. **废弃物理建目录的骚扰**：绝对禁止直接在 `db://assets` 指向的物理工作空间内越过引擎使用 `fs` 创建任何文件或文件夹。
2. **纯粹原生异步化处理**：为了彻底保证 UUID 生成的线性和一致性，所有的建立操作必须依赖引擎的单一任务队列来处理，哪怕需要我们外部进行巧妙伪装。
3. **原生 Texture 子资产兼容**：建立时需要避开 `create` 的内置 Bug。
4. **统一的安全包装器**：提供高度内聚的统一接口 `_safeCreateAsset`，接管所有资源的抽象创建生命周期。

## Technical Implementation Details (V8 Solution)

1. **清理陈旧代码**：
    - 从 `src/main.js` 中彻底解耦并删除所有容易引起 DB 报错与平台路径错误的辅助函数：\_ensureParentDirSync 以及旧版的各种物理寻址探测逻辑。

2. **新增统一的资源创建工具函数 (V8 架构)**：
   在 `main.js` 中重构 `_safeCreateAsset`，这是一套堪称“曲线救国”的原子级联创建操作栈（Atomic Cascade Import）：

    ```javascript
    /**
     * 安全创建资源 (V8 完美原子级联方案)
     * 策略：永远不去触碰物理项目文件夹里的 fs.mkdir。计算出缺失的深层树结构，
     * 在 OS Temp 文件夹构建整颗由缺失目录和最终文件组成的隔离树，最后通过
     * 原生的 Editor.assetdb.import 单次原子地把整个树吸入最底层的共有确切父节点。
     */
    _safeCreateAsset(path, content, originalCallback, postCreateModifier = null) {
        // 1. 向上回溯，寻找到 DB 中确切存在的最深“锚点母目录”
        // ... (收集 missingDirs 缺失目录树) ...

        // 2. 利用 Node.js 的 os.tmpdir() 开辟系统隔离垃圾箱
        // 在该防侦测掩体中复刻出 `missingDir1/missingDir2/file` 这套树
        // 并将 Buffer 数据完全写入

        // 3. 选定导入点
        // const topImportTarget = [基于临时区构建的最顶部确实目录或文件]

        // 4. 发起单次原子级原生拖拽导入
        // 此接口原本用于处理在编辑器外的所有手动拖拽行为，是 Cocos 最严密和包含所有级联自洽的任务管道。
        Editor.assetdb.import([topImportTarget], currentUrl, (impErr, results) => {
            // ... (清理临时垃圾并触发 postCreateModifier 元数据修改回调) ...
        });
    }
    ```

3. **重构各模块的创建逻辑以使用统一抽象**：
    - **`manageScript`** / **`manageAsset`** / **`manageShader`** / **`manageMaterial`** / **`manageTexture`** / **`sceneManagement` (create)** / **`prefabManagement` (create)**:
      全面切换使用该一元化的 `this._safeCreateAsset(path, content, callback, postCreateModifier)`。各级工具无需再关心复杂的竞态条件或层级错误。

## Edge Cases

1. **多格式文件区分导入**：
    - 既然采用了原生的 `import` ，其能够根据文件后缀（如 `.effect`, `.ts`, `.png`）自动驱动对应类型的内部 Importer，不再发生 Texture 因为原生代码片段漏洞崩溃的问题。
2. **性能与垃圾开销**：
    - 通过使用 `os.tmpdir()`，我们在最快且无关系统权限的独立区域（通常对应 Windows 内存盘或 Temp）完成了拼图，且每次完成任务无论成败，在出栈时静默通过 `fs.rmdirSync` 抹收了所有垃圾，绝不残留。
3. **修饰后处理回调**：
    - 使用如修改 Texture 图片的边缘剪裁、设置 Prefab 的 root 信息等时，仍然传递给 `postCreateModifier`，并且使用 `setTimeout(..., 100)` 来应对因为 `import` 内部刚解析生成 `.meta` 时存在的一刹那磁盘系统锁，安全读取。
