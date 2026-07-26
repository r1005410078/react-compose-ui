# Change: 新增 Image/SVG 物料与资源拖入 Stage

## Why

Asset Browser 已能管理和预览文件，但资源还不能进入 ComposeDocument，图片只能作为编辑器外部
文件存在。需要一条不内嵌二进制、可由 Stage 与 Preview 共同解析的稳定资源引用链路。

## What Changes

- 新增无 React 的 `@compose-ui/assets` 资源引用、Provider 与 resolver 协议。
- `@compose-ui/materials` 新增默认隐藏于 Palette 的 Image/SVG definitions 与 Inspector。
- Asset Browser 向 Editor 发出普通数据拖拽事件，Stage Engine 规划资源批量 drop。
- Stage 异步解析资源并以一个事务创建成功节点；Preview 使用相同 resolver 渲染。
- SVG 经严格净化后内联，并支持独立填充与描边覆盖。

## Impact

- Affected specs: assets, asset-browser, component-registry, basic-materials, stage-engine, stage,
  editor-workspace-layout, compose-preview
- Affected packages: assets, asset-browser, component-registry, materials, stage-engine, stage,
  editor, preview
- ComposeDocument 继续只支持 schemaVersion 3；资源引用保存在 Component JSON props。
