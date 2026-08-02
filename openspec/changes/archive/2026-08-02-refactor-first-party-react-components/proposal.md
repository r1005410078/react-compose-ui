# Change: 规范化第一方 React 组件并引入 Storybook

## Why

现有第一方 React 包仍混合平铺文件、兼容 facade 与不一致的公开命名；复杂 UI 的交互模型和
DOM 渲染也常位于同一文件。需要一次明确的 major 升级，把包内组织、公共 API、组件文档与
可访问性测试收敛为同一套可执行规范。

## What Changes

- **BREAKING**：所有受影响 React 包改为 `Compose*` 公共命名，并移除 legacy Preview、locale
  prop、Editor 平铺插槽、资源协议转导和所有 deprecated alias。
- 把全部公开视觉组件迁移为 Feature-first 目录；根入口只保留 public API，样式入口保持
  `@compose-ui/<package>/styles.css`。
- 新增私有 `@compose-ui/storybook` workspace，为全部公开视觉组件提供 stories、浏览器组件测试
  与 Axe 可访问性检查。
- 增加架构检查，阻止平铺公共组件、缺失共置测试/Story、无语义目录和跨包深层导入回归。

## Impact

- Affected specs: components, ui-context, stage, scene-tree, asset-browser, property-panel, history,
  operation-log, command-panel, component-registry, basic-materials, editor-workspace-layout,
  compose-preview, component-documentation.
- Affected packages: all first-party React UI packages, example app, new Storybook workspace, root toolchain.
- Headless ComposeDocument、assets 与 stage-engine protocol do not change.
