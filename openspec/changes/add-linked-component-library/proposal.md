# 变更：增加混合组件库与关联实例

## 状态

**未实施。** 本提案的实现曾在分支 `feat/add-linked-component-library`（`135f8f4`，2026-08-03）
上完成并通过当时的全量验证，但从未合并进 main。该分支已删除，完整历史归档为仓库外的
`/Users/rongts/www/feat-add-linked-component-library-2026-08-03.bundle`，可用
`git bundle unbundle` 或 `git fetch <bundle> feat/add-linked-component-library` 取回。

保留在 main 的只有提案、设计与规范增量。`tasks.md` 的清单已全部重置为未完成，当时的
Red/Green 记录移入该文件末尾的「历史执行记录」一节，仅供回溯，不代表 main 当前状态。
分叉点 `4ea3c46` 之后 main 已前进 16 个提交，Editor Inspector、Scene Tree、组件库 dock 与
命令面板均被重构，原实现无法直接套用。

## 原因

基础 Preset 与项目内可复用组件目前没有统一目录，场景子树也无法保存为可版本化、可更新的项目组件。需要在不把内建物料文件化的前提下，为实施工程师提供可离线渲染、显式覆盖和按 revision 更新的关联组件实例。

## 变更内容

- 新增 Component Document v1 文件协议和项目组件 Store。
- 组件库聚合 Registry Preset 与 Asset Provider 中的项目组件。
- 新增 `component-instance` 物料，以源快照、revision 和显式 overrides 渲染关联实例。
- Editor 支持保存选中子树、独立编辑组件文档、暴露属性和提示后更新实例。
- 保持 ComposeDocument v6、现有 Preset 和资源拖入协议兼容。

## 影响

- 受影响规范：`component-library`、`basic-materials`、`editor-workspace-layout`、`compose-preview`
- 受影响代码：`@compose-ui/core`、`@compose-ui/component-library`、`@compose-ui/materials`、`@compose-ui/editor`、示例应用与 E2E
