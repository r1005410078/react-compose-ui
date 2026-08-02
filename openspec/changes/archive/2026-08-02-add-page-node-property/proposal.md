# 变更：页面作为节点属性值

## 原因

`add-page-system` 让页面成为一等文档后，页面仍然只能被独立编辑，无法作为某个组件的子内容被装配
进去。属性面板没有任何「引用一个节点」的属性类型，也没有任何拖放能力（`property-panel` 中
`dragover`/`drop`/`dataTransfer` 零命中）。物料侧同样缺少先例：Image 的 `asset` 属性只能靠拖入画布
写入，从未出现在 Inspector schema 中，无法在面板里改指向。

本变更新增 `node` 基础属性 editor —— 其值指向一个页面，可从候选列表选择或从资源面板拖入 ——
并让被引用页面在编辑画布与预览中实时嵌套渲染。

## 前置依赖

依赖 `add-page-system` 已交付：`core` 的 `ComposePageReference` 与嵌套护栏、
`@compose-ui/pages` 的页面目录与文档 Store、`editor` 的页面工作区。

## 变更内容

- `property-panel` 新增稳定 editor ID 为 `node` 的基础 editor：候选选择、清空、可读标签、
  拖入赋值；新增 `ComposePropertyPanelNodeEditorPort` 宿主端口与 `'drop'` 变更原因。
  这是 `property-panel` 中的第一个拖放目标，面板本身仍不认识页面、资源 Provider 或文档语义。
- `asset-browser` 新增始终写入的稳定引用拖拽载荷
  `application/x-compose-asset-reference+json`，并允许宿主通过判定回调放宽「可拖入 Canvas」的
  内建图片白名单。**BREAKING** 无 —— 既有的内部移动 id 载荷语义不变。
- `component-registry` 新增 `pageNodePort` 与 `pageDocumentPort` 两个渲染上下文端口，
  沿既有 `paintEditPort` 的投递路径透传。
- `materials` 新增 `composeNodePropertySchema()` 与 `page-slot` 物料。`page-slot` 自行完成
  「加载页面文档 → 递归渲染」，并支持把页面从资源面板拖入画布直接创建实体。
- `stage` 与 `preview` 新增 `pageLoader` 注入；两者均**不新增渲染代码**，被引用页面在编辑画布与
  预览中实时嵌套渲染，编辑态嵌套内容不参与命中测试。

无 **BREAKING** 变更：所有新增 prop 与端口均为可选，省略时既有行为完全不变。

## 影响

- 受影响的规范：`property-panel`、`asset-browser`、`component-registry`、`basic-materials`、
  `stage`、`compose-preview`
- 受影响的代码：
  - `packages/property-panel/src/semantic-editors/base-editors.tsx`、
    `property-panel/editor-ports.ts`、`property-panel/compose-property-panel.tsx`、`styles.css`
  - `packages/asset-browser/src/asset-browser/compose-asset-browser.tsx`、`asset-browser-types.ts`
  - `packages/component-registry/src/registry/types.ts` 及
    `registry-renderers/compose-registry-renderers.tsx`
  - 新增 `packages/materials/src/page-slot/`、`packages/materials/src/material-inspector-kit/node.ts`
  - `packages/pages/src/page-document-loader.ts`
  - `packages/stage/src/types.ts` 与 stage surface、
    `packages/preview/src/compose-preview/compose-preview.tsx`
  - `packages/editor/src/pages/use-node-editor-port.ts`、`inspector/entity-inspector.tsx`、
    `editor-controller/controller.tsx`
  - 文档：`packages/property-panel/README.md`（稳定 editor ID 列表）、`.changeset/`
