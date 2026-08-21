## ADDED Requirements

### Requirement: 选区与屏幕几何的派生可独立求值

选区约束、缩放手柄集合、可旋转与可编辑判定，以及世界到屏幕的换算 MUST 是不依赖 React 的
纯函数，MUST 能脱离渲染独立断言。

缩放手柄 MUST 区分「可拖动」与「需画出」两个集合——`free` 与 `preserve-aspect` 只画四角，
边方向靠透明命中区响应；`horizontal` 与 `vertical` 没有角可用，必须画出对应边控点。

#### Scenario: 多选时约束取交集

- **WHEN** 选区内一项只允许水平缩放、另一项只允许垂直缩放
- **THEN** 没有任何手柄可用

#### Scenario: 组件实例始终可四角缩放

- **WHEN** 选中一个已落盘为 `resize: 'none'` 的组件实例
- **THEN** 选区层按 `free` 处理并给出四角手柄，文档不被修改

### Requirement: 适配层不承担可独立求值的派生

Stage 适配层 MUST NOT 内联可由输入完全决定的派生逻辑。这类逻辑 MUST 住在纯函数模块，
适配层只负责调用与接线。

#### Scenario: 辅助线预览与已保存线的合并可独立断言

- **WHEN** 给定已保存的辅助线与拖动中的预览
- **THEN** 同 id 的被预览覆盖、预览中的新线追加在后，结果完全由输入决定
