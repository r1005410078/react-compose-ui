# 变更：增加 Auto Layout Fill 与编辑交互

## 原因

Fixed Flex 只能展示自动排列，尚不能表达填充容器，也没有定义 move、resize、Scene Tree reparent、
duplicate 和 group 在 Flow/Absolute 模型下的命令语义。

## 变更内容

- 为 v6 LayoutItem axis sizing 增加 `fill`。
- Stage 拖动或键盘移动 Flow 时原子转换为 Absolute，不做 Stage Flow 重排。
- Scene Tree 移入 Layout 自动 Flow，跨 Layout 保持 Flow，移出时烘焙 Absolute 几何。
- Fill/Hug-like 非 Fixed Resize 使用“转换 Fixed + 最终尺寸”的统一事务规则。
- 含 Flow 目标时禁用 Group/Ungroup；Duplicate 保持目标 positioning 与确定顺序。

## 影响

- 依赖变更：必须在 `add-layout-runtime-v6` 完成后实施。
- 受影响规范：compose-document、command-transaction、stage-engine、stage、
  editor-workspace-layout、basic-materials。
- 受影响代码：core LayoutItem/命令、stage-engine session/commands、Stage keyboard/pointer、Editor
  Scene Tree planner 与 Materials LayoutItem Inspector。

