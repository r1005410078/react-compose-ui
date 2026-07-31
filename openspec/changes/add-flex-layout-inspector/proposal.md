# Change: 新增 Flex 布局类型与紧凑属性面板

## Why

Container 目前只保存层级和裁剪信息，无法表达浏览器 Flexbox 的容器配置。编辑器需要先建立稳定、
可持久化的布局类型和符合现有 Inspector 密度的属性面板，为后续 Stage/Preview 布局实现提供协议基础。

## What Changes

- 在 `@compose-ui/core` 新增可选 `Layout` Component 和首个 `flex` 布局类型，严格保存
  `flex-direction`、`flex-wrap`、`align-content`、`justify-content`、`align-items` 与单值 `gap`。
- 为新建 Container 和后续附加的“容器”能力写入浏览器初始语义的 Flex 默认值；旧 v5 文档无需迁移，
  缺少 `Layout` 时继续保持现状。
- 在 `@compose-ui/materials` 注册“布局”Component Inspector，按设计稿使用两行三列属性卡片；
  中文标题下补充 CSS 属性名，五项和六项图标组在卡片内按三列换行。
- 在布局分组标题栏提供 `display: flex` 状态和整体重置操作，并在属性末尾提供带配置摘要、
  三节点与主轴/交叉轴标记的实时预览。
- 为 Property Panel Section 和 Component Definition 增加可选的标题栏 actions 扩展，不把
  Layout 领域逻辑写入 Editor。
- 本阶段只更新文档数据和 Inspector 内部预览；Stage 与独立 Preview 不读取 `Layout`，不改变场景实际排版。

## Impact

- Affected specs: `compose-document`、`basic-materials`、`property-panel`、`component-registry`
- Affected code: `packages/core`、`packages/property-panel`、`packages/component-registry`、
  `packages/editor`、`packages/materials` 及对应测试、样式、README 与 E2E 黄金图
- Public API: 新增 `Layout` 内建 Component Key、Flex 布局 JSON 类型、默认值工厂和校验器；不修改
  Stage 或 Preview 的现有公共 Props；为 Section 和 Component Definition 新增可选标题栏 actions。
