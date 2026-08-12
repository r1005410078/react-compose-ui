# 变更：组件实例内部层级可见与结构覆盖

## Why

`add-linked-component-library` 把 `component-instance` 定义为宿主场景的编辑叶子，实例内部 Entity 既不
进入 Scene Tree 也不参与 Stage 命中。实际使用中实例在场景树里只呈现为一个节点，无法查看或选中内部
层级，与 Unity Prefab 实例的心智模型不一致：Unity 中实例内部层级始终可展开、可选中、可逐节点覆盖。

实施工程师需要在不打散关联关系的前提下，直接在宿主场景里定位实例内部节点并做逐实例调整，包括结构
调整，而不是为每个微小差异都新建 Variant。

## What Changes

- Scene Tree MUST 把实例解析后的内部实体树投影为实例节点的后代，使用 `实例ID + 内部稳定 ID` 的复合
  节点寻址，避免与宿主实体 ID 冲突。
- Stage 命中与选区 MUST 支持穿透进实例内部，并与 Scene Tree 选中态双向同步。
- **BREAKING（文档协议）**：实例的 `propertyOverrides` 扩展为 `instanceOverrides`，除属性覆盖外还承载
  与 Variant 同构的稳定结构操作（字段 set/remove、Component add/remove、子树 add/remove、reparent/reorder）。
  v1 实例数据由显式纯迁移转换，`propertyOverrides` 不再被静默接受。
- Resolve 顺序扩展为 Base → 从根到叶的 Variant → 实例结构操作 → 实例属性覆盖。
- 实例结构操作 MUST 可单项/全部 Apply 到直接父源，并可 Revert；复用既有两阶段写入与 partial success 语义。
- 实例内部编辑 MUST 限制在实例子树边界内：内部节点不可 reparent 出实例、不可删除实例根、不可删除基础
  Component；跨实例边界的移动仍属非目标。
- 属性面板在选中内部节点时 MUST 写入实例覆盖，而非宿主文档。

## Impact

- 受影响规范：`basic-materials`、`compose-preview`、`component-library`、`scene-tree`、`stage`
- 受影响代码：`@compose-ui/core`、`@compose-ui/component-library`、`@compose-ui/materials`、
  `@compose-ui/stage-engine`、`@compose-ui/stage`、`@compose-ui/scene-tree`、`@compose-ui/preview`、
  `@compose-ui/editor` 与示例应用
- 前置基线：已归档的 `2026-08-12-add-linked-component-library`
