# Implementation Plan: Fix AssetDB Directory Creation and UUID Collisions (V8)

## Section 1: Architecture

**Changed Files:**

- `src/main.js`: Main plugin backend script handling IPC requests to AssetDB.

**Data Models & API Updates:**

- **Added**: `_safeCreateAsset(path, content, originalCallback, postCreateModifier)` - A unified V8 wrapper handling the safe creation sequence. Instead of risky physical directory generation within the project, it computes the deepest missing directory tree, constructs a dummy version in `os.tmpdir()`, populates the file, and triggers a single, atomic `Editor.assetdb.import()` to seamlessly integrate it into Cocos without OS-level race conditions.
- **Removed**: `_ensureParentDirSync` and any direct `fs.mkdirSync` writing logic within the `assets` folder that triggered Watcher races.
- **Modified Endpoints**:
    - `manageScript` (create)
    - `manageAsset` (create, move)
    - `sceneManagement` (create, duplicate)
    - `prefabManagement` (create)
    - `manageShader` (create)
    - `manageMaterial` (create)
    - `manageTexture` (create) refactoring its internal logic to adopt the global `_safeCreateAsset` structure.

## Section 2: Step-by-Step

- [x] [Backend] Remove flawed manual directory creation functions (`_ensureParentDirSync`, `_getFsPath`) from `src/main.js`.
- [x] [Backend] Implement the new V8 `_safeCreateAsset` wrapper utilizing `os.tmpdir()` isolation and `Editor.assetdb.import` atomic cascades.
- [x] [Backend] Ensure `manageTexture/create` handles deep directory imports via `_safeCreateAsset` correctly avoiding sub-asset native bugs.
- [x] [Backend] Verify all other endpoints (`manageAsset`, `manageScript`, `manageShader`, `manageMaterial`, `sceneManagement`, `prefabManagement`) utilize `_safeCreateAsset`.
- [x] [Testing] Rigorous deep folder matrix test via MCP on Texture, Script, Material, and Shader.
