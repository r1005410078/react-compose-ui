# 变更：引入场景动画包与文档动画清单

## 原因

`@compose-ui/animation-panel` 是一个与文档完全解耦的原型：关键帧的 `value` 只是展示用字符串，
`interpolation` 从不被求值，播放头移动时没有任何东西被采样，画布毫无反应。要让动画面板真正驱动
画布和属性面板，必须先有一份无 React、无 DOM、可单测的动画事实来源。

关键帧数据的**存放位置**决定了一串结构操作的正确性。放在文档顶层时，复制粘贴 Entity 不会带走它的
动画、删除 Entity 会留下孤儿轨道、Group 与提取项目组件都要手工搬迁轨道，而且组件无法自带动画。
把轨道挂在被动画的 Entity 自己身上，这四类操作全部自动正确。`entity.components` 只要求 key 是
PascalCase、value 是合法 JSON（`packages/core/src/document.ts:583-592`），因此 `Animation`
是一个不需要修改 core 校验的扩展点。

## 变更内容

- 新增 `@compose-ui/animation` 包：无 React、无 DOM，只依赖 `@compose-ui/core`。
  承载 `Animation` ECS Component 协议、轨道与关键帧类型、插值与采样器、运动路径几何、
  组件校验与全部动画命令 handler。
- 关键帧轨道存放在被动画 Entity 的 `Animation` Component 中，按动画 ID 分组。
  轨道以 Entity 内 `DocumentPath` 标识属性，不再冗余保存 `entityId`。
- `@compose-ui/core` 只增加**文档级动画清单**：可选 `animations` 字段，每条只含
  `{ id, name, durationMs, playbackMode }` 与可选的 `bindings`，不含任何轨道或关键帧。
  校验器只校验已知字段、不拒绝未知顶层键，因此这是纯加法扩展，`schemaVersion` 保持 `6`，
  不需要迁移。
- 清单条目的 `bindings` 复用既有的 `ComposePageExportReference`，声明 `playing`（布尔）与
  `currentTime`（毫秒数值）两个可绑定的播放控制目标。本变更只定义数据与校验，
  运行时驱动由 `add-animation-playback-control` 交付。
- 动画命令通过 `TransactionRuntimeOptions.handlers` 注入，产出标准 `DocumentPatch`，
  从而自动获得事务、撤销与重做。
- 同步更新 `AGENTS.md` 的架构边界、`README.md` 的包清单与 `openspec/project.md`。

## 影响

- 受影响规范：`scene-animation`（新增）、`compose-document`
- 新增代码：`packages/animation/`（新包）
- 受影响代码：`packages/core/src/document-types.ts`、`packages/core/src/document.ts`、
  `packages/core/src/index.ts`
- 不影响任何 React 包；`animation-panel`、`editor`、`stage` 在本变更中不动
- 文档同步：`AGENTS.md`、`README.md`、`openspec/project.md`
