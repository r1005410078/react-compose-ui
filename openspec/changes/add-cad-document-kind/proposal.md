# 新增 CAD 文档类型与编辑器外壳

## Why

按 `docs/cad-document-roadmap.md` 步骤 4：CAD 是**独立文档类型**，在资源浏览器中新建，
编辑范式参考 AutoCAD，与页面编辑完全不同。步骤 1–3 已经把地基铺好——交互内核泛型化、
事务运行时可注入校验器、命令与键位归一——本步落地文档协议与编辑器外壳。

**此步不含任何绘制能力。** 目标是一条完整可运行的最小纵向流程：
资源里新建 CAD → 打开成标签 → 存盘 → 关掉重开，内容仍在。

## What Changes

新增 `@compose-ui/cad`：无 React、无 DOM，只依赖 `core` 与 `assets`，按五层模型落在 Layer 1。

- **`CadDocument` v1 协议**：`{ schemaVersion: 1, units: 'px', layers, entities, rootIds }`。
  **复用 ECS 底座**——`entities` 直接用 `core` 的 `ComposeEntity`（它本身只要求
  `{ id, name, components }`，Composition 之类的约束住在 ComposeDocument 的校验器里而不是
  类型里）。因此 Patch 代数、事务、Undo/Redo、序列化全部复用，换的只是校验器与 Component 词汇。
- **`validateCadDocument`**：与 `validateComposeDocument` 同形（`valid` + 规范化后的
  `document` / `issues`），直接喂给步骤 2 的 `createDocumentTransactionRuntime`。
- **`.cad.json` 文件协议**：媒体类型、文件名助手、parse / serialize。
- **`createComposeCadStore`**：list / read / create / save，与 Component Store 同形。

编辑器接线：

- 资源浏览器注入「新建 CAD」上下文菜单项
- 第四种文档 panel `cadDocument`，与 asset / page / component 并列
- **边缘面板的展开状态成为「当前激活文档类型」的函数**：CAD 的初值是收起，其他文档类型
  是展开；用户手动展开/收起会记进该类型，切回来仍是用户上次的选择

## 无限图纸与 Frame

CadDocument **没有 Frame**，因此不受 `Frame.size` 是尺寸唯一事实来源这条不变量约束。
这正是「独立文档类型」相对于「ComposeDocument 里的一种 Entity」的实质收益，不只是 UI 偏好。

## 关于 layers

空文档也带一个图层 `0`，且校验要求至少一个图层。这是**格式的一部分**而不是提前抽象的功能：
AutoCAD 的图层 0 永远存在，DXF 的 `LAYER` 表同样如此，而 Schema 字段事后补要付迁移的代价。
Entity 与图层的关联留到步骤 5——第一个图元落地时才知道该怎么挂。

## Impact

- Affected specs: `cad-document`（新增）、`editor-workspace-layout`
- Affected code: 新增 `packages/cad/`；改动 `packages/editor/src/workspace-layout/`、
  `packages/editor/src/compose-editor/`、新增 `packages/editor/src/cad/`
- 不影响 `core` 以外的既有包行为；ComposeDocument 路径一行不改
