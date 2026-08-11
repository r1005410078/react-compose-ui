# 变更：增加 Stage 节点层级排序

## 原因

Stage 目前只能通过场景树拖拽间接调整同级顺序，画布中缺少前移、后移、置顶和置底操作。重叠节点被
遮挡后，用户无法在当前画布上下文中快速修正绘制顺序。

## 变更内容

- 新增前移一层、后移一层、置于顶层和置于底层四个节点层级动作。
- 以 `rootIds` / `Hierarchy.childIds` 为唯一顺序来源，不新增 `z-index` 或文档字段。
- 画布右键菜单、可配置快捷键与命令面板共享同一个 headless 命令规划器。
- 多选按直接父级分别处理并保持相对顺序；Flow 子项允许随 `childIds` 一同重排。
- 默认使用 Figma 风格键位：`[` / `]` 单步后移/前移，Primary+`[` / Primary+`]` 置底/置顶。

## 影响

- 受影响规范：`stage-engine`、`stage`、`editor-preferences`
- 受影响代码：`packages/stage-engine` 的结构命令，`packages/stage` 的右键菜单与快捷键，
  `packages/editor` 的动作目录、偏好和本地化
- 公共 API：新增层级操作类型与命令规划函数，并扩展 Stage/Editor shortcut action union
- 文档模型：ComposeDocument v6 Schema 不变
