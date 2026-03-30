# Architecture
- **Files Modified**: 
  - `src/main.js`: 修改 `manageAsset` 方法中的资源查询行为，增加防为空报错防御和特性探测（Feature Check）。
  - `docs/asset_db_analysis.md`: 补充该兼容性问题的技术细节记载。
- **Data Models**: 无新增数据模型。主要是完善现存流程的安全与兼容判定。

# Step-by-Step
- [x] `[Backend]` 修改 `main.js`：在查阅 AssetDB 之前，新增对 `Editor.assetdb` 实例对象本身的空引用判定。如果为空则通过回调向请求方显式抛出异常文本。
- [x] `[Backend]` 修改 `main.js`：在通过了存在校验后，修改逻辑通过检查 `typeof Editor.assetdb.queryInfoByUrl === 'function'` 优先执行原生方法。
- [x] `[Backend]` 修改 `main.js`：如果原生查询方法不可用，执行安全降级手段，调用 `urlToUuid` + `queryInfoByUuid` 保证老版本 Cocos 中功能正常运作。
- [x] `[Frontend]` 修改 `docs/asset_db_analysis.md`：根据新规范，将该异常表现与防崩溃检查的兼容策略补充至内部分析文档中。
