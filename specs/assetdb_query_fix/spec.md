# AssetDB API 调用修正规范 (Fix manage_asset Info Query)

## Visual Requirements
- **消除执行错误**：在使用 `manage_asset` 工具执行 `get_info` 动作时，面板控制台内将不再出现红色的 `[CommandQueue] 指令执行异常: Editor.assetdb.queryInfoByUrl is not a function`。
- **响应完整**：操作必须向 AI 客户端成功返回所请求的资源详细 JSON 信息（返回包含 uuid, url, assetType 等），实现后续 MCP 逻辑串联畅通。

## Functional Requirements
- **修正主进程业务代码（`src/main.js`）**：
  - 在 `manageAsset` 方法的 `case "get_info":` 分支，增强对于 AssetDB 实例的鲁棒检测和后备策略。
  - 具体逻辑必须按照如下优先级和流程来实现：
    1. **检测数据库实例对象**：检查 `Editor.assetdb` 实例对象是否有效（为空或未定义）。若为空，回调直接返回 `"当前编辑器资产数据库对象为空，无法调用管理"`，跳过后续操作。
    2. **尝试直接调用原生支持方法**：检查并判断 `Editor.assetdb.queryInfoByUrl` 是否确为真实存在的函数。若存在则执行。
    3. **降级后备方案**：当 `queryInfoByUrl` 方法不存在但实例对象非空时，采用安全降级策略：
       - 利用 `const uuid = Editor.assetdb.urlToUuid(path)` 提取对应资源的 UUID。
       - 利用 `Editor.assetdb.queryInfoByUuid(uuid, callback)` 方法继续完成获取详情的任务。
- **文档维护（`docs/asset_db_analysis.md`）**：
  - 去除绝对性的否定结论。在说明 `queryInfoByUrl` 的位置增加注记：“该方法在主进程中可能由于不同版本导致缺失，建议搭配 `queryInfoByUuid(uuid)` 作为 fallback 或跨进程安全调用方法”。

## Edge Cases
- **资源缺失及未建立缓存问题**：在执行降级方案（查找 UUID）前，利用 `Editor.assetdb.exists(path)` 对将查询的字符串对象有效性进行拦截。找不到资源时，立即中止操作并给出提示，避免空指针解构引擎故障报错。
- **对象缺失错误规避**：最致命的大前提是没有考虑 `Editor.assetdb` 其内部由于插件加载时序等导致的失效，新增的防御判断将其覆盖了。
