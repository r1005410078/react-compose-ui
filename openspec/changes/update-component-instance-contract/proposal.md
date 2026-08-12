# 变更：简化组件实例契约与自动同步

## Why

实例内部层级可编辑之后，原有的三处设计变成了负担：

1. 暴露属性是内部为黑盒时的产物。现在任意内部字段都能直接覆盖，还要求组件作者手填
   Entity/Component/字段路径/值类型 才能开放一个参数，门槛高且与直接覆盖重复。
2. 提取器只在选区已是 first-class Group 时复用它，选区是单个 Container 时仍额外包一层 Group，
   于是场景树出现 `Container > Container` 的冗余层级。
3. 实例被固定为 Hug 且不可 Resize，导致组件最外层容器的尺寸、外观、裁剪与 Auto Layout
   在宿主场景里都不可达。

同时，编辑组件源后必须手动点“检查更新”才能让实例跟上，日常编辑循环里这一步几乎总是无冲突的。

## What Changes

- **BREAKING（Component Asset 协议）**：移除暴露属性。`ComposeComponentPropertyDefinition`、
  Base 的 `properties` 字段与实例覆盖的 `properties` 分区一并删除；旧文件与旧实例由显式纯迁移
  转换为指向同一 target 的 `set-field` 结构操作，渲染输出不变。
- **BREAKING（Component Asset 协议）**：组件文档根放宽为“任意单根”，不再强制 first-class Group。
  单选一个已是容器或 Group 的节点时，提取器直接复用它作为组件根，不再追加包装层。
- **BREAKING（编辑器交互）**：实例几何契约改为跟随组件根。实例暴露根容器的尺寸、外观、裁剪与
  Auto Layout 属性并允许 Resize；这些编辑写入实例覆盖，不修改组件源。
- 组件源保存后依赖实例自动同步：无冲突时直接刷新 lineage 与快照，只有更新会使实例覆盖失效时
  才进入既有的冲突确认流程。
- 保持 `ComposeDocument v6`、复合地址寻址、实例子树封闭编辑域与八层上限不变。

## Impact

- 受影响规范：`component-library`、`basic-materials`、`stage-engine`、`compose-preview`
- 受影响代码：`@compose-ui/core`、`@compose-ui/component-library`、`@compose-ui/materials`、
  `@compose-ui/stage-engine`、`@compose-ui/editor` 与示例应用
- 前置基线：已归档的 `2026-08-12-add-instance-structural-overrides`
